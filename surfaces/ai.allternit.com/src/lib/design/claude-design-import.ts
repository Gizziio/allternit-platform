/**
 * Claude Design ZIP import — ported from nexu-io/open-design.
 *
 * Accepts a ZIP file exported from Claude Design, extracts the artifact
 * HTML, DESIGN.md, and any conversation metadata, and returns a normalized
 * import payload.
 */

import JSZip from 'jszip';
import { resolvedDesignToDesignSystem, type ResolvedDesignSystem } from './design-system-resolver';
import type { DesignSystem } from './design-registry';

export interface ClaudeDesignImportResult {
  html?: string;
  title?: string;
  designSystem?: DesignSystem;
  conversation?: unknown;
}

function findFileInsensitive(files: Record<string, JSZip.JSZipObject>, name: string): JSZip.JSZipObject | undefined {
  const lower = name.toLowerCase();
  const key = Object.keys(files).find((k) => k.split('/').pop()?.toLowerCase() === lower);
  return key ? files[key] : undefined;
}

export async function importClaudeDesignZip(file: File): Promise<ClaudeDesignImportResult> {
  const zip = await JSZip.loadAsync(file);
  const files = zip.files;

  // Artifact HTML
  const htmlFile = findFileInsensitive(files, 'index.html') ?? findFileInsensitive(files, 'artifact.html');
  const html = htmlFile ? await htmlFile.async('text') : undefined;

  // DESIGN.md
  const designFile = findFileInsensitive(files, 'DESIGN.md') ?? findFileInsensitive(files, 'design.md');
  let designSystem: DesignSystem | undefined;
  if (designFile) {
    const body = await designFile.async('text');
    const title = body.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Imported DESIGN.md';
    const resolved: ResolvedDesignSystem = { id: `claude-design-${Date.now()}`, title, body };
    designSystem = resolvedDesignToDesignSystem(resolved);
  }

  // Conversation metadata
  const conversationFile = findFileInsensitive(files, 'conversation.json') ?? findFileInsensitive(files, 'messages.json');
  const conversation = conversationFile ? JSON.parse(await conversationFile.async('text')) : undefined;

  // Title from manifest or first heading
  const manifestFile = findFileInsensitive(files, 'manifest.json');
  let title: string | undefined;
  if (manifestFile) {
    const manifest = JSON.parse(await manifestFile.async('text')) as Record<string, unknown>;
    title = manifest.title ? String(manifest.title) : undefined;
  }
  if (!title && html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    title = doc.querySelector('title')?.textContent?.trim() ?? doc.querySelector('h1')?.textContent?.trim();
  }

  return { html, title, designSystem, conversation };
}
