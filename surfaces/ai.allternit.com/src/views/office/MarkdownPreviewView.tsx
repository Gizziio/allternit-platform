import { useEffect, useRef, useState } from 'react';
import { Check, Copy, DownloadSimple, FloppyDisk } from '@phosphor-icons/react';
import { Markdown } from '@/components/agent-elements/markdown';
import { MdxRenderer } from '@/components/mdx/MdxRenderer';
import { createArtifact } from '@/services/artifacts-api';
import { takeFile } from './file-handoff';

export interface MarkdownPreviewViewProps {
  /**
   * One-shot file handoff from the office launcher: the stashed source bytes
   * are converted via the office engine's anydoc endpoint.
   */
  handoffId?: string;
  /**
   * URL source: fetched and converted via the office engine's
   * /markdown-url endpoint (readability+turndown for HTML, anydoc for
   * document content-types).
   */
  sourceUrl?: string;
}

interface ConversionResult {
  filename: string;
  format: string;
  title: string;
  markdown: string;
  sourceUrl?: string;
}

interface ConversionError {
  status: number;
  error: string;
  detail?: string;
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading'; filename: string }
  | { kind: 'ready'; result: ConversionResult }
  | { kind: 'error'; filename: string; error: ConversionError };

/** Section kind carrying the converted GFM markdown inside the artifact. */
const MARKDOWN_KIND = 'markdown-preview/markdown';

/** Convert the stashed handoff bytes via the office engine's anydoc route. */
async function convertHandoff(name: string, bytes: Uint8Array): Promise<ConversionResult> {
  const response = await fetch('/api/office/markdown', {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-office-filename': name,
    },
    body: bytes as unknown as BodyInit,
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ markdown?: string; format?: string; title?: string; filename?: string } & Partial<ConversionError>)
    | null;
  if (!response.ok) {
    throw {
      status: response.status,
      error: payload?.error ?? 'conversion failed',
      detail: payload?.detail,
    } satisfies ConversionError;
  }
  const markdown = payload?.markdown ?? '';
  return {
    filename: payload?.filename ?? name,
    format: payload?.format ?? name.split('.').pop()?.toLowerCase() ?? '',
    title: payload?.title ?? name,
    markdown,
  };
}

