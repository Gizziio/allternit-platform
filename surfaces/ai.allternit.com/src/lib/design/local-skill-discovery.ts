/**
 * Local skill discovery via the File System Access API.
 *
 * Lets the user pick a local directory (e.g. `~/.claude/skills/` or a project
 * `./skills/` folder) and scans it for `SKILL.md` files. Parsed skills are
 * returned in-memory and can be merged with the bundled catalog.
 *
 * Falls back gracefully if the API is unavailable (non-secure context, mobile
 * Safari, etc.).
 */

import { parseSkillMarkdown, type SkillRecord } from './skill-registry';

export interface LocalSkillDiscoveryResult {
  skills: SkillRecord[];
  errors: string[];
}

async function scanDirectoryForSkills(
  dirHandle: FileSystemDirectoryHandle,
  path = '',
): Promise<{ sources: { id: string; source: string; assets: string[] }[]; errors: string[] }> {
  const sources: { id: string; source: string; assets: string[] }[] = [];
  const errors: string[] = [];

  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      const nested = await scanDirectoryForSkills(entry as FileSystemDirectoryHandle, entryPath);
      sources.push(...nested.sources);
      errors.push(...nested.errors);
    } else if (entry.kind === 'file' && entry.name.toLowerCase() === 'skill.md') {
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        const source = await file.text();
        const id = path.split('/').pop() ?? entryPath.replace(/\//g, '-');
        sources.push({ id, source, assets: [] });
      } catch (err) {
        errors.push(`Failed to read ${entryPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { sources, errors };
}

export async function discoverLocalSkills(): Promise<LocalSkillDiscoveryResult> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return { skills: [], errors: ['File System Access API is not available in this browser.'] };
  }

  try {
    const dirHandle = await (window as unknown as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const { sources, errors } = await scanDirectoryForSkills(dirHandle);
    const skills = sources.map((s) => parseSkillMarkdown(s.id, s.source, s.assets));
    return { skills, errors };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { skills: [], errors: [] };
    }
    return { skills: [], errors: [err instanceof Error ? err.message : String(err)] };
  }
}
