"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  TerminalWindow,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { ViewContext } from '@/nav/nav.types';
import { usePlatformAuth, usePlatformUser } from '@/lib/platform-auth-client';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useChatStore } from '@/views/chat/ChatStore';
import { openOfficeDesktopApp, openOfficeWebInBrowser, startOfficeWebDeveloperSetup } from './open-office-web';
import { openInBrowser } from '@/lib/openInBrowser';
import { recordDocumentWorkflowIntent } from '@/views/documents/document-workflows';
import { getOfficeWebInstallation, verifyOfficeWebInstallation } from './office-web-installation';

import { createModuleLogger } from '@/lib/logger';
import { getCloudApiBaseUrl, isOfficeApiEnabled } from '@/lib/env';

const logger = createModuleLogger('AciAddinView');

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

const TASKPANE_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3000',
  'https://localhost:3001',
  'https://ai.allternit.com/office-addins',
] as const;
const TASKPANE_PROBE_PATH = '/src/taskpane/index.html';
const ADDIN_DIR = 'surfaces/allternit-extensions/allternit-office-addin';

type ProbeStatus = 'idle' | 'checking' | 'running' | 'offline';
type GatewayBindingStatus = 'idle' | 'checking' | 'connected' | 'empty' | 'error' | 'disabled';
type BootstrapAckState = 'idle' | 'pending' | 'acknowledged' | 'timed-out';
type OfficeAddinHealth = 'not-installed' | 'installed' | 'update-available' | 'needs-repair' | 'unsupported';

interface OfficeAddinStatus {
  health: OfficeAddinHealth;
  installedVersion: string | null;
  availableVersion: string | null;
  manifestPath: string | null;
  detail: string;
}

interface AddinRuntimeState {
  host: string;
  hostConnected: boolean;
  runtimeMode: 'office-host' | 'companion-only';
  gatewayStatus?: 'connected' | 'error' | 'pending' | 'companion-only';
  documentTitle?: string | null;
  bindingId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
}

interface OfficeBootstrapPayload {
  source: 'allternit-shell';
  type: 'office-bootstrap';
  platformOrigin: string;
  auth: {
    token: string | null;
    userId: string | null;
    email: string | null;
    name: string | null;
  };
  context: {
    workspaceId: string | null;
    projectId: string | null;
    projectName: string | null;
  };
}

interface OfficeBindingSnapshot {
  id: string;
  host?: string | null;
  title?: string | null;
  label?: string | null;
  workspace_id?: string | null;
  project_id?: string | null;
  connected?: boolean | null;
  active_session_count?: number;
  last_seen_at?: string | null;
}

interface DesktopHostStatus {
  installed: boolean;
  running: boolean;
  bundlePath: string | null;
}

