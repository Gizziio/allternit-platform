import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  Clock,
  File,
  FileCode,
  FileImage,
  FileText,
  Link as LinkIcon,
  Package,
  ShieldCheck,
} from '@phosphor-icons/react';
import { execEvents } from '@/integration/execution/exec.events';
import { filesApi } from '@/lib/agents/files-api';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { Markdown } from '@/components/ai-elements/markdown';
import { artifactFromReference, type CodeArtifact, type CodeArtifactKind } from './artifacts';

export function ArtifactCenter(): React.ReactNode {
  const receipts = useUnifiedStore((state) => state.receipts);
  const fetchReceipts = useUnifiedStore((state) => state.fetchReceipts);
  const [runArtifacts, setRunArtifacts] = useState<CodeArtifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { void fetchReceipts(); }, [fetchReceipts]);
  useEffect(() => {
    const unsubscribe = execEvents.subscribe('onRunComplete', (result) => {
      if (!result.artifacts?.length) return;
      setRunArtifacts((current) => {
        const next = result.artifacts!.map((reference) => artifactFromReference(reference, result.runId));
        return [...current.filter((item) => !next.some((candidate) => candidate.id === item.id)), ...next];
      });
    });
    return unsubscribe;
  }, []);

  const receiptArtifacts = useMemo<CodeArtifact[]>(() => receipts.flatMap((receipt) => {
    const payload = receipt.payload;
    if (!payload || typeof payload !== 'object') return [];
    const record = payload as Record<string, unknown>;
    const references = [record.artifact, record.artifact_url, record.path, record.file]
      .filter((value): value is string => typeof value === 'string');
    return references.map((reference) => ({
      ...artifactFromReference(reference, receipt.run_id),
      id: `${receipt.receipt_id}:${reference}`,
      source: 'receipt' as const,
      receiptId: receipt.receipt_id,
      createdAt: new Date(receipt.timestamp).getTime(),
      metadata: { receipt_kind: receipt.kind },
    }));
  }), [receipts]);

  const artifacts = useMemo(
    () => [...runArtifacts, ...receiptArtifacts].sort((a, b) => b.createdAt - a.createdAt),
    [receiptArtifacts, runArtifacts],
  );
  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];

  useEffect(() => {
    if (!selectedId && artifacts[0]) setSelectedId(artifacts[0].id);
    if (selectedId && !artifacts.some((artifact) => artifact.id === selectedId)) {
      setSelectedId(artifacts[0]?.id ?? null);
    }
  }, [artifacts, selectedId]);

  return (
    <div
      data-testid="artifact-center"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          minHeight: 42,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--glass-bg-thick)',
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--accent-code)',
          }}
        >
          <Package size={14} weight="duotone" />
        </span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Session artifacts</div>
          <div style={{ marginTop: 1, fontSize: 9, color: 'var(--text-tertiary)' }}>
            Files, previews, and evidence produced by this run
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 7px',
            border: '1px solid color-mix(in srgb, var(--status-success) 24%, var(--border-subtle))',
            borderRadius: 6,
            background: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            fontSize: 9,
            fontWeight: 650,
          }}
        >
          <ShieldCheck size={11} weight="fill" />
          Provenance tracked
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {artifacts.length} output{artifacts.length === 1 ? '' : 's'}
        </span>
      </div>

      {artifacts.length === 0 ? (
        <ArtifactEmptyState />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(250px, 0.75fr) minmax(320px, 1.25fr)',
            overflow: 'hidden',
          }}
        >
          <div style={{ minWidth: 0, overflow: 'auto', padding: 7, borderRight: '1px solid var(--border-subtle)' }}>
            {artifacts.map((artifact) => {
              const active = artifact.id === selected?.id;
              return (
                <button
                  type="button"
                  key={artifact.id}
                  onClick={() => setSelectedId(artifact.id)}
                  style={{
                    width: '100%',
                    minHeight: 42,
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '5px 7px',
                    border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
                    borderRadius: 8,
                    background: active ? 'var(--surface-active)' : 'transparent',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: active ? 'inset 2px 0 0 var(--accent-code)' : 'none',
                  }}
                >
                  <ArtifactIcon kind={artifact.kind} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 650 }}>
                      {artifact.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: 'var(--text-tertiary)', fontSize: 9 }}>
                      <span style={{ textTransform: 'capitalize' }}>{artifact.kind}</span>
                      <span>·</span>
                      <span>{artifact.source}</span>
                      <span>·</span>
                      <span>{new Date(artifact.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </span>
                  </span>
                  {artifact.uri && /^https?:\/\//.test(artifact.uri) ? (
                    <ArrowSquareOut size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  ) : null}
                </button>
              );
            })}
          </div>

          {selected && <ArtifactInspector artifact={selected} />}
        </div>
      )}
    </div>
  );
}

function ArtifactEmptyState(): React.ReactNode {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 330, textAlign: 'center' }}>
        <span
          style={{
            width: 42,
            height: 42,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Package size={19} weight="duotone" />
        </span>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 650 }}>No artifacts yet</div>
        <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
          Generated files, previews, reports, and receipts will be indexed here without interrupting your session.
        </div>
        <div
          style={{
            width: 'fit-content',
            margin: '10px auto 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            color: 'var(--text-tertiary)',
            fontSize: 9,
          }}
        >
          <ShieldCheck size={11} />
          Provenance and receipts stay attached
        </div>
      </div>
    </div>
  );
}

