#!/usr/bin/env node
/**
 * Turn the dedicated fabric-session Vite build into a root PWA artifact:
 * index.html at `/`, installable manifest, lean public assets only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "dist-fabric-session");
const out = path.join(root, "tmp/fabric-session-pwa");

if (!fs.existsSync(path.join(src, "fabric-session.html"))) {
  throw new Error(`Missing ${src}/fabric-session.html — run vite.fabric-session.config.ts first`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const nextFrom = path.join(from, entry.name);
    const nextTo = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(nextFrom, nextTo);
    else copyFile(nextFrom, nextTo);
  }
}

copyDir(path.join(src, "assets"), path.join(out, "assets"));

let html = fs.readFileSync(path.join(src, "fabric-session.html"), "utf8");
html = html.replace("/fabric-session.webmanifest", "/manifest.webmanifest");
fs.writeFileSync(path.join(out, "index.html"), html);

const manifest = {
  id: "com.allternit.fabric-session",
  name: "Allternit Fabric Session",
  short_name: "Fabric Session",
  description: "Carry your Allternit agents with you across machines.",
  start_url: "/?source=pwa",
  scope: "/",
  display: "standalone",
  background_color: "#FFFFFF",
  theme_color: "#FFFFFF",
  orientation: "portrait-primary",
  icons: [
    {
      src: "/fabric-session-icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/fabric-session-icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};
fs.writeFileSync(path.join(out, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

const publicFiles = [
  "fabric-session-service-worker.js",
  "fabric-session-icon-192.png",
  "fabric-session-icon-512.png",
  "fabric-session-splash-1170x2532.png",
  "favicon.svg",
];
for (const file of publicFiles) {
  const from = path.join(root, "public", file);
  if (fs.existsSync(from)) copyFile(from, path.join(out, file));
}

fs.writeFileSync(
  path.join(out, "_redirects"),
  `# Standalone Fabric Session PWA. Pretty-URLs 308 *.html → extensionless.
/index.html / 308
/fabric-session.html / 308
/fabric-session / 308
/fabric-session/ / 308
/assets/* /assets/:splat 200
/fabric-session-service-worker.js /fabric-session-service-worker.js 200
/manifest.webmanifest /manifest.webmanifest 200
/favicon.svg /favicon.svg 200
/fabric-session-icon-192.png /fabric-session-icon-192.png 200
/fabric-session-icon-512.png /fabric-session-icon-512.png 200
/fabric-session-splash-1170x2532.png /fabric-session-splash-1170x2532.png 200
/* /index.html 200
`,
);

fs.writeFileSync(
  path.join(out, "_headers"),
  `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://allternit.com https://*.allternit.com https://clerk.allternit.com https://clerk.com https://*.clerk.com https://*.clerk.dev https://clerk.accounts.dev https://*.accounts.dev https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://api.allternit.com https://*.allternit.com wss://*.allternit.com https://*.workers.dev https://clerk.allternit.com https://clerk.com https://*.clerk.com https://*.clerk.dev https://clerk.accounts.dev https://*.accounts.dev https://challenges.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.dev https://clerk.accounts.dev https://*.accounts.dev; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'self' https://ai.allternit.com https://*.allternit.com; frame-ancestors 'none'; manifest-src 'self'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), geolocation=(), microphone=(self), display-capture=(self), fullscreen=(self)
  Cache-Control: public, max-age=0, must-revalidate

/
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: public, max-age=3600

/fabric-session-service-worker.js
  Content-Type: application/javascript
  Service-Worker-Allowed: /
  Cache-Control: public, max-age=0, must-revalidate
`,
);

console.log(`Prepared ${out}`);
