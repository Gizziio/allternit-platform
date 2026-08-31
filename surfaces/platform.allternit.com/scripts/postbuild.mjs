import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');

const routes = [
  'dashboard',
  'organizations',
  'compute',
  'devices',
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

// Clerk path-routed sign-in/sign-up navigate to sub-routes such as
// /sign-in/factor-one. Provide an index.html for the root and for the
// common sub-routes so direct loads / reloads boot the SPA with a 200.
const clerkRoutes = [
  'sign-in',
  'sign-in/factor-one',
  'sign-in/factor-two',
  'sign-up',
  'sign-up/verify-email-address',
  'sign-up/continue',
];

for (const route of clerkRoutes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(dist, 'index.html'), join(dir, 'index.html'));
}

// Also provide a 404 fallback so direct links to unknown paths boot the SPA.
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));

console.log(`Copied SPA fallback to ${routes.length + clerkRoutes.length} route directories and 404.html`);
