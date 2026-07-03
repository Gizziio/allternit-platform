/**
 * Local DESIGN.md resolver — ported from nexu-io/open-design.
 *
 * Resolves a DESIGN.md from a user-selected file or directory using the File
 * System Access API. Parses the 9-section awesome-claude-design schema and
 * returns a normalized DesignSystem-shaped record.
 */

import { DESIGN_SYSTEMS_LIBRARY } from './design-systems-library';
import type { DesignSystem } from './design-registry';

const SECTIONS = [
  'Visual Theme & Atmosphere',
  'Color Palette & Roles',
  'Typography Rules',
  'Component Stylings',
  'Layout Principles',
  'Depth & Elevation',
  "Do's and Don'ts",
  'Responsive Behavior',
  'Agent Prompt Guide',
];

export interface ResolvedDesignSystem {
  id: string;
  title: string;
  body: string;
}

function inferTitle(body: string, filename: string): string {
  const firstLine = body.split('\n')[0]?.replace(/^#+\s*/, '').trim();
  if (firstLine && firstLine.length < 80) return firstLine;
  return filename.replace(/\.md$/i, '');
}

function extractSwatches(body: string): string[] {
  const hexPattern = /#([0-9a-fA-F]{3}){1,2}\b/g;
  const matches = body.match(hexPattern) ?? [];
  return Array.from(new Set(matches)).slice(0, 6);
}

export function parseDesignSystemBody(body: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  let current = '';
  const buffer: string[] = [];

  for (const line of body.split('\n')) {
    const sectionMatch = SECTIONS.find((s) => line.trim().startsWith(`## ${s}`));
    if (sectionMatch) {
      if (current) parsed[current] = buffer.join('\n').trim();
      current = sectionMatch;
      buffer.length = 0;
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) parsed[current] = buffer.join('\n').trim();
  return parsed;
}

export async function resolveDesignSystemFromFile(): Promise<ResolvedDesignSystem | null> {
  if (typeof window === 'undefined' || !('showOpenFilePicker' in window)) {
    return null;
  }

  const picker = await (window as unknown as Window & { showOpenFilePicker(opts?: unknown): Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
    types: [{ description: 'DESIGN.md', accept: { 'text/markdown': ['.md'] } }],
    multiple: false,
  });
  const fileHandle = picker[0];
  const file = await fileHandle.getFile();
  const body = await file.text();
  const title = inferTitle(body, file.name);
  return { id: `local-${Date.now()}`, title, body };
}

export async function resolveDesignSystemFromDirectory(): Promise<ResolvedDesignSystem | null> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return null;
  }

  const dirHandle = await (window as unknown as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();

  // Look for DESIGN.md in root, then design-system/DESIGN.md
  const candidates = ['DESIGN.md', 'design-system/DESIGN.md'];
  for (const candidate of candidates) {
    try {
      const parts = candidate.split('/');
      let current: FileSystemDirectoryHandle = dirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }
      const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      const body = await file.text();
      const title = inferTitle(body, file.name);
      return { id: `local-${Date.now()}`, title, body };
    } catch {
      // continue to next candidate
    }
  }
  return null;
}

export function resolvedDesignToDesignSystem(resolved: ResolvedDesignSystem): DesignSystem {
  const swatches = extractSwatches(resolved.body);
  return {
    id: resolved.id,
    name: resolved.title,
    description: 'Local DESIGN.md resolved from filesystem',
    vibe: 'Local',
    author: 'local',
    installs: 0,
    likes: 0,
    views: 0,
    forks: 0,
    tags: ['local', 'design-system'],
    designMd: resolved.body,
    previewColors: swatches.length > 0 ? swatches : ['#111111', '#ffffff', '#888888'],
  };
}
