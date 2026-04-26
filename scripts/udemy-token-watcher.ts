#!/usr/bin/env tsx
/**
 * Udemy Token Watcher for Chrome
 *
 * 1. Opens real Google Chrome to Udemy
 * 2. Polls Chrome's cookie database every 3 seconds
 * 3. As soon as access_token appears, decrypts and saves it
 * 4. Optionally continues to run the download pipeline
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_COOKIE_PATH = path.join(
  os.homedir(),
  'Library/Application Support/Google/Chrome/Default/Cookies'
);
const TOKEN_FILE = path.join(os.homedir(), '.udemy-token');
const PYTHON_SCRIPT = path.join(__dirname, 'extract-udemy-token.py');

function extractToken(): string | undefined {
  try {
    const output = execSync(`python3 "${PYTHON_SCRIPT}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const token = output.trim();
    if (token && !token.startsWith('No access_token') && !token.startsWith('Failed')) {
      return token;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function saveToken(token: string) {
  fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  console.log(`\n✅ Token saved to ${TOKEN_FILE}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Udemy Token Watcher (Chrome)                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check if token already exists
  const existing = extractToken();
  if (existing) {
    console.log('Token already found in Chrome cookies!');
    saveToken(existing);
    console.log('\nYou can now run:');
    console.log('  tsx scripts/udemy-pipeline.ts');
    process.exit(0);
  }

  // Open Chrome to Udemy
  console.log('Opening Google Chrome to https://www.udemy.com/join/login-popup/ ...\n');
  spawn('open', ['-a', 'Google Chrome', 'https://www.udemy.com/join/login-popup/'], {
    detached: true,
    stdio: 'ignore',
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ACTION REQUIRED:');
  console.log('1. Log in to Udemy in the Chrome tab that just opened');
  console.log('2. Once logged in, this script will automatically detect it');
  console.log('3. Press Ctrl+C to cancel at any time');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let attempts = 0;
  const maxAttempts = 600; // 30 minutes

  const interval = setInterval(() => {
    attempts++;
    const token = extractToken();

    if (token) {
      clearInterval(interval);
      saveToken(token);
      console.log('\n🎉 Token acquired! You can now run:');
      console.log('  tsx scripts/udemy-pipeline.ts');
      console.log('\nOr if you want to do it all in one go:');
      console.log('  tsx scripts/udemy-pipeline.ts --token "' + token + '"');
      process.exit(0);
    }

    if (attempts % 10 === 0) {
      console.log(`Still waiting... (${attempts * 3}s elapsed)`);
    }

    if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.error('\n⏰ Timed out waiting for login. Please try again.');
      process.exit(1);
    }
  }, 3000);
}

main();
