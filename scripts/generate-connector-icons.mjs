#!/usr/bin/env node
/**
 * Generate local connector brand icons for every sidecar provider.
 *
 * Strategy:
 * 1. Prefer existing icons in public/icons/connectors (never overwrite).
 * 2. Try simple-icons by sidecar service id, then by displayName/title.
 * 3. Fall back to a favicon fetched from the provider homepage domain.
 *
 * Outputs:
 * - public/icons/connectors/<service>.{svg,png}
 * - surfaces/ai.allternit.com/src/lib/design/connector-icon-map.ts
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";
import * as simpleIcons from "simple-icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG_DIR = path.join(ROOT, "services", "open-connector", "catalog", "apps");
if (!fs.existsSync(CATALOG_DIR)) {
  console.error("Sidecar catalog not found:", CATALOG_DIR);
  process.exit(1);
}
const ICONS_DIR = path.join(ROOT, "surfaces", "ai.allternit.com", "public", "icons", "connectors");
const MAP_FILE = path.join(ROOT, "surfaces", "ai.allternit.com", "src", "lib", "design", "connector-icon-map.ts");

// Build simple-icons lookup maps.
const allIcons = Object.values(simpleIcons).filter((i) => i && i.slug);
const bySlug = new Map(allIcons.map((i) => [i.slug.toLowerCase(), i]));
const byTitle = new Map(allIcons.map((i) => [i.title.toLowerCase(), i]));

function normalizeSlug(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findSimpleIcon(service, displayName) {
  const svc = service.toLowerCase();
  if (bySlug.has(svc)) return bySlug.get(svc);
  const normSvc = normalizeSlug(service);
  for (const [k, v] of bySlug) {
    if (k === normSvc || k === svc.replace(/_/g, "")) return v;
  }
  const title = displayName.toLowerCase();
  if (byTitle.has(title)) return byTitle.get(title);
  const normTitle = normalizeTitle(displayName);
  for (const [k, v] of byTitle) {
    if (k === normTitle) return v;
  }
  return null;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(new URL(res.headers.location, url).toString()).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFavicon(homepageUrl) {
  let hostname;
  try {
    hostname = new URL(homepageUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  // Try a few favicon services; first success wins.
  const urls = [
    `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(hostname)}`,
    `https://api.faviconkit.com/${hostname}/128`,
    `https://logo.clearbit.com/${hostname}`,
  ];
  for (const url of urls) {
    try {
      const buf = await fetchBuffer(url);
      if (buf && buf.length > 100) return buf;
    } catch {
      // try next
    }
  }
  return null;
}

function svgWithFill(svg, hex) {
  // Ensure SVG has a fill color; simple-icons exports monochrome paths.
  if (svg.includes("fill=")) return svg;
  return svg.replace(/<svg /, `<svg fill="#${hex}" `);
}

// Gather sidecar providers.
const files = fs.readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
const providers = files
  .map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, f), "utf8"));
    return { service: p.service, displayName: p.displayName, homepageUrl: p.homepageUrl };
  })
  .filter((p) => p.service)
  .sort((a, b) => a.service.localeCompare(b.service));

console.log(`Sidecar providers: ${providers.length}`);

const manifest = {};
let added = 0;
let skipped = 0;
let failed = 0;

for (const p of providers) {
  const service = p.service;
  const existing = fs.readdirSync(ICONS_DIR).find((f) => path.parse(f).name === service);
  if (existing) {
    manifest[service] = existing;
    skipped++;
    continue;
  }

  const icon = findSimpleIcon(service, p.displayName);
  if (icon) {
    const out = path.join(ICONS_DIR, `${service}.svg`);
    const svg = svgWithFill(icon.svg, icon.hex || "000000");
    fs.writeFileSync(out, svg);
    manifest[service] = `${service}.svg`;
    added++;
    continue;
  }

  // Favicon fallback.
  const buf = await getFavicon(p.homepageUrl);
  if (buf) {
    const out = path.join(ICONS_DIR, `${service}.png`);
    fs.writeFileSync(out, buf);
    manifest[service] = `${service}.png`;
    added++;
  } else {
    failed++;
    console.warn(`No icon for ${service} (${p.displayName})`);
  }

  // Be polite to favicon services.
  await sleep(20);
}

// Also ensure every existing icon in the directory is represented.
for (const f of fs.readdirSync(ICONS_DIR)) {
  const name = path.parse(f).name;
  if (!manifest[name]) manifest[name] = f;
}

console.log(`Added: ${added}, skipped existing: ${skipped}, failed: ${failed}`);

// Write the manifest.
const lines = [
  "// Auto-generated connector icon manifest.",
  "// Sources: simple-icons v11 and official site favicons.",
  "export const CONNECTOR_ICON_FILES: Record<string, string> = {",
];
for (const key of Object.keys(manifest).sort()) {
  lines.push(`  "${key}": "${manifest[key]}",`);
}
lines.push("};");
lines.push("");
fs.writeFileSync(MAP_FILE, lines.join("\n"));
console.log(`Wrote ${MAP_FILE}`);
