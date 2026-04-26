#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const REGISTRY_BASE = "https://agent-elements.21st.dev/r";
const ROOT = process.cwd();
const TARGET_PREFIX = "src/";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function toTargetPath(target) {
  if (target.startsWith("components/")) {
    return path.join(ROOT, TARGET_PREFIX, target);
  }

  return path.join(ROOT, target);
}

async function writeRegistryFile(file) {
  const targetPath = toTargetPath(file.target);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, file.content, "utf8");
  return path.relative(ROOT, targetPath);
}

async function main() {
  const index = await fetchJson(`${REGISTRY_BASE}/index.json`);
  const names = index.items.map((item) => item.name);
  const written = new Set();

  for (const name of names) {
    const item = await fetchJson(`${REGISTRY_BASE}/${name}.json`);
    for (const file of item.files ?? []) {
      const relativePath = await writeRegistryFile(file);
      written.add(relativePath);
    }
  }

  console.log(`Imported ${names.length} registry items.`);
  console.log(`Wrote ${written.size} files under src/components/agent-elements.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
