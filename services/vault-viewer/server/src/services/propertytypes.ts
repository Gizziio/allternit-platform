import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getVaultRoot } from './vault.js';

/**
 * Obsidian stores per-vault property type assignments in `.obsidian/types.json`
 * ({ "types": { "<key>": "<type>" } } with types text|multitext|number|checkbox|
 * date|datetime|tags|aliases). We read/write the same file so WebObsidian's
 * property types interoperate with the Obsidian app.
 */

async function typesFile(): Promise<string> {
  return path.join(await getVaultRoot(), '.obsidian', 'types.json');
}

export async function readPropertyTypes(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(await typesFile(), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data.types === 'object' ? (data.types as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setPropertyType(key: string, type: string): Promise<Record<string, string>> {
  const file = await typesFile();
  let data: { types: Record<string, string> } = { types: {} };
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (parsed && typeof parsed === 'object') data = { ...parsed, types: { ...(parsed.types ?? {}) } };
  } catch {
    /* no existing file */
  }
  data.types[key] = type;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  return data.types;
}
