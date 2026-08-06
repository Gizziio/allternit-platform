#!/usr/bin/env node
/**
 * Builds the desktop auth renderer (React + Clerk) into dist/renderer/auth.
 *
 * Also writes dist/renderer/auth/clerk-config.json with the Clerk publishable
 * key sourced from:
 *   1. NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable
 *   2. resources/company.json -> clerkPublishableKey
 *
 * Self-hosted builds (company.json selfHosted === true) skip the key requirement.
 */

const fs = require('node:fs');
const path = require('node:path');
const { build } = require('vite');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const desktopRoot = path.resolve(__dirname, '..');
const outDir = path.join(desktopRoot, 'dist', 'renderer', 'auth');
const companyConfigPath = path.join(repoRoot, 'resources', 'company.json');

function resolveClerkKey() {
  const envKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (envKey) return { key: envKey, source: 'env' };

  try {
    const company = JSON.parse(fs.readFileSync(companyConfigPath, 'utf8'));
    if (company.selfHosted === true) {
      return { key: '', source: 'self-hosted', selfHosted: true };
    }
    const key = company.clerkPublishableKey?.trim();
    if (key) return { key, source: 'company.json' };
  } catch (err) {
    console.warn('[build-auth-renderer] Could not read company.json:', err.message);
  }

  return { key: '', source: 'none' };
}

async function main() {
  const { key, source, selfHosted } = resolveClerkKey();

  if (!key && !selfHosted) {
    console.error(
      '[build-auth-renderer] Clerk publishable key is missing. ' +
        'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or resources/company.json clerkPublishableKey. ' +
        'For self-hosted builds, set selfHosted: true in company.json.',
    );
    process.exit(1);
  }

  console.log(`[build-auth-renderer] Clerk key source: ${source}`);

  // Build the renderer via Vite.
  await build({
    configFile: path.join(desktopRoot, 'vite.auth-renderer.config.ts'),
  });

  // Write the runtime config next to the built assets.
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'clerk-config.json'),
    JSON.stringify(
      {
        publishableKey: key,
        signInUrl: '/',
        signUpUrl: '/',
      },
      null,
      2,
    ),
  );

  console.log(`[build-auth-renderer] Renderer built to ${outDir}`);
}

main().catch((err) => {
  console.error('[build-auth-renderer] Build failed:', err);
  process.exit(1);
});
