"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MicrosoftWordLogo,
  MicrosoftExcelLogo,
  FilePpt,
  Desktop,
  Globe,
  ArrowSquareOut,
  CircleNotch,
  ArrowsClockwise,
  Copy,
  Check,
  PlugsConnected,
  Warning,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type OfficeHost = 'word' | 'excel' | 'powerpoint';

const HOST_CONFIG = {
  word: {
    label: 'Word',
    Icon: MicrosoftWordLogo,
    color: '#2B579A',
    desktopScheme: 'ms-word:',
    webUrl: 'https://word.office.com',
    devScript: 'npm run dev:word',
    commands: [
      'Rewrite paragraph',
      'Summarize document',
      'Fix grammar & tone',
      'Draft from outline',
      'Extract key points',
    ],
  },
  excel: {
    label: 'Excel',
    Icon: MicrosoftExcelLogo,
    color: '#217346',
    desktopScheme: 'ms-excel:',
    webUrl: 'https://excel.office.com',
    devScript: 'npm run dev:excel',
    commands: [
      'Analyze sheet',
      'Build DCF model',
      'Generate charts',
      'Clean & format data',
      'Write formulas',
    ],
  },
  powerpoint: {
    label: 'PowerPoint',
    Icon: FilePpt,
    color: '#D24726',
    desktopScheme: 'ms-powerpoint:',
    webUrl: 'https://powerpoint.office.com',
    devScript: 'npm run dev:powerpoint',
    commands: [
      'Generate deck outline',
      'Apply brand DNA',
      'Rewrite slide',
      'Suggest visuals',
      'Write speaker notes',
    ],
  },
} as const;

const TASKPANE_ORIGINS = ['https://localhost:3000', 'http://localhost:3000'] as const;
const ADDIN_DIR = 'surfaces/allternit-extensions/allternit-office-addin';

type ProbeStatus = 'idle' | 'checking' | 'running' | 'offline';

async function probeTaskpane(): Promise<string | null> {
  for (const origin of TASKPANE_ORIGINS) {
    try {
      await fetch(`${origin}/`, {
        signal: AbortSignal.timeout(1500),
        mode: 'no-cors',
      });
      return origin;
    } catch {
      continue;
    }
  }
  return null;
}

