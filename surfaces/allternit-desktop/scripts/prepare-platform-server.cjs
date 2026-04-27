#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const platformDir = path.join(repoRoot, 'surfaces', 'allternit-platform');
const resourcesDir = path.join(desktopDir, 'resources', 'platform-server');
const standaloneDir = path.join(platformDir, '.next', 'standalone');
const staticDir = path.join(platformDir, '.next', 'static');
const publicDir = path.join(platformDir, 'public');

function log(message) {
  process.stdout.write(`[prepare-platform-server] ${message}\n`);
}

function copyIntoResources(sourcePath, destinationPath, { contentsOnly = false } = {}) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  log(`Copying ${sourcePath} to ${destinationPath} (dereferencing symlinks${contentsOnly ? ', contents only' : ''})`);

  if (contentsOnly) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      const entrySource = path.join(sourcePath, entry);
      const entryDestination = path.join(destinationPath, entry);
      try {
        execFileSync('cp', ['-R', '-L', entrySource, entryDestination]);
      } catch (err) {
        log(`Warning: Shell cp failed for ${entrySource}, falling back to fs.cpSync: ${err.message}`);
        fs.cpSync(entrySource, entryDestination, {
          recursive: true,
          dereference: true,
          force: true,
        });
      }
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  try {
    execFileSync('cp', ['-R', '-L', sourcePath, destinationPath]);
  } catch (err) {
    log(`Warning: Shell cp failed, falling back to fs.cpSync: ${err.message}`);
    fs.cpSync(sourcePath, destinationPath, {
      recursive: true,
      dereference: true,
      force: true,
    });
  }
}

function packageNameFromPath(packagePath) {
  const baseName = path.basename(packagePath);
  if (baseName.startsWith('@')) {
    return null;
  }
  return baseName;
}

function materializePnpmPackages(nodeModulesDir) {
  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    return;
  }

  log(`Materializing pnpm package links in ${nodeModulesDir}`);

  for (const storeEntry of fs.readdirSync(pnpmDir)) {
    const storeNodeModules = path.join(pnpmDir, storeEntry, 'node_modules');
    if (!fs.existsSync(storeNodeModules)) {
      continue;
    }

    for (const entry of fs.readdirSync(storeNodeModules)) {
      const entryPath = path.join(storeNodeModules, entry);
      if (entry.startsWith('@')) {
        const scopeDir = path.join(nodeModulesDir, entry);
        fs.mkdirSync(scopeDir, { recursive: true });
        for (const scopedEntry of fs.readdirSync(entryPath)) {
          const sourcePath = path.join(entryPath, scopedEntry);
          const destinationPath = path.join(scopeDir, scopedEntry);
          if (!fs.existsSync(destinationPath)) {
            fs.cpSync(sourcePath, destinationPath, {
              recursive: true,
              dereference: true,
              force: true,
            });
          }
        }
        continue;
      }

      const packageName = packageNameFromPath(entryPath);
      if (!packageName) {
        continue;
      }

      const destinationPath = path.join(nodeModulesDir, packageName);
      if (!fs.existsSync(destinationPath)) {
        fs.cpSync(entryPath, destinationPath, {
          recursive: true,
          dereference: true,
          force: true,
        });
      }
    }
  }
}

if (process.env.ALLTERNIT_SKIP_PLATFORM_SERVER === '1') {
  log('Skipping platform server build because ALLTERNIT_SKIP_PLATFORM_SERVER=1');
  process.exit(0);
}

log(`Building standalone platform server from ${platformDir}`);
execFileSync(
  'pnpm',
  ['--dir', repoRoot, '--filter', 'allternit_platform', 'build:desktop-server'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ALLTERNIT_BUILD_MODE: 'desktop',
      ALLTERNIT_DESKTOP_AUTH_ENABLED: '1',
      NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH: '1',
      ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
      NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
    },
  }
);

if (!fs.existsSync(standaloneDir)) {
  throw new Error(`Standalone output not found at ${standaloneDir}`);
}

log(`Refreshing ${resourcesDir}`);
fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(resourcesDir, { recursive: true });

copyIntoResources(standaloneDir, resourcesDir, { contentsOnly: true });
copyIntoResources(staticDir, path.join(resourcesDir, '.next', 'static'));
copyIntoResources(publicDir, path.join(resourcesDir, 'public'));

// Explicitly copy prisma/data directory for bundled sqlite DB
const prismaDataDir = path.join(platformDir, 'prisma', 'data');
if (fs.existsSync(prismaDataDir)) {
  log(`Copying prisma/data from ${prismaDataDir}`);
  copyIntoResources(prismaDataDir, path.join(resourcesDir, 'prisma', 'data'));
}

// Copy Drizzle SQLite migrations so instrumentation.ts can apply them at startup.
// instrumentation.ts checks {cwd}/migrations-sqlite before the source tree path.
const drizzleMigrationsDir = path.join(platformDir, 'src', 'lib', 'db', 'migrations-sqlite');
if (fs.existsSync(drizzleMigrationsDir)) {
  log(`Copying Drizzle migrations from ${drizzleMigrationsDir}`);
  copyIntoResources(drizzleMigrationsDir, path.join(resourcesDir, 'migrations-sqlite'));
} else {
  log('Warning: Drizzle migrations folder not found — skipping');
}

materializePnpmPackages(path.join(resourcesDir, 'node_modules'));

log('Platform server resources are ready for packaging');
