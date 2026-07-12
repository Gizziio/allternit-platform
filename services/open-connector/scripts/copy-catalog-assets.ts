import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourceDir = join(process.cwd(), "catalog/apps");
const targetDir = join(process.cwd(), "dist/web/catalog");
const catalogPath = join(targetDir, "apps.json");

const entries = (await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .sort((a, b) => a.name.localeCompare(b.name));
const providers = entries.map((entry) => entry.name.slice(0, -".json".length));
const apps = await Promise.all(
  entries.map(async (entry) => JSON.parse(await readFile(join(sourceDir, entry.name), "utf8")) as unknown),
);

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

await writeFile(catalogPath, `${JSON.stringify(apps)}\n`);

console.log(`Copied ${providers.length} catalog apps to static assets.`);
