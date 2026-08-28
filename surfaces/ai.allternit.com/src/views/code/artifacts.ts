export type CodeArtifactKind = 'file' | 'markdown' | 'mdx' | 'html' | 'image' | 'json' | 'diff' | 'report' | 'link' | 'unknown';

export interface CodeArtifact {
  id: string;
  name: string;
  kind: CodeArtifactKind;
  uri?: string;
  content?: string;
  mimeType?: string;
  createdAt: number;
  runId?: string;
  agentId?: string;
  source: 'run' | 'tool' | 'receipt' | 'workspace';
  receiptId?: string;
  retention?: 'session' | 'workspace' | 'shared';
  metadata?: Record<string, unknown>;
}

export function inferArtifactKind(value: string): CodeArtifactKind {
  const clean = value.split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith('.mdx')) return 'mdx';
  if (clean.endsWith('.md')) return 'markdown';
  if (clean.endsWith('.html') || clean.endsWith('.htm')) return 'html';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(clean)) return 'image';
  if (clean.endsWith('.json')) return 'json';
  if (clean.endsWith('.diff') || clean.endsWith('.patch')) return 'diff';
  if (/^https?:\/\//.test(value)) return 'link';
  if (clean.includes('/') || clean.includes('\\')) return 'file';
  return 'unknown';
}

export function artifactFromReference(reference: string, runId?: string): CodeArtifact {
  const parts = reference.split(/[\\/]/);
  return {
    id: `${runId ?? 'run'}:${reference}`,
    name: parts.at(-1) || reference,
    kind: inferArtifactKind(reference),
    uri: reference,
    createdAt: Date.now(),
    runId,
    source: 'run',
    retention: 'session',
  };
}

