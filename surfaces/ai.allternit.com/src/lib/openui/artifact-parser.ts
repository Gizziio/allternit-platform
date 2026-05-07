/**
 * Artifact Parser
 *
 * Parses <artifact type="text/html" identifier="..." title="...">...</artifact>
 * blocks emitted by the Studio design agent. Splits a raw message string into
 * interleaved text and artifact segments.
 */

export interface ParsedArtifact {
  type: string;
  identifier: string;
  title: string;
  content: string;
}

export type MessageSegment =
  | { kind: 'text'; content: string }
  | { kind: 'artifact'; artifact: ParsedArtifact };

// Matches opening tag with optional attributes in any order.
const ARTIFACT_RE =
  /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/gi;

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w-]*)=["']([^"']*)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

export function splitOnArtifacts(input: string): MessageSegment[] {
  if (!input) return [];

  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  ARTIFACT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = ARTIFACT_RE.exec(input)) !== null) {
    const matchStart = m.index;
    const matchEnd = matchStart + m[0].length;

    if (matchStart > lastIndex) {
      const text = input.slice(lastIndex, matchStart);
      if (text.trim()) segments.push({ kind: 'text', content: text });
    }

    const attrs = parseAttrs(m[1]);
    segments.push({
      kind: 'artifact',
      artifact: {
        type: attrs['type'] ?? 'text/html',
        identifier: attrs['identifier'] ?? attrs['id'] ?? 'artifact',
        title: attrs['title'] ?? 'Artifact',
        content: m[2].trim(),
      },
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text.trim()) segments.push({ kind: 'text', content: text });
  }

  return segments;
}

export function extractFirstArtifact(input: string): ParsedArtifact | null {
  ARTIFACT_RE.lastIndex = 0;
  const m = ARTIFACT_RE.exec(input);
  if (!m) return null;
  const attrs = parseAttrs(m[1]);
  return {
    type: attrs['type'] ?? 'text/html',
    identifier: attrs['identifier'] ?? attrs['id'] ?? 'artifact',
    title: attrs['title'] ?? 'Artifact',
    content: m[2].trim(),
  };
}
