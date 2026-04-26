#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const platformDir = path.resolve(__dirname, '..');
const nextDir = path.join(platformDir, '.next');
const serverDir = path.join(nextDir, 'server');
const srcAppDir = path.join(platformDir, 'src', 'app');
const srcPagesDir = path.join(platformDir, 'src', 'pages');
const appPathsManifestPath = path.join(serverDir, 'app-paths-manifest.json');
const appPathRoutesManifestPath = path.join(nextDir, 'app-path-routes-manifest.json');
const appDir = path.join(serverDir, 'app');
const pagesDir = path.join(serverDir, 'pages');
const pagesManifestPath = path.join(serverDir, 'pages-manifest.json');
const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
const desktopBuildNodeOptions = existingNodeOptions.includes('--max-old-space-size=')
  ? existingNodeOptions
  : `${existingNodeOptions} --max-old-space-size=4096`.trim();
const LOCALHOST_CLERK_PUBLISHABLE_KEY =
  'pk_test_ZWFzeS1oYXdrLTUzLmNsZXJrLmFjY291bnRzLmRldiQ';
const LOCALHOST_CLERK_SECRET_KEY =
  'sk_test_37qh7k8rZwwWu3QKPi2doqk10SabkYgIMCXEqkcQzi';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
}

const productionEnv = loadEnvFile(path.join(platformDir, '.env.production'));
const localEnv = loadEnvFile(path.join(platformDir, '.env.local'));
const desktopBuildEnv = {
  ...process.env,
  ...productionEnv,
  ALLTERNIT_BUILD_MODE: 'desktop',
  NODE_OPTIONS: desktopBuildNodeOptions,
  NEXT_PRIVATE_MAX_WORKERS: '1',
  ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
  NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
  ALLTERNIT_DESKTOP_AUTH_ENABLED: '1',
  NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH: '1',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    LOCALHOST_CLERK_PUBLISHABLE_KEY,
};

if (!desktopBuildEnv.CLERK_SECRET_KEY) {
  desktopBuildEnv.CLERK_SECRET_KEY = localEnv.CLERK_SECRET_KEY || LOCALHOST_CLERK_SECRET_KEY;
}

function normalizeAppRoute(routePath) {
  const withoutGroups = routePath.replace(/\/\([^/]+\)/g, '');

  if (withoutGroups === '/page') return '/';
  if (withoutGroups === '/_not-found/page') return '/_not-found';
  if (withoutGroups.endsWith('/page')) return withoutGroups.slice(0, -'/page'.length) || '/';
  if (withoutGroups.endsWith('/route')) return withoutGroups.slice(0, -'/route'.length) || '/';
  return null;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function shallowEqualObject(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

function mergeManifest(existing, generated) {
  const next = { ...existing };
  let changed = false;

  for (const [key, value] of Object.entries(generated)) {
    if (next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  }

  return { changed, data: next };
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function repairManifests() {
  if (fs.existsSync(srcAppDir)) {
    const appSourceFiles = walkFiles(srcAppDir)
      .filter((filePath) => /\.(t|j)sx?$/.test(filePath))
      .filter((filePath) => /(?:^|\/)(page|route)\.(t|j)sx?$/.test(filePath));

    if (appSourceFiles.length > 0) {
      const generatedAppPathsManifest = Object.fromEntries(
        appSourceFiles.map((filePath) => {
          const relativePath = path.relative(srcAppDir, filePath).split(path.sep).join('/');
          const withoutExtension = relativePath.replace(/\.(t|j)sx?$/, '');
          const routeKey = `/${withoutExtension}`;
          return [routeKey, `app/${withoutExtension}.js`];
        }),
      );
      generatedAppPathsManifest['/_not-found/page'] = 'app/_not-found/page.js';
      const existingAppPathsManifest = readJsonIfExists(appPathsManifestPath) || {};
      if (!shallowEqualObject(existingAppPathsManifest, generatedAppPathsManifest)) {
        writeJson(appPathsManifestPath, generatedAppPathsManifest);
      }

      const existing = readJsonIfExists(appPathRoutesManifestPath) || {};
      const generatedRoutesManifest = Object.fromEntries(
        Object.keys(generatedAppPathsManifest)
          .map((routeKey) => {
            const normalized = normalizeAppRoute(routeKey);
            return normalized ? [routeKey, normalized] : null;
          })
          .filter(Boolean),
      );
      const mergedRoutesManifest = mergeManifest(existing, generatedRoutesManifest);
      if (mergedRoutesManifest.changed) {
        writeJson(appPathRoutesManifestPath, mergedRoutesManifest.data);
      }
    }
  }

  if (fs.existsSync(srcPagesDir)) {
    const pageSourceFiles = walkFiles(srcPagesDir)
      .filter((filePath) => /\.(t|j)sx?$/.test(filePath));

    if (pageSourceFiles.length > 0) {
      const existing = readJsonIfExists(pagesManifestPath) || {};
      const generated = Object.fromEntries(
        pageSourceFiles.map((filePath) => {
          const relativePath = path.relative(srcPagesDir, filePath).split(path.sep).join('/');
          const withoutExtension = relativePath.replace(/\.(t|j)sx?$/, '');
          return [`/${withoutExtension}`, `pages/${withoutExtension}.js`];
        }),
      );
      const mergedPagesManifest = mergeManifest(existing, generated);
      if (mergedPagesManifest.changed) {
        writeJson(pagesManifestPath, mergedPagesManifest.data);
      }
    }
  }
}

fs.rmSync(nextDir, { recursive: true, force: true });

// We no longer seed manifests BEFORE the build, as it causes Next.js
// 'Collecting page data' to fail when it sees routes in the manifest 
// that haven't been compiled yet.
// The AppPathRoutesManifestPlugin in next.config.ts handles this safely 
// during the build process.

const buildProc = spawn('pnpm', ['exec', 'next', 'build'], {
  cwd: platformDir,
  env: desktopBuildEnv,
  stdio: 'inherit',
});

buildProc.on('exit', (code, signal) => {
  // Final repair after build finishes
  repairManifests();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code === 0) {
    // Next.js standalone output does NOT auto-copy static assets.
    // Copy .next/static and public/ so the browser can load JS bundles.
    const standaloneDir = path.join(nextDir, 'standalone', 'surfaces', 'allternit-platform');
    const staticSrc = path.join(nextDir, 'static');
    const staticDst = path.join(standaloneDir, '.next', 'static');
    const publicSrc = path.join(platformDir, 'public');
    const publicDst = path.join(standaloneDir, 'public');

    if (fs.existsSync(staticSrc)) {
      fs.cpSync(staticSrc, staticDst, { recursive: true, force: true });
    }
    if (fs.existsSync(publicSrc)) {
      fs.cpSync(publicSrc, publicDst, { recursive: true, force: true });
    }
  }

  process.exit(code ?? 1);
});