const previewPre: React.CSSProperties = {
  margin: 0,
  padding: 10,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

/** Render the artifact itself, not just its location. */
function ArtifactPreview({ artifact }: { artifact: CodeArtifact }): React.ReactNode {
  const isExternal = Boolean(artifact.uri && /^https?:\/\//.test(artifact.uri));
  const isLocalPath = Boolean(artifact.uri && !isExternal);
  // Binary kinds can't come through the text read API.
  const isTextReadable = artifact.kind !== 'image' && artifact.kind !== 'link';
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFileContent(null);
    setLoadError(null);
    if (artifact.content || !isLocalPath || !isTextReadable || !artifact.uri) return;
    let cancelled = false;
    setLoading(true);
    filesApi
      .readFile({ path: artifact.uri })
      .then((res) => {
        if (!cancelled) setFileContent(res.content);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to read artifact file');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);

  const body = artifact.content ?? fileContent;

  if (artifact.kind === 'image') {
    const src = artifact.content?.startsWith('data:')
      ? artifact.content
      : isExternal
        ? artifact.uri
        : null;
    if (src) {
      return (
        <div style={{ padding: 10, textAlign: 'center' }}>
          <img src={src} alt={artifact.name} style={{ maxWidth: '100%', borderRadius: 6 }} />
        </div>
      );
    }
    return <pre style={previewPre}>{`Image on disk — open it from:\n${artifact.uri ?? 'unknown location'}`}</pre>;
  }

  if (artifact.kind === 'link' && artifact.uri) {
    return (
      <iframe
        src={artifact.uri}
        title={artifact.name}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '100%', minHeight: 220, border: 'none', background: '#fff' }}
      />
    );
  }

  if (loading) {
    return <pre style={previewPre}>Loading artifact…</pre>;
  }
  if (loadError) {
    return <pre style={previewPre}>{`Could not load content (${loadError})\nLocation: ${artifact.uri ?? 'unknown'}`}</pre>;
  }
  if (!body) {
    return <pre style={previewPre}>{artifact.uri ?? 'No preview data is available for this artifact.'}</pre>;
  }

  if (artifact.kind === 'html') {
    return (
      <iframe
        srcDoc={body}
        title={artifact.name}
        sandbox=""
        style={{ width: '100%', height: '100%', minHeight: 220, border: 'none', background: '#fff' }}
      />
    );
  }
  if (artifact.kind === 'markdown' || artifact.kind === 'report') {
    return (
      <div style={{ padding: 10, fontSize: 12 }}>
        <Markdown>{body}</Markdown>
      </div>
    );
  }
  if (artifact.kind === 'json') {
    let pretty = body;
    try {
      pretty = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // Not valid JSON — show as-is.
    }
    return <pre style={previewPre}>{pretty}</pre>;
  }
  return <pre style={previewPre}>{body}</pre>;
}

function ArtifactInspector({ artifact }: { artifact: CodeArtifact }): React.ReactNode {
  const isExternal = Boolean(artifact.uri && /^https?:\/\//.test(artifact.uri));

  return (
    <section style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderBottom: '1px solid var(--border-subtle)' }}>
        <ArtifactIcon kind={artifact.kind} large />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700 }}>
            {artifact.name}
          </div>
          <div style={{ marginTop: 3, fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
            {artifact.kind} artifact · {artifact.source} source
          </div>
        </div>
        {isExternal && (
          <a
            href={artifact.uri}
            target="_blank"
            rel="noreferrer"
            style={{
              height: 27,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 8px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              background: 'var(--surface-panel)',
              color: 'var(--text-secondary)',
              fontSize: 9,
              fontWeight: 650,
              textDecoration: 'none',
            }}
          >
            Open
            <ArrowSquareOut size={11} />
          </a>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(70px, 1fr)', gap: 8, padding: 9, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))', gap: 6 }}>
          <Metadata label="Type" value={artifact.kind} />
          <Metadata label="Source" value={artifact.source} />
          <Metadata label="Retention" value={artifact.retention || 'session'} />
          <Metadata
            label="Created"
            value={new Date(artifact.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            icon={<Clock size={9} />}
          />
        </div>

        <div
          style={{
            minHeight: 70,
            overflow: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--surface-panel-muted)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 9 }}>
            {isExternal ? <LinkIcon size={10} /> : <FileText size={10} />}
            Preview
            {artifact.uri ? (
              <span style={{ marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {artifact.uri}
              </span>
            ) : null}
          </div>
          <ArtifactPreview artifact={artifact} />
        </div>
      </div>
    </section>
  );
}

function Metadata({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }): React.ReactNode {
  return (
    <div style={{ minWidth: 0, border: '1px solid var(--border-subtle)', borderRadius: 7, background: 'var(--surface-panel)', padding: '6px 7px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 650, textTransform: 'capitalize' }}>
        {value}
      </div>
    </div>
  );
}

function ArtifactIcon({ kind, large = false }: { kind: CodeArtifactKind; large?: boolean }): React.ReactNode {
  const Icon = kind === 'image'
    ? FileImage
    : kind === 'html' || kind === 'json' || kind === 'diff'
      ? FileCode
      : kind === 'markdown' || kind === 'report'
        ? FileText
        : kind === 'link'
          ? LinkIcon
          : File;
  return (
    <span
      style={{
        width: large ? 34 : 28,
        height: large ? 34 : 28,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        borderRadius: large ? 8 : 7,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-panel)',
        color: 'var(--text-secondary)',
      }}
    >
      <Icon size={large ? 16 : 13} weight="duotone" />
    </span>
  );
}