/** Convert a URL via the office engine's /markdown-url route. */
async function convertUrl(url: string): Promise<ConversionResult> {
  const response = await fetch('/api/office/markdown-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ markdown?: string; format?: string; title?: string; sourceUrl?: string } & Partial<ConversionError>)
    | null;
  if (!response.ok) {
    throw {
      status: response.status,
      error: payload?.error ?? 'conversion failed',
      detail: payload?.detail,
    } satisfies ConversionError;
  }
  const sourceUrl = payload?.sourceUrl ?? url;
  return {
    filename: sourceUrl,
    format: payload?.format ?? 'html',
    title: payload?.title ?? sourceUrl,
    markdown: payload?.markdown ?? '',
    sourceUrl,
  };
}

function downloadMarkdown(result: ConversionResult) {
  const isMdx = result.filename.toLowerCase().endsWith('.mdx');
  const base = result.filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_') || 'document';
  const blob = new Blob([result.markdown], { type: isMdx ? 'text/mdx' : 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${base}.${isMdx ? 'mdx' : 'md'}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * "Open as Markdown" preview: converts office documents without a native
 * editor (legacy .doc/.ppt/.xls, ODF, .rtf, .epub, .csv) to GFM markdown
 * through the office engine's anydoc endpoint and renders the result with the
 * platform Markdown component. Layout follows the standard shell-view recipe
 * (same as OfficeLauncherView).
 */
export function MarkdownPreviewView({ handoffId, sourceUrl }: MarkdownPreviewViewProps) {
  const [state, setState] = useState<ViewState>({ kind: 'idle' });
  const [urlInput, setUrlInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // One-shot file handoff from the office launcher (consumed on first render,
  // same pattern as DocsView).
  const handoffConsumedRef = useRef(false);
  const handoffFileRef = useRef<{ name: string; bytes: Uint8Array } | null>(null);
  if (handoffId && !handoffConsumedRef.current) {
    handoffConsumedRef.current = true;
    handoffFileRef.current = takeFile(handoffId) ?? null;
  }

  const openUrl = (url: string) => {
    setState({ kind: 'loading', filename: url });
    convertUrl(url)
      .then((result) => setState({ kind: 'ready', result }))
      .catch((err: ConversionError) => setState({ kind: 'error', filename: url, error: err }));
  };

  useEffect(() => {
    const file = handoffFileRef.current;
    if (!file) return;
    let cancelled = false;
    setState({ kind: 'loading', filename: file.name });
    convertHandoff(file.name, file.bytes)
      .then((result) => {
        if (!cancelled) setState({ kind: 'ready', result });
      })
      .catch((err: ConversionError) => {
        if (!cancelled) setState({ kind: 'error', filename: file.name, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [handoffId]);

  // URL source (context/route state): convert on mount.
  const urlConsumedRef = useRef(false);
  useEffect(() => {
    if (!sourceUrl || urlConsumedRef.current) return;
    urlConsumedRef.current = true;
    openUrl(sourceUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  const copyMarkdown = async (markdown: string) => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAsArtifact = async (result: ConversionResult) => {
    setSaving(true);
    setSaveError(null);
    try {
      const title = result.title || result.filename;
      const artifact = await createArtifact({
        workspaceId: 'default',
        title,
        type: 'document',
        summary: `Markdown conversion of ${result.filename}`,
        tags: ['markdown-preview', result.format],
        sections: [
          {
            heading: title,
            kind: MARKDOWN_KIND,
            body: result.markdown,
            position: 0,
          },
        ],
      });
      setSavedTitle(artifact.title);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto"
      data-testid="markdown-preview"
    >
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              Markdown Preview
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              {state.kind === 'ready' && state.result.sourceUrl
                ? 'Converted from the web — the original page is unchanged.'
                : 'Converted with anydoc — the original file is unchanged.'}
            </p>
          </div>
          {state.kind === 'ready' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyMarkdown(state.result.markdown)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
                data-testid="markdown-preview-copy"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => downloadMarkdown(state.result)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
                data-testid="markdown-preview-download"
              >
                <DownloadSimple size={16} />Download .md
              </button>
              <button
                type="button"
                disabled={saving || savedTitle != null}
                onClick={() => void saveAsArtifact(state.result)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50"
                data-testid="markdown-preview-save-artifact"
              >
                <FloppyDisk size={16} />
                {savedTitle ? 'Saved as artifact' : saving ? 'Saving…' : 'Save as artifact'}
              </button>
            </div>
          )}
        </div>

        {state.kind === 'idle' && (
          <div className="mt-8" data-testid="markdown-preview-empty">
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Open a file from Allternit Office, or convert a web page to Markdown:
            </p>
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const url = urlInput.trim();
                if (url) openUrl(url);
              }}
            >
              <input
                type="url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://example.com/article"
                className="h-9 w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-hover)] focus:outline-none"
                data-testid="markdown-preview-url-input"
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50"
                data-testid="markdown-preview-url-open"
              >
                Open URL
              </button>
            </form>
          </div>
        )}

        {state.kind === 'loading' && (
          <p className="mt-8 text-sm text-[var(--text-secondary)]" data-testid="markdown-preview-loading">
            Converting {state.filename} to Markdown…
          </p>
        )}

        {state.kind === 'error' && (
          <section
            className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6"
            data-testid="markdown-preview-error"
          >
            <h2 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">
              Could not convert {state.filename}
            </h2>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {state.error.error}
              {state.error.detail ? ` — ${state.error.detail}` : ''}
            </p>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-[var(--border-default)] px-3 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
              data-testid="markdown-preview-error-dismiss"
            >
              Try another URL
            </button>
          </section>
        )}

        {state.kind === 'ready' && (
          <>
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--text-primary)]" data-testid="markdown-preview-filename">
                {state.result.filename}
              </span>
              <span
                className="rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
                data-testid="markdown-preview-format"
              >
                {state.result.format}
              </span>
            </div>
            {(savedTitle || saveError) && (
              <p className="m-0 mt-3 text-[13px] text-[var(--text-secondary)]" data-testid="markdown-preview-save-status">
                {savedTitle ? `Saved “${savedTitle}” to your artifacts.` : `Save failed: ${saveError}`}
              </p>
            )}
            <article
              className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6"
              data-testid="markdown-preview-content"
            >
              {state.result.filename.toLowerCase().endsWith('.mdx') ? (
                <MdxRenderer source={state.result.markdown} />
              ) : (
                <Markdown content={state.result.markdown} />
              )}
            </article>
          </>
        )}
      </div>
    </div>
  );
}

export default MarkdownPreviewView;
