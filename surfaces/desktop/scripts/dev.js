#!/usr/bin/env node
/**
 * Development script for Allternit Desktop
 * Runs Electron in dev mode with hot reload
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let electronProcess = null;

async function startElectron() {
  console.log('[Dev] Starting Electron...');
  
  // Copy static files first
  const copy = spawn('cp', ['-r', 'static', 'dist/'], {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
  });
  
  await new Promise((resolve) => copy.on('close', resolve));
  
  electronProcess = spawn('electron', ['.', '--remote-debugging-port=9223'], {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  electronProcess.on('close', (code) => {
    console.log(`[Dev] Electron exited with code ${code}`);
    process.exit(code);
  });
}

function cleanup() {
  console.log('[Dev] Cleaning up...');
  if (electronProcess) {
    electronProcess.kill();
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startElectron();
