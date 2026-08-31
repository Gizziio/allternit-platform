import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');

// sign-in and sign-up are handled by _redirects so Clerk sub-routes
// (e.g. /sign-in/factor-one) return 200 instead of 404.
const routes = [
  'dashboard',
  'organizations',
  'compute',
  'billing',
  'api-keys',
  'docs',
  'settings',
  'pair',
];

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(dist, 'index.html'), join(dir, 'index.html'));
}

// Also provide a 404 fallback so direct links to unknown paths boot the SPA.
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));

console.log(`Copied SPA fallback to ${routes.length} route directories and 404.html`);
