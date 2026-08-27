"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Upload,
  Link,
  ArrowRight,
  Check,
  Warning,
  X,
  FileText,
  Robot,
  Plugs,
  Clock,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/glass/GlassSurface";
import {
  fetchTeamFileFromUrl,
  importTeamFromContent,
  previewTeamImport,
  readTeamFileFromDisk,
  type TeamImportPreview,
  type TeamImportResult,
} from "@/lib/bots/bot-team-import";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger('BotTeamImportWizard');

type WizardStep = 'source' | 'review' | 'importing' | 'result';

interface BotTeamImportWizardProps {
  onClose: () => void;
  onImported?: (result: TeamImportResult) => void;
}

export function BotTeamImportWizard({ onClose, onImported }: BotTeamImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('source');
  const [source, setSource] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<TeamImportPreview | null>(null);
  const [result, setResult] = useState<TeamImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('source');
    setSource('file');
    setUrl('');
    setFile(null);
    setContent('');
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  };

  const loadContent = useCallback(async (): Promise<string | null> => {
    if (source === 'file') {
      if (!file) {
        setError('Please select a team file');
        return null;
      }
      return readTeamFileFromDisk(file);
    }

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return null;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return null;
    }
    return fetchTeamFileFromUrl(trimmed);
  }, [source, file, url]);

  const handleReview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const raw = await loadContent();
      if (raw === null) return;

      const previewResult = await previewTeamImport(raw);
      if (!previewResult.valid) {
        setError(previewResult.errors.join('; '));
        return;
      }

      setContent(raw);
      setPreview(previewResult);
      setStep('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      logger.error({ err }, 'Team import review failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!content) return;
    setStep('importing');
    setError(null);

    try {
      const importResult = await importTeamFromContent(content, {
        teamName: preview?.teamName,
      });
      setResult(importResult);
      setStep('result');
      if (importResult.success) {
        onImported?.(importResult);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStep('review');
      logger.error({ err }, 'Team import failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm">
      <GlassSurface
        intensity="elevated"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Robot size={18} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                Import bot team
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                OpenMausBot / BotMRR-compatible team file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {step === 'source' && (
            <div className="space-y-5">
              <div className="flex gap-2 p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setSource('file')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-colors",
                    source === 'file'
                      ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <Upload size={16} />
                  From disk
                </button>
                <button
                  type="button"
                  onClick={() => setSource('url')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-colors",
                    source === 'url'
                      ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <Link size={16} />
                  From URL
                </button>
              </div>

              {source === 'file' ? (
                <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] cursor-pointer hover:border-[var(--accent-primary)]/50 transition-colors">
                  <FileText size={40} className="text-[var(--text-tertiary)]" />
                  <div className="text-center">
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">
                      {file ? file.name : 'Drop a team file or click to browse'}
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                      Markdown/YAML frontmatter (.md, .yaml, .yml)
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".md,.yaml,.yml,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[var(--text-primary)]">
                    Team file URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://raw.githubusercontent.com/.../team.md"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                  />
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Paste a raw GitHub URL or any public Markdown/YAML file.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                  <Warning size={16} className="shrink-0 mt-0.5 text-[var(--status-error)]" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'review' && preview && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">
                  Review: {preview.teamName}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={Robot} label="Bots" value={preview.botCount} />
                  <StatCard icon={Plugs} label="Connectors" value={preview.connectorCount} />
                  <StatCard icon={FileText} label="Channels" value={preview.channelCount} />
                  <StatCard icon={Clock} label="Routines" value={preview.routineCount} />
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 space-y-1">
                  {preview.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                      <Warning size={14} className="shrink-0 mt-0.5 text-[var(--status-warning)]" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                  <Warning size={16} className="shrink-0 mt-0.5 text-[var(--status-error)]" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size={32} className="animate-spin text-[var(--accent-primary)]" />
              <div className="text-[14px] font-medium text-[var(--text-primary)]">
                Creating bots, channels, and routines…
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div
                className={cn(
                  "p-4 rounded-xl border flex items-start gap-3",
                  result.success
                    ? "bg-[var(--status-success)]/10 border-[var(--status-success)]/30"
                    : "bg-[var(--status-error)]/10 border-[var(--status-error)]/30"
                )}
              >
                {result.success ? (
                  <Check size={20} className="shrink-0 text-[var(--status-success)]" />
                ) : (
                  <Warning size={20} className="shrink-0 text-[var(--status-error)]" />
                )}
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {result.success ? 'Import successful' : 'Import completed with errors'}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                    {result.bots.length} bots, {result.routines.length} routines created
                  </div>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 space-y-1">
                  {result.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                      <Warning size={14} className="shrink-0 mt-0.5 text-[var(--status-warning)]" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                      <Warning size={14} className="shrink-0 mt-0.5 text-[var(--status-error)]" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--border-subtle)]">
          {step === 'source' ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleReview} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner size={14} className="animate-spin mr-1.5" />
                    Reviewing…
                  </>
                ) : (
                  <>
                    Review <ArrowRight size={14} className="ml-1.5" />
                  </>
                )}
              </Button>
            </>
          ) : step === 'review' ? (
            <>
              <Button variant="ghost" onClick={() => setStep('source')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import team <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </>
          ) : step === 'result' ? (
            <>
              <Button variant="ghost" onClick={reset}>
                Import another
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <div />
          )}
        </div>
      </GlassSurface>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
      <Icon size={18} className="text-[var(--accent-primary)]" />
      <div>
        <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="text-[16px] font-semibold text-[var(--text-primary)]">{value}</div>
      </div>
    </div>
  );
}
