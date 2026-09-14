"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilePdf,
  Signature,
  ArrowRight,
  Spinner,
  Warning,
  Copy,
  Check,
  Envelope,
  User,
  ListMagnifyingGlass,
} from '@phosphor-icons/react';
import {
  createDocuSealSubmission,
  createDocuSealTemplateFromPdf,
  getDocuSealConfig,
  getDocuSealEmbedUrl,
  listDocuSealTemplates,
  setDocuSealConfig,
  type DocuSealSubmission,
  type DocuSealTemplate,
} from '@/lib/docuseal-api';

interface DocuSealSigningViewProps {
  artifactId?: string;
  handoffId?: string;
}

export function DocuSealSigningView(_props: DocuSealSigningViewProps): React.ReactNode {
  const [apiKey, setApiKey] = useState(() => getDocuSealConfig().apiKey);
  const [host, setHost] = useState(() => getDocuSealConfig().host);
  const [templates, setTemplates] = useState<DocuSealTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [submitters, setSubmitters] = useState<{ email: string; role: string }[]>([
    { email: '', role: 'Signer' },
  ]);
  const [submission, setSubmission] = useState<DocuSealSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    if (!apiKey) return;
    setError(null);
    try {
      setBusy(true);
      const next = await listDocuSealTemplates();
      setTemplates(next);
      if (next.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(next[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load templates');
    } finally {
      setBusy(false);
    }
  }, [apiKey, selectedTemplateId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const saveConfig = () => {
    setDocuSealConfig(apiKey, host);
    void loadTemplates();
  };

  const handleUploadPdf = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const template = await createDocuSealTemplateFromPdf(file, file.name.replace(/\.pdf$/i, ''));
      setTemplates((prev) => [template, ...prev]);
      setSelectedTemplateId(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubmission = async () => {
    if (!selectedTemplateId) return;
    const validSubmitters = submitters.filter((s) => s.email.trim());
    if (validSubmitters.length === 0) {
      setError('Enter at least one signer email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await createDocuSealSubmission({
        templateId: Number(selectedTemplateId),
        submitters: validSubmitters.map((s) => ({ email: s.email.trim(), role: s.role.trim() || undefined })),
      });
      setSubmission(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signing request');
    } finally {
      setBusy(false);
    }
  };

  const embedUrl = submission?.submitters?.[0]?.embed_src ??
    (submission?.submitters?.[0]?.slug
      ? getDocuSealEmbedUrl(submission.submitters[0].slug, host)
      : null);

  const copyEmbedUrl = async () => {
    if (!embedUrl) return;
    await navigator.clipboard.writeText(embedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const inputClass =
    'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-code)]';

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-subtle)]"
            style={{
              background: 'color-mix(in srgb, var(--accent-code) 12%, var(--surface-panel))',
              boxShadow: '0 0 14px color-mix(in srgb, var(--accent-code) 12%, transparent)',
            }}
          >
            <Signature size={20} color="var(--accent-code)" weight="duotone" />
          </span>
          <div>
            <h1 className="m-0 text-2xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              Allternit Sign
            </h1>
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Native DocuSeal signing for PDFs and documents.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-floating)] p-5">
          <h2 className="m-0 text-sm font-semibold text-[var(--text-primary)]">DocuSeal connection</h2>
          <p className="m-0 mt-1 text-xs text-[var(--text-secondary)]">
            API key is stored locally. For production, route calls through your backend.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="DocuSeal API key"
              className={inputClass}
            />
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="https://api.docuseal.com"
              className={inputClass}
            />
            <button
              type="button"
              onClick={saveConfig}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-code)] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
          </div>
        </section>

        {!submission ? (
          <section className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-floating)] p-5">
            <h2 className="m-0 text-sm font-semibold text-[var(--text-primary)]">1. Choose a template</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <ListMagnifyingGlass
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value) || '')}
                  className={`${inputClass} appearance-none pl-9`}
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                hidden
                onChange={(e) => void handleUploadPdf(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || !apiKey}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
              >
                <FilePdf size={16} />
                Upload PDF
              </button>
            </div>

            <h2 className="m-0 mt-6 text-sm font-semibold text-[var(--text-primary)]">2. Add signers</h2>
            <div className="mt-3 flex flex-col gap-2">
              {submitters.map((s, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Envelope
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type="email"
                      value={s.email}
                      onChange={(e) =>
                        setSubmitters((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, email: e.target.value } : item)),
                        )
                      }
                      placeholder="Signer email"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  <div className="relative">
                    <User
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <input
                      type="text"
                      value={s.role}
                      onChange={(e) =>
                        setSubmitters((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, role: e.target.value } : item)),
                        )
                      }
                      placeholder="Role"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSubmitters((prev) => [...prev, { email: '', role: 'Signer' }])}
              className="mt-2 text-xs font-medium text-[var(--accent-code)] hover:underline"
            >
              + Add signer
            </button>

            <button
              type="button"
              onClick={() => void handleCreateSubmission()}
              disabled={busy || !selectedTemplateId || !apiKey}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-code)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {busy ? <Spinner size={16} className="animate-spin" /> : <ArrowRight size={16} weight="bold" />}
              Create signing request
            </button>
          </section>
        ) : (
          <section className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-floating)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="m-0 text-sm font-semibold text-[var(--text-primary)]">Signing request created</h2>
                <p className="m-0 mt-1 text-xs text-[var(--text-secondary)]">
                  Submission #{submission.id} · {submission.submitters.length} signer(s)
                </p>
              </div>
              <button
                type="button"
                onClick={copyEmbedUrl}
                disabled={!embedUrl}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
              >
                {copied ? <Check size={15} color="var(--status-success)" /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            {embedUrl && (
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/40" style={{ height: 620 }}>
                <iframe
                  title="DocuSeal signing form"
                  src={embedUrl}
                  className="h-full w-full"
                  style={{ border: 'none' }}
                  allow="fullscreen"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSubmission(null);
                setSubmitters([{ email: '', role: 'Signer' }]);
              }}
              className="mt-4 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Create another request
            </button>
          </section>
        )}

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/20 bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[var(--status-error)]">
            <Warning size={16} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocuSealSigningView;
