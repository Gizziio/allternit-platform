#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const resourcesDir = path.join(desktopDir, 'resources', 'gateway-runtime');

const copies = [
  ['services/gateway/service', 'services/gateway/service'],
  ['infrastructure/gateway', 'infrastructure/gateway'],
  ['spec/Contracts', 'spec/Contracts'],
  ['ui/ui_registry.json', 'ui/ui_registry.json'],
];

function shouldCopyPath(sourcePath) {
  const baseName = path.basename(sourcePath);
  if (baseName === '.venv' || baseName === '__pycache__' || baseName === '.pytest_cache') {
    return false;
  }

  if (baseName.endsWith('.pyc') || baseName.endsWith('.pyo')) {
    return false;
  }

  return true;
}

function copyPath(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    dereference: true,
    force: true,
    filter: shouldCopyPath,
  });
}

fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(resourcesDir, { recursive: true });

for (const [sourceRelative, destinationRelative] of copies) {
  const sourcePath = path.join(repoRoot, sourceRelative);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }

  copyPath(sourcePath, path.join(resourcesDir, destinationRelative));
}

// Bundle dependencies
const gatewayServiceDir = path.join(repoRoot, 'services', 'gateway', 'service');
const requirementsFile = path.join(gatewayServiceDir, 'requirements.txt');
if (fs.existsSync(requirementsFile)) {
  const targetLib = path.join(resourcesDir, 'lib');
  fs.mkdirSync(targetLib, { recursive: true });
  process.stdout.write(`[prepare-gateway-runtime] Installing dependencies to ${targetLib}...\n`);
  try {
    const pip = process.platform === 'win32' ? 'pip' : 'pip3';
    execFileSync(pip, ['install', '-r', requirementsFile, '--target', targetLib, '--only-binary=:all:'], { stdio: 'inherit' });
  } catch (err) {
    process.stdout.write(`[prepare-gateway-runtime] Warning: Failed to install dependencies via pip: ${err.message}\n`);
  }
}

process.stdout.write(`[prepare-gateway-runtime] Gateway runtime staged at ${resourcesDir}\n`);