async function probeTaskpane(): Promise<string | null> {
  for (const origin of TASKPANE_ORIGINS) {
    try {
      await fetch(`${origin}${TASKPANE_PROBE_PATH}`, {
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

async function probeGatewayBinding(host: OfficeHost, token: string | null): Promise<OfficeBindingSnapshot | null> {
  // Flag on: /api/v1/office/bindings is served by the cloud-api control plane
  // (Clerk bearer auth, same origin the surface uses for other Clerk-authed
  // cloud-api calls). Flag off: the legacy local gateway probe on :8013.
  const url = isOfficeApiEnabled()
    ? `${getCloudApiBaseUrl()}/api/v1/office/bindings`
    : 'http://127.0.0.1:8013/api/v1/office/bindings';
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) {
    throw new Error(`Gateway returned ${response.status}`);
  }
  const data = await response.json() as { bindings?: OfficeBindingSnapshot[] };
  const bindings = Array.isArray(data.bindings) ? data.bindings : [];
  return bindings.find((binding) => binding.host === host) ?? null;
}

function buildTaskpaneUrl(origin: string, context: {
  product: OfficeHost;
  workspaceId: string | null;
  projectId: string | null;
  projectName: string | null;
  platformOrigin: string;
}) {
  const url = new URL('src/taskpane/index.html', `${origin.replace(/\/+$/, '')}/`)
  url.searchParams.set('product', context.product)
  if (context.workspaceId) url.searchParams.set('workspaceId', context.workspaceId)
  if (context.projectId) url.searchParams.set('projectId', context.projectId)
  if (context.projectName) url.searchParams.set('projectName', context.projectName)
  if (context.platformOrigin) url.searchParams.set('platformOrigin', context.platformOrigin)
  return url.toString()
}

export function AciAddinView({ host, context }: { host: OfficeHost; context?: ViewContext }) {
  const cfg = HOST_CONFIG[host];
  const { label, Icon, color, devScript, commands } = cfg;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = usePlatformAuth();
  const { user } = usePlatformUser();

  const [probeStatus, setProbeStatus] = useState<ProbeStatus>('idle');
  const [resolvedOrigin, setResolvedOrigin] = useState<string>(import.meta.env.DEV ? 'http://localhost:3000' : 'https://ai.allternit.com/office-addins');
  const [desktopHostStatus, setDesktopHostStatus] = useState<DesktopHostStatus>({ installed: false, running: false, bundlePath: null });
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayBindingStatus>('idle');
  const [gatewayBinding, setGatewayBinding] = useState<OfficeBindingSnapshot | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [iframeAcknowledged, setIframeAcknowledged] = useState(false);
  const [bootstrapAckState, setBootstrapAckState] = useState<BootstrapAckState>('idle');
  const [runtimeState, setRuntimeState] = useState<AddinRuntimeState | null>(null);
  const [addinStatus, setAddinStatus] = useState<OfficeAddinStatus | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [webVerifiedAt, setWebVerifiedAt] = useState<string | null>(() => getOfficeWebInstallation(host)?.verifiedAt ?? null);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const contextWorkspaceId = (context?.context as { workspaceId?: string | null } | undefined)?.workspaceId ?? activeWorkspaceId;
  const contextProjectId = (context?.context as { projectId?: string | null } | undefined)?.projectId ?? activeProjectId;
  const contextProjectName = (context?.context as { projectName?: string | null } | undefined)?.projectName ?? null;

  const taskpaneUrl = useMemo(
    () => buildTaskpaneUrl(resolvedOrigin, {
      product: host,
      workspaceId: contextWorkspaceId,
      projectId: contextProjectId,
      projectName: contextProjectName,
      platformOrigin: window.location.origin,
    }),
    [resolvedOrigin, contextWorkspaceId, contextProjectId, contextProjectName],
  );
  const manifestUrl = useMemo(() => `${resolvedOrigin}/manifests/${host}.xml`, [host, resolvedOrigin]);
  const startCommand = useMemo(() => `cd ${ADDIN_DIR}\n${devScript}`, [devScript]);
  const bootstrapPayload = useMemo<OfficeBootstrapPayload>(() => ({
    source: 'allternit-shell',
    type: 'office-bootstrap',
    platformOrigin: window.location.origin,
    auth: {
      token: authToken,
      userId: user?.id ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? user?.userEmail ?? null,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
    },
    context: {
      workspaceId: contextWorkspaceId,
      projectId: contextProjectId,
      projectName: contextProjectName,
    },
  }), [authToken, contextProjectId, contextProjectName, contextWorkspaceId, user]);

  const postBootstrapToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return false;
    iframe.contentWindow.postMessage(bootstrapPayload, resolvedOrigin);
    return true;
  }, [bootstrapPayload, resolvedOrigin]);

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      if (!isAuthLoaded) return;
      if (!isSignedIn) {
        if (!cancelled) setAuthToken(null);
        return;
      }
      const token = await getToken().catch(() => null);
      if (!cancelled) setAuthToken(token ?? null);
    }

    void loadToken();
    return () => {
      cancelled = true;
    };
  }, [getToken, isAuthLoaded, isSignedIn]);

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

  const refreshGateway = useCallback(async () => {
    if (!isOfficeApiEnabled()) {
      // Fail closed with a deliberate status instead of probing: the binding
      // probe targets the office API, which is only reachable when the
      // control-plane flag routes it to cloud-api.
      setGatewayBinding(null);
      setGatewayStatus('disabled');
      return;
    }
    setGatewayStatus('checking');
    try {
      const binding = await probeGatewayBinding(host, authToken);
      setGatewayBinding(binding);
      setGatewayStatus(binding ? 'connected' : 'empty');
    } catch (error) {
      logger.error({ err: error }, '[AciAddinView] gateway probe failed');
      setGatewayBinding(null);
      setGatewayStatus('error');
    }
  }, [authToken, host]);

  // Push auth + workspace context into the embedded add-in iframe.
  // The iframe can also request a resend explicitly via `bootstrap-request`.
  useEffect(() => {
    if (!iframeLoaded) return;
    setIframeAcknowledged(false);
    setBootstrapAckState('pending');

    let attempts = 0;
    const maxAttempts = 8;
    const ackTimeoutMs = 1500;
    let cancelled = false;

    function scheduleRetry() {
      if (cancelled || iframeAcknowledged) return;
      attempts++;
      if (attempts >= maxAttempts) {
        setBootstrapAckState('timed-out');
        return;
      }
      window.setTimeout(() => {
        if (!cancelled && !iframeAcknowledged) {
          postBootstrapToIframe();
          scheduleRetry();
        }
      }, ackTimeoutMs);
    }

    // Delay the first send slightly so the iframe can install its message listeners.
    const initialDelay = window.setTimeout(() => {
      postBootstrapToIframe();
      scheduleRetry();
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
    };
  }, [iframeLoaded, iframeAcknowledged, postBootstrapToIframe]);

  useEffect(() => {
    checkStatus();
    void refreshGateway();
  }, [checkStatus, refreshGateway]);

  useEffect(() => {
    if (!window.allternit?.shell?.getOfficeHostStatus) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await window.allternit!.shell!.getOfficeHostStatus();
        if (!cancelled) {
          setDesktopHostStatus(next[host] ?? { installed: false, running: false, bundlePath: null });
        }
      } catch {
        if (!cancelled) {
          setDesktopHostStatus({ installed: false, running: false, bundlePath: null });
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [host]);

  const refreshAddinStatus = useCallback(async () => {
    if (!window.allternit?.officeAddins?.getStatus) {
      setAddinStatus(null);
      return;
    }
    const statuses = await window.allternit.officeAddins.getStatus().catch(() => null);
    setAddinStatus(statuses?.[host] ?? null);
  }, [host]);

  useEffect(() => {
    void refreshAddinStatus();
  }, [refreshAddinStatus]);

  const runSetupAction = useCallback(async (action: 'install' | 'repair' | 'remove') => {
    const api = window.allternit?.officeAddins;
    if (!api) {
      setSetupMessage('Open Allternit Desktop to manage the developer add-in.');
      return;
    }
    setSetupBusy(true);
    setSetupMessage(null);
    try {
      const result = await api[action](host);
      setSetupMessage(result.detail);
      await refreshAddinStatus();
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : 'Office setup failed.');
    } finally {
      setSetupBusy(false);
    }
  }, [host, refreshAddinStatus]);

  // Auto-refresh gateway binding every 10 seconds when connected
  useEffect(() => {
    if (gatewayStatus !== 'connected' && gatewayStatus !== 'empty') return;
    const interval = window.setInterval(() => {
      void refreshGateway();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [gatewayStatus, refreshGateway]);

  // Listen for iframe acknowledgments
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.source !== 'allternit-office-addin') return;
      if (event.data?.type === 'bootstrap-ack') {
        setIframeAcknowledged(true);
        setBootstrapAckState('acknowledged');
        return;
      }
      if (event.data?.type === 'bootstrap-request') {
        setIframeAcknowledged(false);
        setBootstrapAckState('pending');
        postBootstrapToIframe();
        return;
      }
      if (event.data?.type === 'steer-agent' && typeof event.data?.payload?.instruction === 'string') {
        recordDocumentWorkflowIntent(host, event.data.payload.instruction);
        window.dispatchEvent(new CustomEvent('allternit:open-view', {
          detail: {
            viewType: 'chat',
            context: {
              initialPrompt: event.data.payload.instruction,
              officeHost: host,
              officeBindingId: event.data.payload.bindingId ?? gatewayBinding?.id ?? null,
            },
          },
        }));
        return;
      }
      if (event.data?.payload && typeof event.data.payload === 'object') {
        setIframeAcknowledged(true);
        setBootstrapAckState('acknowledged');
        const payload = event.data.payload as Partial<AddinRuntimeState>;
        setRuntimeState((prev) => ({
          host: payload.host ?? prev?.host ?? 'unknown',
          hostConnected: payload.hostConnected ?? prev?.hostConnected ?? false,
          runtimeMode: payload.runtimeMode ?? prev?.runtimeMode ?? 'companion-only',
          gatewayStatus: payload.gatewayStatus ?? prev?.gatewayStatus,
          documentTitle: payload.documentTitle ?? prev?.documentTitle ?? null,
          bindingId: payload.bindingId ?? prev?.bindingId ?? null,
          workspaceId: payload.workspaceId ?? prev?.workspaceId ?? null,
          projectId: payload.projectId ?? prev?.projectId ?? null,
        }));
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gatewayBinding?.id, host, postBootstrapToIframe]);

  const handleDesktop = () => {
    openOfficeDesktopApp(host);
  };

  const handleCopyManifest = async () => {
    await navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText(startCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const isRunning = probeStatus === 'running';
  const isChecking = probeStatus === 'checking';
  const isRealOfficeHost = runtimeState?.hostConnected ?? false;
  const runtimeModeLabel = isRealOfficeHost ? 'Live Office host attached' : 'Companion iframe only';

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

          <button type="button"
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

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Developer integration</p>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                addinStatus?.health === 'installed' ? 'bg-green-500/10 text-green-500' :
                  addinStatus?.health === 'update-available' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-amber-500/10 text-amber-500',
              )}>
                {addinStatus?.health === 'installed' ? 'Installed' : addinStatus?.health === 'update-available' ? 'Update available' : addinStatus?.health === 'needs-repair' ? 'Repair needed' : addinStatus?.health === 'unsupported' ? 'Web setup' : 'Not installed'}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {addinStatus?.detail ?? 'Allternit Desktop installs and verifies this product independently.'}
              </p>
              {addinStatus?.availableVersion && <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Available {addinStatus.availableVersion}{addinStatus.installedVersion ? ` · Installed ${addinStatus.installedVersion}` : ''}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {addinStatus?.health === 'installed' ? (
                  <>
                    <button type="button" disabled={setupBusy} onClick={() => void runSetupAction('repair')} className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] disabled:opacity-50">Verify & repair</button>
                    <button type="button" disabled={setupBusy} onClick={() => void runSetupAction('remove')} className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50">Remove</button>
                  </>
                ) : (
                  <button type="button" disabled={setupBusy || addinStatus?.health === 'unsupported'} onClick={() => void runSetupAction(addinStatus?.health === 'needs-repair' ? 'repair' : 'install')} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: color }}>
                    {setupBusy ? 'Working…' : addinStatus?.health === 'update-available' ? 'Update' : addinStatus?.health === 'needs-repair' ? 'Repair' : `Install for ${label}`}
                  </button>
                )}
              </div>
              {setupMessage && <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-tertiary)]">{setupMessage}</p>}
            </div>
          </section>

          {/* Launch */}
          <section>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Open {label}
            </p>
            <div className="flex flex-col gap-2">
              <button type="button"
                onClick={handleDesktop}
                disabled={!desktopHostStatus.installed}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                  desktopHostStatus.installed
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    : 'border-amber-900/30 bg-amber-950/10 text-amber-400 cursor-not-allowed opacity-80',
                )}
              >
                {desktopHostStatus.installed
                  ? <><Desktop size={13} /> Open {label} (desktop)</>
                  : <><Warning size={13} /> {label} desktop not installed</>
                }
              </button>
              <button type="button"
                onClick={() => openOfficeWebInBrowser(host)}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Globe size={13} />
                Open {label} In Browser Mode
                <ArrowSquareOut size={10} className="ml-auto" />
              </button>
              <button type="button"
                onClick={() => {
                  const opened = startOfficeWebDeveloperSetup(host);
                  setSetupMessage(opened ? `Opened ${label} on the web and prepared a verified setup task in Computer Agent.` : 'Open this from Allternit Desktop to use guided web setup.');
                }}
                className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <PlugsConnected size={13} /> Set up web developer add-in
              </button>
              {webVerifiedAt ? <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-[11px] text-green-600"><Check size={13} />Web ribbon verified {new Date(webVerifiedAt).toLocaleDateString()}</div> : <button type="button" onClick={() => { const receipt = verifyOfficeWebInstallation(host); setWebVerifiedAt(receipt.verifiedAt); setSetupMessage(`Recorded a browser-profile verification receipt for ${label} on the web.`); }} className="rounded-lg px-3 py-1.5 text-left text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]">I can see Allternit in the {label} ribbon</button>}
            </div>
          </section>

          {/* Add-in commands */}
          <section>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Runtime
            </p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <PlugsConnected size={12} />
                Host: {label}
              </div>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <span className={cn('size-1.5 rounded-full', isRealOfficeHost ? 'bg-green-500' : 'bg-amber-500')} />
                {runtimeModeLabel}
              </div>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <Desktop size={12} />
                {desktopHostStatus.installed
                  ? desktopHostStatus.running
                    ? `${label} desktop host running`
                    : `${label} desktop host installed`
                  : `${label} desktop host not installed on this machine`}
              </div>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <Globe size={12} />
                Taskpane: {resolvedOrigin}
              </div>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)]" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                <TerminalWindow size={12} />
                Gateway: http://127.0.0.1:8013/api/v1
              </div>
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

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Live Binding
              </p>
              <button type="button"
                onClick={() => void refreshGateway()}
                className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Refresh
              </button>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
              {gatewayStatus === 'checking' && 'Checking gateway binding…'}
              {gatewayStatus === 'error' && 'Gateway not reachable. Start the platform gateway on :8013.'}
              {gatewayStatus === 'disabled' && 'Live bindings are disabled in this deployment (the office bindings API is not publicly reachable).'}
              {runtimeState?.runtimeMode === 'companion-only' && (
                <div className="space-y-2">
                  <div>This taskpane is loaded in the Allternit companion iframe, not inside a real {label} host yet.</div>
                  {!desktopHostStatus.installed && (
                    <div className="text-[var(--status-warning,#f59e0b)]">
                      Microsoft {label} is not installed on this machine, so a real desktop add-in binding cannot be created here.
                    </div>
                  )}
                  <div className="text-[var(--text-tertiary)]">
                    To create a real binding, sideload the manifest into Microsoft {label} desktop or Microsoft 365 on the web and launch the add-in there.
                  </div>
                </div>
              )}
              {gatewayStatus === 'empty' && (
                <div className="space-y-2">
                  <div>No live Office document has checked in yet. Launch the real add-in inside Microsoft Office to create the binding.</div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'size-1.5 rounded-full',
                      bootstrapAckState === 'acknowledged'
                        ? 'bg-green-500'
                        : bootstrapAckState === 'timed-out'
                          ? 'bg-amber-500'
                          : iframeLoaded
                            ? 'bg-amber-500'
                            : 'bg-[var(--border-strong)]',
                    )} />
                    <span className="text-[var(--text-tertiary)]">
                      {bootstrapAckState === 'acknowledged'
                        ? 'Taskpane acknowledged shell bootstrap'
                        : bootstrapAckState === 'timed-out'
                          ? 'Taskpane loaded, but the companion bootstrap channel did not acknowledge'
                          : iframeLoaded
                            ? 'Taskpane loaded, waiting for bootstrap acknowledgment'
                            : 'Taskpane not mounted yet'}
                    </span>
                  </div>
                  {runtimeState && (
                    <div className="text-[var(--text-tertiary)]">
                      Runtime: {runtimeState.runtimeMode === 'office-host' ? `Connected to ${runtimeState.host}` : 'Companion iframe only'}
                    </div>
                  )}
                </div>
              )}
              {gatewayStatus === 'connected' && gatewayBinding && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-[var(--text-primary)]">{gatewayBinding.title || gatewayBinding.label || `${label} document`}</div>
                  <div>Binding ID: {gatewayBinding.id}</div>
                  <div>Live sessions: {gatewayBinding.active_session_count ?? 0}</div>
                  {gatewayBinding.workspace_id && <div>Workspace: {gatewayBinding.workspace_id}</div>}
                  {gatewayBinding.project_id && <div>Project: {gatewayBinding.project_id}</div>}
                  <div className="flex items-center gap-1">
                    <span className={cn('size-1.5 rounded-full', iframeAcknowledged ? 'bg-green-500' : 'bg-amber-500')} />
                    <span className="text-[var(--text-tertiary)]">{iframeAcknowledged ? 'Add-in acknowledged' : 'Waiting for add-in…'}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Advanced developer diagnostics */}
          <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)]">Advanced diagnostics</summary>
          <section className="mt-3">
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Sideload manifest
            </p>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
              <p className="mb-2 leading-relaxed">
                Host-specific manifest for troubleshooting:
              </p>
              <div className="mb-2 flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1">
                <code className="flex-1 truncate font-mono text-[12px] text-[var(--text-tertiary)]">
                  {manifestUrl}
                </code>
                <button type="button"
                  onClick={handleCopyManifest}
                  className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Normal installation is handled above. Manual sideloading is only a recovery path.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button"
                  onClick={() => openInBrowser(manifestUrl)}
                  className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                >
                  Open manifest
                </button>
                <button type="button"
                  onClick={() => openInBrowser(taskpaneUrl)}
                  className="rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                >
                  Open taskpane
                </button>
              </div>
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
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={handleCopyCommand}
                    className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  >
                    {copiedCommand ? <Check size={11} /> : <Copy size={11} />}
                    Copy command
                  </button>
                  <span className="text-[12px] text-[var(--text-tertiary)]">
                    Run <code className="rounded bg-[var(--bg-secondary)] px-1">npm run certs</code> first if needed.
                  </span>
                </div>
              </div>
            </section>
          )}
          </details>
        </div>

        {/* Right panel — live task pane */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {isRunning ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-1.5">
                <PlugsConnected size={11} className="text-green-400" />
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  Live task pane — {resolvedOrigin}
                </span>
                <button type="button"
                  onClick={() => openInBrowser(taskpaneUrl)}
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
                    <button type="button"
                      onClick={() => openInBrowser(taskpaneUrl)}
                      className="text-[var(--accent-primary)] underline underline-offset-2"
                    >
                      localhost:3000
                    </button>{' '}
                    then refresh.
                  </p>
                  <button type="button"
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
                    ref={iframeRef}
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

              <div
                className="rounded-lg border px-4 py-3 text-left"
                style={{
                  background: `color-mix(in srgb, ${color} 4%, var(--bg-secondary))`,
                  borderColor: `color-mix(in srgb, ${color} 15%, var(--border-subtle))`,
                }}
              >
                <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color }}>
                  <TerminalWindow size={12} />
                  Current Runtime Status
                </p>
                <div className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
                  <div>Host target: {label}</div>
                  <div>Manifest URL: {manifestUrl}</div>
                  <div>Taskpane URL: {taskpaneUrl}</div>
                  <div>State: waiting for local add-in runtime</div>
                </div>
              </div>

              <button type="button"
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
