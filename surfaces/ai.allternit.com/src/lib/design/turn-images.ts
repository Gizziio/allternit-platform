/**
 * Turn-image extraction for the design critique panel.
 *
 * A design turn can produce images alongside the HTML artifact: `<artifact
 * type="image/...">` blocks, markdown image embeds in assistant text, and
 * image-tool results carried in `metadata.agentElementsParts`. The critique
 * panel consumes this list to show (and forward) what the panelists review.
 *
 * Pure and defensive: unknown message shapes yield an empty list, blob:/object
 * URLs are skipped (session-local, useless to a reviewer), results are
 * deduped and capped.
 */

import { splitOnArtifacts } from '../openui/artifact-parser';

export interface TurnImageSource {
  /** Where the image was found: artifact block, markdown embed, or agent tool output. */
  source: 'artifact' | 'markdown' | 'tool';
  /** data: URL or http(s) URL ready for <img src> / prompt embedding. */
  url: string;
}

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 3_000_000;

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\s*\)/g;
const DATA_IMAGE_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
const HTTP_URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

/** Tool names whose outputs are treated as image-producing. */
const IMAGE_TOOL_HINT = /image|screenshot|thumbnail|logo|poster/i;

function usable(url: string): boolean {
  if (!url || url.length > MAX_IMAGE_CHARS) return false;
  if (url.startsWith('blob:') || url.startsWith('object:') || url.startsWith('file:')) return false;
  return url.startsWith('data:image/') || url.startsWith('https://') || url.startsWith('http://');
}

interface MessageLike {
  role?: string;
  content?: unknown;
  metadata?: {
    agentElementsParts?: Array<Record<string, unknown>>;
  } & Record<string, unknown>;
}

function fromArtifacts(content: string, out: TurnImageSource[], seen: Set<string>) {
  for (const seg of splitOnArtifacts(content)) {
    if (seg.kind !== 'artifact' || !seg.artifact.type.startsWith('image/')) continue;
    let url = seg.artifact.content.trim();
    // Bare base64 payload → wrap as a data URL with the artifact's MIME type.
    if (!/^(data:|https?:)/.test(url)) {
      url = `data:${seg.artifact.type};base64,${url.replace(/\s+/g, '')}`;
    }
    if (!usable(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ source: 'artifact', url });
  }
}

function fromMarkdown(content: string, out: TurnImageSource[], seen: Set<string>) {
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKDOWN_IMAGE_RE.exec(content)) !== null) {
    const url = m[1];
    if (!usable(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ source: 'markdown', url });
  }
}

function fromToolParts(msg: MessageLike, out: TurnImageSource[], seen: Set<string>) {
  const parts = msg.metadata?.agentElementsParts;
  if (!Array.isArray(parts)) return;
  for (const part of parts) {
    const rawType = String(part?.type ?? '');
    const toolName = rawType.startsWith('tool-') ? rawType.slice(5) : String(part?.toolName ?? rawType);
    if (!IMAGE_TOOL_HINT.test(toolName)) continue;
    const blob = JSON.stringify({ input: part?.input, result: part?.result ?? part?.output });
    const candidates: string[] = [];
    DATA_IMAGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DATA_IMAGE_RE.exec(blob)) !== null) candidates.push(m[0]);
    if (candidates.length === 0) {
      HTTP_URL_RE.lastIndex = 0;
      while ((m = HTTP_URL_RE.exec(blob)) !== null) candidates.push(m[0]);
    }
    for (const url of candidates) {
      if (!usable(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ source: 'tool', url });
      break; // one image per tool part is enough for the critique context
    }
  }
}

/**
 * Extract image URLs produced during the design turn, most recent first.
 * Returns at most MAX_IMAGES entries; never throws.
 */
export function extractTurnImages(messages: MessageLike[]): TurnImageSource[] {
  const out: TurnImageSource[] = [];
  const seen = new Set<string>();
  for (let i = messages.length - 1; i >= 0 && out.length < MAX_IMAGES; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;
    fromToolParts(msg, out, seen);
    if (typeof msg.content !== 'string' || !msg.content) continue;
    fromArtifacts(msg.content, out, seen);
    fromMarkdown(msg.content, out, seen);
  }
  return out.slice(0, MAX_IMAGES);
}