export function AciAddinView({ host }: { host: OfficeHost }) {
  const cfg = HOST_CONFIG[host];
  const { label, Icon, color, desktopScheme, webUrl, devScript, commands } = cfg;

  const [probeStatus, setProbeStatus] = useState<ProbeStatus>('idle');
  const [resolvedOrigin, setResolvedOrigin] = useState<string>(TASKPANE_ORIGINS[0]);
  const [desktopClicked, setDesktopClicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const taskpaneUrl = useMemo(() => `${resolvedOrigin}/src/taskpane/index.html`, [resolvedOrigin]);
  const manifestUrl = useMemo(() => `${resolvedOrigin}/manifest.xml`, [resolvedOrigin]);

  const checkStatus = useCallback(async () => {
    setProbeStatus('checking');
    const origin = await probeTaskpane();
    const up = Boolean(origin);
    if (origin) setResolvedOrigin(origin);
    setProbeStatus(up ? 'running' : 'offline');
    if (!up) {
      setIframeLoaded(false);
      setIframeError(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleDesktop = () => {
    window.location.href = desktopScheme;
    setDesktopClicked(true);
    setTimeout(() => setDesktopClicked(false), 2500);
  };

  const handleCopyManifest = async () => {
    await navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = probeStatus === 'running';
  const isChecking = probeStatus === 'checking';

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-2.5">
        <div
          className="flex size-6  shrink-0 items-center justify-center rounded"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <Icon size={14} color={color} weight="fill" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Allternit for {label}
        </span>
        <span className="text-[12px] text-[var(--text-tertiary)]">Office Add-in</span>

        <div className="ml-auto flex items-center gap-3">
          {/* Status badge */}
          <div className={cn(
            'flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px] font-semibold',
            isRunning
              ? 'bg-green-950/30 text-green-400 border border-green-900/30'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]',
          )}>
            {isChecking
              ? <CircleNotch size={9} className="animate-spin" />
              : <span className={cn('size-1.5  rounded-full', isRunning ? 'bg-green-500' : 'bg-[var(--border-strong)]')} />
            }
            {isChecking ? 'Checking…' : isRunning ? 'Add-in server running' : 'Server offline'}
          </div>

          <button
            onClick={checkStatus}
            disabled={isChecking}
            className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise size={11} />
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — setup / launch */}
        <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">

          {/* Launch */}
          <section>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Open {label}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDesktop}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                  desktopClicked
                    ? 'border-green-900/40 bg-green-950/20 text-green-400'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
                )}
              >
                {desktopClicked
                  ? <><Check size={13} /> Launched</>
                  : <><Desktop size={13} /> Open {label} (desktop)</>
                }
              </button>
              <button
                onClick={() => window.open(webUrl, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Globe size={13} />
                Open {label} Online
                <ArrowSquareOut size={10} className="ml-auto" />
              </button>
            </div>
          </section>

          {/* Add-in commands */}
          <section>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Add-in commands
            </p>
            <div className="flex flex-col gap-1">
              {commands.map((cmd) => (
                <div
                  key={cmd}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]"
                  style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}
                >
                  <span
                    className="size-1  shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  {cmd}
                </div>
              ))}
            </div>
          </section>

          {/* Manifest */}
          <section>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Sideload manifest
            </p>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
              <p className="mb-2 leading-relaxed">
                To install the add-in, sideload this manifest in {label}:
              </p>
              <div className="mb-2 flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1">
                <code className="flex-1 truncate font-mono text-[12px] text-[var(--text-tertiary)]">
                  {manifestUrl}
                </code>
                <button
                  onClick={handleCopyManifest}
                  className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Requires the add-in server to be running locally.
              </p>
            </div>
          </section>

          {/* Start server instructions */}
          {!isRunning && probeStatus !== 'checking' && (
            <section>
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Start add-in server
              </p>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
                <p className="mb-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                  The task pane runs on localhost:3000. Start it from the monorepo:
                </p>
                <div className="mb-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 font-mono text-[12px] text-[var(--text-tertiary)]">
                  <div className="text-[var(--text-quaternary,var(--text-tertiary))]">
                    cd {ADDIN_DIR}
                  </div>
                  <div className="mt-0.5 text-[var(--accent-primary)]">
                    {devScript}
                  </div>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  Run <code className="rounded bg-[var(--bg-secondary)] px-1">npm run certs</code> first if you haven't installed dev certs.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Right panel — live task pane */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {isRunning ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-1.5">
                <PlugsConnected size={11} className="text-green-400" />
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  Live task pane — localhost:3000
                </span>
                <button
                  onClick={() => window.open(taskpaneUrl, '_blank', 'noopener,noreferrer')}
                  className="ml-auto flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Open in tab <ArrowSquareOut size={9} />
                </button>
              </div>
              {iframeError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <Warning size={24} className="text-[var(--status-warning,#f59e0b)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">Couldn't load task pane</p>
                  <p className="max-w-xs text-xs text-[var(--text-secondary)]">
                    The server is running but the iframe was blocked — likely a self-signed cert. Accept the cert at{' '}
                    <button
                      onClick={() => window.open(taskpaneUrl, '_blank')}
                      className="text-[var(--accent-primary)] underline underline-offset-2"
                    >
                      localhost:3000
                    </button>{' '}
                    then refresh.
                  </p>
                  <button
                    onClick={() => { setIframeError(false); setIframeLoaded(false); }}
                    className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
                  >
                    <ArrowsClockwise size={12} /> Retry
                  </button>
                </div>
              ) : (
                <div className="relative flex-1">
                  {!iframeLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--bg-primary)] text-xs text-[var(--text-tertiary)]">
                      <CircleNotch size={14} className="animate-spin" />
                      Loading task pane…
                    </div>
                  )}
                  <iframe
                    key={`taskpane-${host}`}
                    src={taskpaneUrl}
                    className="h-full w-full border-none"
                    title={`Allternit ${label} Add-in`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setIframeError(true)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-10 text-center">
              <div
                className="flex size-14  items-center justify-center rounded-2xl"
                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}
              >
                <Icon size={28} color={color} weight="fill" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Allternit for {label}
                </p>
                <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)] leading-relaxed">
                  The add-in task pane renders here when the server is running on localhost:3000.
                  Start it from the left panel, then click Refresh.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="rounded-lg border px-4 py-2.5 text-left"
                  style={{
                    background: `color-mix(in srgb, ${color} 4%, var(--bg-secondary))`,
                    borderColor: `color-mix(in srgb, ${color} 15%, var(--border-subtle))`,
                  }}
                >
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider" style={{ color }}>
                    How it works
                  </p>
                  <ol className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
                    <li>1. Start the add-in server (see left panel)</li>
                    <li>2. Open {label} — the Allternit task pane loads automatically</li>
                    <li>3. The task pane also previews here in the platform</li>
                  </ol>
                </div>
              </div>

              <button
                onClick={checkStatus}
                disabled={isChecking}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-50"
              >
                {isChecking ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
                Check again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
