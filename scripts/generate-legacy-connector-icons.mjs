#!/usr/bin/env node
/**
 * Add brand icons for legacy catalog connectors that are not backed by the
 * open-connector sidecar. Uses simple-icons when available, otherwise falls
 * back to the provider's homepage favicon.
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";
import * as simpleIcons from "simple-icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG_FILE = path.join(ROOT, "cmd", "allternit-api", "assets", "open-design", "connectors.json");
const ICONS_DIR = path.join(ROOT, "surfaces", "ai.allternit.com", "public", "icons", "connectors");
const MAP_FILE = path.join(ROOT, "surfaces", "ai.allternit.com", "src", "lib", "design", "connector-icon-map.ts");

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
const allIcons = Object.values(simpleIcons).filter((i) => i && i.slug);
const bySlug = new Map(allIcons.map((i) => [i.slug.toLowerCase(), i]));
const byTitle = new Map(allIcons.map((i) => [i.title.toLowerCase(), i]));

function normalizeSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findSimpleIcon(id, name) {
  const idl = id.toLowerCase();
  if (bySlug.has(idl)) return bySlug.get(idl);
  const norm = normalizeSlug(id);
  for (const [k, v] of bySlug) {
    if (k === norm) return v;
  }
  const namel = name.toLowerCase();
  if (byTitle.has(namel)) return byTitle.get(namel);
  const normTitle = normalizeSlug(name);
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

async function getFavicon(name) {
  // Try common domain guesses based on the connector name.
  const domains = [
    `${name}.com`,
    `${name}.io`,
    `${name}.co`,
    `${name}.app`,
    `${name}.net`,
    `www.${name}.com`,
  ];
  for (const domain of domains) {
    try {
      const url = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
      const buf = await fetchBuffer(url);
      if (buf && buf.length > 100) return buf;
    } catch {
      // continue
    }
  }
  return null;
}

function svgWithFill(svg, hex) {
  if (svg.includes("fill=")) return svg;
  return svg.replace(/<svg /, `<svg fill="#${hex}" `);
}

// Read current manifest.
const manifestSrc = fs.readFileSync(MAP_FILE, "utf8");
const manifestMatch = manifestSrc.match(/export const CONNECTOR_ICON_FILES: Record<string, string> = \{([\s\S]*?)\};/);
const manifest = {};
if (manifestMatch) {
  const entries = manifestMatch[1].match(/"[^"]+":\s*"[^"]+"/g) || [];
  for (const e of entries) {
    const [k, v] = e.split(":").map((s) => s.trim().replace(/"/g, ""));
    manifest[k] = v;
  }
}

let added = 0;
let skipped = 0;
let failed = 0;

for (const c of catalog.connectors) {
  const id = c.id;
  if (manifest[id]) {
    skipped++;
    continue;
  }
  const icon = findSimpleIcon(id, c.name);
  if (icon) {
    const out = path.join(ICONS_DIR, `${id}.svg`);
    fs.writeFileSync(out, svgWithFill(icon.svg, icon.hex || "000000"));
    manifest[id] = `${id}.svg`;
    added++;
    continue;
  }
  const buf = await getFavicon(id);
  if (buf) {
    const out = path.join(ICONS_DIR, `${id}.png`);
    fs.writeFileSync(out, buf);
    manifest[id] = `${id}.png`;
    added++;
  } else {
    failed++;
    console.warn(`No icon for legacy ${id} (${c.name})`);
  }
  await sleep(20);
}

console.log(`Legacy added: ${added}, skipped: ${skipped}, failed: ${failed}`);

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
