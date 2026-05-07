/**
 * Infrastructure Setup Step
 *
 * Handles backend selection and connection:
 *  - local:    Desktop app detected (Electron) or download prompt + auto-poll
 *  - manual:   Enter any backend URL with auto-test and live status
 *  - connect:  Connect an existing VPS via SSH
 *  - purchase: Buy a new VPS from a provider
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  HardDrives,
  Cloud,
  Terminal,
  Key,
  Lock,
  Eye,
  Lightning,
  Check,
  Warning,
  CircleNotch,
  CheckCircle,
  ArrowSquareOut,
  CaretRight,
  DownloadSimple,
  Globe,
  Desktop,
  AppleLogo,
  WindowsLogo,
  LinuxLogo,
  LinkSimple,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { SAND, STATUS } from '@/design/allternit.tokens';
import {
  testSSHConnection,
  installBackend,
  VPS_PROVIDERS,
  type SSHConnectionConfig,
  type InstallProgress,
  type InstallStep,
  type SystemInfo,
  savePurchaseIntent
} from './ssh-service';
import { runtimeBackendApi } from '@/api/infrastructure/runtime-backend';
import { openInBrowser } from '@/lib/openInBrowser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  data: {
    infraType: string;
    sshConfig: SSHConnectionConfig;
  };
  onUpdate: (data: { infraType?: string; sshConfig?: SSHConnectionConfig }) => void;
  onStatusChange: (status: 'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error', message?: string) => void;
}

type UrlTestStatus = 'idle' | 'checking' | 'ok' | 'fail';

// Detect OS for download links
function detectOS(): 'mac' | 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'mac';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'mac';
}

// Detect if running inside Allternit desktop (Electron)
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).allternit?.tunnel;
}

// ─── Options ─────────────────────────────────────────────────────────────────

const options = [
  { id: 'local',    label: 'Use This Computer',   desc: 'Download the desktop app — it runs the backend for you', icon: Desktop,    color: '#5B8DEF' },
  { id: 'manual',   label: 'Enter Backend URL',    desc: 'Connect to any backend that has a public URL',            icon: Globe,      color: '#9C6ADE' },
  { id: 'connect',  label: 'Connect Existing VPS', desc: 'I have a server — connect via SSH',                       icon: HardDrives, color: SAND[500] },
  { id: 'purchase', label: 'Purchase VPS',         desc: 'Buy a new server from recommended providers',              icon: Cloud,      color: STATUS.success },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function InfrastructureStep({ data, onUpdate, onStatusChange }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [, setAbortFn] = useState<(() => void) | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<InstallStep>('connecting');

  // Local backend state
  const [localBackendStatus, setLocalBackendStatus] = useState<'checking' | 'found' | 'not-found'>('checking');
  const [localBackendUrl, setLocalBackendUrl] = useState<string | null>(null);
  const [isInElectron] = useState(isElectron);
  const [electronTunnelState, setElectronTunnelState] = useState<{ status: string; url?: string } | null>(null);
  const [os] = useState(detectOS);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual backend URL state
  const [manualBackend, setManualBackend] = useState({ name: '', gatewayUrl: '', gatewayToken: '' });
  const [urlTestStatus, setUrlTestStatus] = useState<UrlTestStatus>('idle');
  const [urlTestError, setUrlTestError] = useState<string | null>(null);
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local backend detection ───────────────────────────────────────────────

  const probeLocalBackends = useCallback(async (): Promise<boolean> => {
    // In Electron, get tunnel state via IPC instead of probing localhost
    if (isElectron()) {
      try {
        const state = await (window as any).allternit.tunnel.getState();
        setElectronTunnelState(state);
        if (state.status === 'running' && state.url) {
          setLocalBackendStatus('found');
          setLocalBackendUrl(`https://${state.url}`);
          return true;
        }
      } catch {
        // fall through to localhost probe
      }
    }

    const ports = [8013, 4096, 3001, 8080];
    for (const port of ports) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://localhost:${port}/v1/global/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          setLocalBackendStatus('found');
          setLocalBackendUrl(`http://localhost:${port}`);
          return true;
        }
      } catch {
        // next port
      }
    }
    setLocalBackendStatus('not-found');
    return false;
  }, []);

  // Poll for local backend every 3s when on the 'local' tab and not yet found
  useEffect(() => {
    if (data.infraType !== 'local') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    probeLocalBackends();
    pollRef.current = setInterval(() => {
      if (localBackendStatus !== 'found') probeLocalBackends();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.infraType]);

  // Electron tunnel IPC subscription
  useEffect(() => {
    if (!isElectron()) return;
    try {
      const unsub = (window as any).allternit.tunnel.onStateChange((state: any) => {
        setElectronTunnelState(state);
        if (state.status === 'running' && state.url) {
          setLocalBackendStatus('found');
          setLocalBackendUrl(`https://${state.url}`);
        }
      });
      return unsub;
    } catch {
      return undefined;
    }
  }, []);

  // ── Manual URL auto-test ──────────────────────────────────────────────────

  const testUrl = useCallback(async (url: string) => {
    if (!url.trim()) { setUrlTestStatus('idle'); return; }
    setUrlTestStatus('checking');
    setUrlTestError(null);
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${normalized.replace(/\/$/, '')}/v1/global/health`, {
        signal: controller.signal,
      });
      if (res.ok) {
        setUrlTestStatus('ok');
        // Auto-fill name if empty
        if (!manualBackend.name) {
          const host = new URL(normalized).hostname.split('.')[0];
          setManualBackend(prev => ({ ...prev, name: host || 'My Backend' }));
        }
      } else {
        setUrlTestStatus('fail');
        setUrlTestError(`Server returned ${res.status}`);
      }
    } catch (err: any) {
      setUrlTestStatus('fail');
      const msg = err?.name === 'AbortError' ? 'Timed out — server unreachable' : 'Could not connect';
      setUrlTestError(msg);
    }
  }, [manualBackend.name]);

  const handleUrlChange = (url: string) => {
    setManualBackend(prev => ({ ...prev, gatewayUrl: url }));
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    setUrlTestStatus('idle');
    if (url.length > 5) {
      urlDebounceRef.current = setTimeout(() => testUrl(url), 700);
    }
  };

  // ── SSH / VPS handlers ────────────────────────────────────────────────────

  const handleTestConnection = async () => {
    setStatus('testing');
    setStatusMessage('Testing SSH connection...');
    onStatusChange('testing');
    try {
      const result = await testSSHConnection(data.sshConfig);
      if (result.success && result.systemInfo) {
        setSystemInfo(result.systemInfo);
        setStatus('ready');
        setStatusMessage(`Connected! ${result.systemInfo.os} (${result.systemInfo.architecture})`);
        onStatusChange('ready', `Connected to ${result.systemInfo.os}`);
      } else {
        setStatus('error');
        setStatusMessage(result.error || 'Connection failed');
        onStatusChange('error', result.error);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Connection failed');
      onStatusChange('error', error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleConnectAndInstall = () => {
    setStatus('connecting');
    setStatusMessage('Starting installation...');
    onStatusChange('connecting');
    setInstallLog([]);
    setCurrentStep('connecting');

    const abort = installBackend(
      data.sshConfig,
      (progress) => {
        setInstallProgress(progress);
        setCurrentStep(progress.step);
        setStatus('installing');
        setStatusMessage(progress.message);
        onStatusChange('installing', progress.message);
        setInstallLog(prev =>
          progress.message && !prev.includes(progress.message)
            ? [...prev.slice(-9), progress.message]
            : prev
        );
      },
      (result) => {
        if (result.success) {
          if (result.systemInfo) setSystemInfo(result.systemInfo);
          setStatus('ready');
          setStatusMessage('Allternit backend installed and ready!');
          onStatusChange('ready', 'Backend installed successfully');
          setCurrentStep('complete');
        } else {
          setStatus('error');
          setStatusMessage(result.error || 'Installation failed');
          onStatusChange('error', result.error);
          setCurrentStep('error');
        }
        setAbortFn(null);
      }
    );
    setAbortFn(() => abort);
  };

  const handleManualBackendSubmit = async () => {
    if (!manualBackend.gatewayUrl.trim()) return;
    setStatus('connecting');
    setStatusMessage('Registering backend...');
    onStatusChange('connecting');
    try {
      const normalized = manualBackend.gatewayUrl.startsWith('http')
        ? manualBackend.gatewayUrl
        : `https://${manualBackend.gatewayUrl}`;
      const result = await runtimeBackendApi.registerManualBackend({
        name: manualBackend.name || 'My Backend',
        gatewayUrl: normalized,
        gatewayToken: manualBackend.gatewayToken || undefined,
      });
      if (result.success) {
        setStatus('ready');
        setStatusMessage(result.message || 'Backend connected!');
        onStatusChange('ready', result.message || 'Backend connected!');
      } else {
        setStatus('error');
        setStatusMessage(result.message || 'Failed to register backend');
        onStatusChange('error', result.message);
      }
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to register backend';
      setStatusMessage(message);
      onStatusChange('error', message);
    }
  };

  const handleActivateLocal = async () => {
    if (!localBackendUrl) return;
    setStatus('connecting');
    try {
      await runtimeBackendApi.registerManualBackend({ name: 'Local Backend', gatewayUrl: localBackendUrl });
      setStatus('ready');
      setStatusMessage('Local backend activated!');
      onStatusChange('ready', 'Local backend activated!');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to activate');
      onStatusChange('error', err.message);
    }
  };

  const handleEnableTunnel = async () => {
    if (!isElectron()) return;
    try {
      await (window as any).allternit.tunnel.enable();
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to start tunnel');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Option cards */}
      <div className="space-y-2">
        {options.map(({ id, label, desc, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => onUpdate({ infraType: id })}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200',
              data.infraType === id
                ? 'border-[#D4B08C] bg-[rgba(212,176,140,0.06)]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            )}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}20`, color }}>
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">{label}</div>
              <div className="text-sm text-white/50">{desc}</div>
            </div>
            <div className={cn('w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              data.infraType === id ? 'bg-[#D4B08C] border-[#D4B08C]' : 'border-white/20')}>
              {data.infraType === id && <Check className="w-3.5 h-3.5 text-[#0D0B09]" />}
            </div>
          </button>
        ))}
      </div>

      {/* ─── "Use This Computer" ─────────────────────────────────────────── */}
      {data.infraType === 'local' && (
        <LocalPanel
          isElectron={isInElectron}
          tunnelState={electronTunnelState}
          localBackendStatus={localBackendStatus}
          localBackendUrl={localBackendUrl}
          os={os}
          activationStatus={status}
          activationMessage={statusMessage}
          onActivate={handleActivateLocal}
          onEnableTunnel={handleEnableTunnel}
          onRetry={() => {
            setLocalBackendStatus('checking');
            probeLocalBackends();
          }}
        />
      )}

      {/* ─── "Enter Backend URL" ─────────────────────────────────────────── */}
      {data.infraType === 'manual' && (
        <ManualBackendPanel
          manualBackend={manualBackend}
          urlTestStatus={urlTestStatus}
          urlTestError={urlTestError}
          submitStatus={status}
          submitMessage={statusMessage}
          onUrlChange={handleUrlChange}
          onNameChange={(name) => setManualBackend(prev => ({ ...prev, name }))}
          onTokenChange={(gatewayToken) => setManualBackend(prev => ({ ...prev, gatewayToken }))}
          onSubmit={handleManualBackendSubmit}
          onRetryTest={() => testUrl(manualBackend.gatewayUrl)}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(v => !v)}
        />
      )}

      {/* ─── SSH / Connect VPS ───────────────────────────────────────────── */}
      {(data.infraType === 'connect' || data.infraType === 'remote') && (
        <SSHPanel
          sshConfig={data.sshConfig}
          status={status}
          statusMessage={statusMessage}
          installProgress={installProgress}
          installLog={installLog}
          currentStep={currentStep}
          systemInfo={systemInfo}
          showPassword={showPassword}
          onUpdate={onUpdate}
          onTogglePassword={() => setShowPassword(v => !v)}
          onTestConnection={handleTestConnection}
          onConnectAndInstall={handleConnectAndInstall}
        />
      )}

      {/* ─── Purchase VPS ────────────────────────────────────────────────── */}
      {data.infraType === 'purchase' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-white/50">
            Choose a provider. After purchase, return here and select "Connect Existing VPS" with the credentials they email you.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {VPS_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => { savePurchaseIntent(provider.id, {}); openInBrowser(provider.url); }}
                className="group p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-[#D4B08C] transition-all text-center"
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                  <img src={provider.logo} alt={provider.name} className="w-10 h-10 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <h4 className="font-semibold text-white text-sm">{provider.name}</h4>
                <p className="text-xs text-white/40 mb-2">{provider.description}</p>
                <div className="text-sm font-medium text-[#D4B08C]">{provider.startingPrice}</div>
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-white/30 group-hover:text-[#D4B08C]">
                  Open <ArrowSquareOut size={12} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LocalPanel ───────────────────────────────────────────────────────────────

interface LocalPanelProps {
  isElectron: boolean;
  tunnelState: { status: string; url?: string } | null;
  localBackendStatus: 'checking' | 'found' | 'not-found';
  localBackendUrl: string | null;
  os: 'mac' | 'windows' | 'linux';
  activationStatus: string;
  activationMessage: string;
  onActivate: () => void;
  onEnableTunnel: () => void;
  onRetry: () => void;
}

function LocalPanel({
  isElectron, tunnelState, localBackendStatus, localBackendUrl,
  os, activationStatus, activationMessage, onActivate, onEnableTunnel, onRetry,
}: LocalPanelProps) {

  // ── In Electron desktop app ──────────────────────────────────────────────
  if (isElectron) {
    const tunnelRunning = tunnelState?.status === 'running';
    const tunnelStarting = tunnelState?.status === 'starting';

    return (
      <div className="mt-3 p-4 rounded-2xl bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 space-y-3">
        <div className="flex items-center gap-2 text-[#5B8DEF] text-sm font-medium">
          <Desktop size={16} />
          Allternit Desktop Detected
        </div>

        {tunnelRunning ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">Web Access Active</div>
                <div className="text-xs text-white/50 truncate">{tunnelState?.url}</div>
              </div>
              <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
            </div>
            <p className="text-xs text-white/40">
              Your desktop is running as the backend. The platform connects through it automatically.
            </p>
            <button
              onClick={onActivate}
              disabled={activationStatus === 'connecting' || activationStatus === 'ready'}
              className="w-full py-2.5 rounded-xl bg-[#5B8DEF]/20 hover:bg-[#5B8DEF]/30 text-[#5B8DEF] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {activationStatus === 'ready' ? '✓ Connected' : activationStatus === 'connecting' ? 'Connecting…' : 'Use as Active Backend'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-white/60">
              Enable Web Access to use your desktop as the backend from the browser.
            </p>
            <button
              onClick={onEnableTunnel}
              disabled={tunnelStarting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5B8DEF] hover:bg-[#4a7ddf] text-white text-sm font-medium transition-colors disabled:opacity-70"
            >
              {tunnelStarting ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Globe size={16} />}
              {tunnelStarting ? 'Starting tunnel…' : 'Enable Web Access'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── In browser: backend found locally ────────────────────────────────────
  if (localBackendStatus === 'found') {
    return (
      <div className="mt-3 p-4 rounded-2xl bg-green-500/5 border border-green-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white">Local backend found</div>
            <div className="text-sm text-white/50 truncate">{localBackendUrl}</div>
          </div>
        </div>
        <button
          onClick={onActivate}
          disabled={activationStatus === 'connecting' || activationStatus === 'ready'}
          className="w-full py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {activationStatus === 'ready' ? '✓ Connected' : activationStatus === 'connecting' ? 'Connecting…' : 'Connect & Use This Computer'}
        </button>
        {activationStatus === 'error' && (
          <p className="text-xs text-red-400">{activationStatus}</p>
        )}
      </div>
    );
  }

  // ── In browser: checking ──────────────────────────────────────────────────
  if (localBackendStatus === 'checking') {
    return (
      <div className="mt-3 p-4 rounded-2xl bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 flex items-center gap-3">
        <CircleNotch className="w-5 h-5 animate-spin text-[#5B8DEF] flex-shrink-0" />
        <div>
          <div className="font-medium text-white text-sm">Checking for local backend…</div>
          <div className="text-xs text-white/40 mt-0.5">Probing ports 8013, 4096, 3001, 8080</div>
        </div>
      </div>
    );
  }

  // ── In browser: not found → download + instructions ───────────────────────
  return (
    <div className="mt-3 space-y-3">
      {/* Download section */}
      <div className="p-4 rounded-2xl bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
            <DownloadSimple size={16} className="text-[#5B8DEF]" />
            Download Allternit Desktop
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            The desktop app runs the backend on your computer. After installing, it automatically opens this page and connects — no manual steps.
          </p>
        </div>

        <DownloadButtons os={os} />

        {/* How it works */}
        <div className="border-t border-white/5 pt-3 space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider">How it works</p>
          {[
            'Download and install the desktop app',
            'Launch Allternit — the backend starts automatically',
            'Click "Enable Web Access" in the app',
            'This page connects to your desktop automatically',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/60">
              <span className="w-4 h-4 rounded-full bg-[#5B8DEF]/20 text-[#5B8DEF] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
      </div>

      {/* Auto-detect retry */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/10">
        <div className="flex-1">
          <p className="text-xs text-white/60">Already installed? Checking every 3 seconds…</p>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-colors"
        >
          <ArrowClockwise size={12} />
          Retry now
        </button>
      </div>
    </div>
  );
}

// ── Download buttons with OS detection ─────────────────────────────────────

function DownloadButtons({ os }: { os: 'mac' | 'windows' | 'linux' }) {
  // Placeholder download URLs — replace with real release URLs
  const downloads = {
    mac:     { label: 'Download for Mac',     icon: AppleLogo,   href: '#download-mac',     hint: 'macOS 12+' },
    windows: { label: 'Download for Windows', icon: WindowsLogo, href: '#download-windows',  hint: 'Windows 10+' },
    linux:   { label: 'Download for Linux',   icon: LinuxLogo,   href: '#download-linux',    hint: 'Debian / RPM' },
  };

  const primary = downloads[os];
  const others = (Object.entries(downloads) as [typeof os, typeof downloads.mac][])
    .filter(([k]) => k !== os);

  return (
    <div className="space-y-2">
      {/* Primary OS */}
      <a
        href={primary.href}
        className="flex items-center gap-3 p-3 rounded-xl bg-[#5B8DEF] hover:bg-[#4a7ddf] transition-colors text-white"
      >
        <primary.icon size={20} weight="fill" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{primary.label}</div>
          <div className="text-xs opacity-70">{primary.hint}</div>
        </div>
        <DownloadSimple size={16} />
      </a>

      {/* Other platforms */}
      <div className="flex gap-2">
        {others.map(([key, dl]) => (
          <a
            key={key}
            href={dl.href}
            className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
          >
            <dl.icon size={14} weight="fill" />
            {key === 'mac' ? 'Mac' : key === 'windows' ? 'Windows' : 'Linux'}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── ManualBackendPanel ───────────────────────────────────────────────────────

interface ManualBackendPanelProps {
  manualBackend: { name: string; gatewayUrl: string; gatewayToken: string };
  urlTestStatus: UrlTestStatus;
  urlTestError: string | null;
  submitStatus: string;
  submitMessage: string;
  onUrlChange: (url: string) => void;
  onNameChange: (name: string) => void;
  onTokenChange: (token: string) => void;
  onSubmit: () => void;
  onRetryTest: () => void;
  showPassword: boolean;
  onTogglePassword: () => void;
}

function ManualBackendPanel({
  manualBackend, urlTestStatus, urlTestError, submitStatus, submitMessage,
  onUrlChange, onNameChange, onTokenChange, onSubmit, onRetryTest,
}: ManualBackendPanelProps) {
  const isReady = urlTestStatus === 'ok';
  const inputBorderColor = urlTestStatus === 'ok' ? 'border-green-500/60 focus:border-green-500'
    : urlTestStatus === 'fail' ? 'border-red-500/60 focus:border-red-500'
    : 'border-white/10 focus:border-[#9C6ADE]';

  return (
    <div className="mt-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
      <div className="flex items-center gap-2 text-[#9C6ADE] text-sm font-medium">
        <LinkSimple size={16} />
        Backend URL
      </div>

      {/* URL input with live status */}
      <div className="relative">
        <input
          type="text"
          value={manualBackend.gatewayUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://your-backend.trycloudflare.com"
          className={cn(
            'w-full px-3 py-2.5 pr-9 bg-white/[0.03] border rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none transition-colors',
            inputBorderColor
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {urlTestStatus === 'checking' && <CircleNotch className="w-4 h-4 animate-spin text-white/40" />}
          {urlTestStatus === 'ok'       && <CheckCircle size={16} className="text-green-500" />}
          {urlTestStatus === 'fail'     && (
            <button onClick={onRetryTest} title="Retry">
              <ArrowClockwise size={16} className="text-red-400 hover:text-red-300" />
            </button>
          )}
        </div>
      </div>

      {/* URL status feedback */}
      {urlTestStatus === 'ok' && (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle size={12} /> Backend is reachable
        </p>
      )}
      {urlTestStatus === 'fail' && urlTestError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <Warning size={12} /> {urlTestError}
        </p>
      )}
      {urlTestStatus === 'idle' && manualBackend.gatewayUrl.length === 0 && (
        <p className="text-xs text-white/30">
          Paste a tunnel URL or your backend's public address — we'll test it automatically.
        </p>
      )}

      {/* Name (collapsible / auto-filled) */}
      <input
        type="text"
        value={manualBackend.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Label (e.g. My MacBook)"
        className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#9C6ADE] transition-colors"
      />

      {/* Auth token (optional, collapsed by default) */}
      <details className="group">
        <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 select-none">
          + Auth token (optional)
        </summary>
        <input
          type="text"
          value={manualBackend.gatewayToken}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="Bearer or Basic token"
          className="mt-2 w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#9C6ADE] transition-colors"
        />
      </details>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={submitStatus === 'connecting' || submitStatus === 'ready' || !manualBackend.gatewayUrl.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors',
          isReady
            ? 'bg-[#9C6ADE] hover:bg-[#8b5bc7] text-white'
            : 'bg-white/5 text-white/40 cursor-default',
          (submitStatus === 'connecting' || submitStatus === 'ready') && 'opacity-60'
        )}
      >
        {submitStatus === 'connecting' ? <CircleNotch className="w-4 h-4 animate-spin" />
          : submitStatus === 'ready' ? <CheckCircle size={16} />
          : <Globe size={16} />}
        {submitStatus === 'connecting' ? 'Connecting…'
          : submitStatus === 'ready' ? 'Connected!'
          : 'Connect to Backend'}
      </button>

      {submitStatus === 'error' && submitMessage && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <Warning size={12} /> {submitMessage}
        </p>
      )}

      {/* Help */}
      <div className="text-xs text-white/30 bg-black/20 rounded-lg p-3 space-y-1">
        <p>Running a Cloudflare tunnel locally?</p>
        <code className="text-[#9C6ADE] text-[10px] block bg-black/30 p-2 rounded">
          cloudflared tunnel --url http://localhost:8013
        </code>
        <p className="mt-1">Then paste the generated URL above.</p>
      </div>
    </div>
  );
}

// ─── SSHPanel ─────────────────────────────────────────────────────────────────

interface SSHPanelProps {
  sshConfig: SSHConnectionConfig;
  status: string;
  statusMessage: string;
  installProgress: InstallProgress | null;
  installLog: string[];
  currentStep: InstallStep;
  systemInfo: SystemInfo | null;
  showPassword: boolean;
  onUpdate: (data: { sshConfig?: SSHConnectionConfig }) => void;
  onTogglePassword: () => void;
  onTestConnection: () => void;
  onConnectAndInstall: () => void;
}

function SSHPanel({
  sshConfig, status, statusMessage, installProgress, installLog,
  currentStep, systemInfo, showPassword, onUpdate, onTogglePassword,
  onTestConnection, onConnectAndInstall,
}: SSHPanelProps) {
  const isBusy = status === 'testing' || status === 'connecting' || status === 'installing';

  return (
    <div className="mt-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
      <div className="flex items-center gap-2 text-[#D4B08C] text-sm font-medium">
        <Terminal size={16} />
        SSH Connection Details
      </div>

      <div className="grid grid-cols-[1fr,80px] gap-2">
        <input type="text" value={sshConfig.host}
          onChange={(e) => onUpdate({ sshConfig: { ...sshConfig, host: e.target.value } })}
          placeholder="Hostname or IP"
          className="px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]" />
        <input type="number" value={sshConfig.port}
          onChange={(e) => onUpdate({ sshConfig: { ...sshConfig, port: parseInt(e.target.value) || 22 } })}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]" />
      </div>

      <input type="text" value={sshConfig.username}
        onChange={(e) => onUpdate({ sshConfig: { ...sshConfig, username: e.target.value } })}
        placeholder="Username"
        className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]" />

      <div className="flex gap-2">
        {[{ id: 'key' as const, label: 'SSH Key', icon: Key }, { id: 'password' as const, label: 'Password', icon: Lock }]
          .map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => onUpdate({ sshConfig: { ...sshConfig, authType: id } })}
              className={cn('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
                sshConfig.authType === id ? 'border-[#D4B08C] bg-[color-mix(in srgb, var(--accent-primary) 10%, transparent)] text-[#D4B08C]' : 'border-white/10 text-white/50')}>
              <Icon size={16} /> {label}
            </button>
          ))}
      </div>

      {sshConfig.authType === 'key' ? (
        <div className="flex gap-2">
          <input type="text" value={sshConfig.privateKey}
            onChange={(e) => onUpdate({ sshConfig: { ...sshConfig, privateKey: e.target.value } })}
            placeholder="Paste private key content"
            className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]" />
        </div>
      ) : (
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={sshConfig.password}
            onChange={(e) => onUpdate({ sshConfig: { ...sshConfig, password: e.target.value } })}
            placeholder="Password"
            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]" />
          <button onClick={onTogglePassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
            <Eye size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onTestConnection} disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-white/20 rounded-xl text-sm text-[#D4B08C] hover:bg-[color-mix(in srgb, var(--accent-primary) 10%, transparent)] disabled:opacity-50">
          {status === 'testing' ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Lightning size={16} />}
          Test Connection
        </button>
        <button onClick={onConnectAndInstall} disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D4B08C] rounded-xl text-sm text-[#0D0B09] font-medium hover:bg-[#c4a07c] disabled:opacity-50">
          {isBusy ? <CircleNotch className="w-4 h-4 animate-spin" /> : <HardDrives size={16} />}
          {status === 'installing' ? 'Installing…' : 'Connect & Install'}
        </button>
      </div>

      {status !== 'idle' && statusMessage && (
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
          status === 'error' ? 'bg-red-500/10 text-red-400' :
          status === 'ready' ? 'bg-green-500/10 text-green-400' :
          'bg-[color-mix(in srgb, var(--accent-primary) 10%, transparent)] text-[#D4B08C]')}>
          {status === 'error' ? <Warning size={16} /> : status === 'ready' ? <CheckCircle size={16} /> : <CircleNotch className="w-4 h-4 animate-spin" />}
          {statusMessage}
        </div>
      )}

      {installProgress && status === 'installing' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/60">
              <span>Installation</span>
              <span>{installProgress.progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#D4B08C] to-[#5B8DEF] transition-all duration-500"
                style={{ width: `${installProgress.progress}%` }} />
            </div>
          </div>

          {installLog.length > 0 && (
            <div className="bg-black/30 rounded-xl p-3 font-mono text-xs">
              <div className="text-white/40 mb-1 text-[10px] uppercase tracking-wider">Live log</div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {installLog.map((log, i) => (
                  <div key={i} className={cn('flex items-start gap-2', i === installLog.length - 1 ? 'text-[#D4B08C]' : 'text-white/50')}>
                    <CaretRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {systemInfo && status === 'ready' && (
        <div className="p-3 rounded-lg bg-white/5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-white/50">OS:</span> <span className="text-white">{systemInfo.os}</span></div>
          <div className="flex justify-between"><span className="text-white/50">Architecture:</span> <span className="text-white">{systemInfo.architecture}</span></div>
          <div className="flex justify-between"><span className="text-white/50">Service Manager:</span> <span className="text-white">{systemInfo.hasSystemd ? 'systemd' : 'Direct Process'}</span></div>
          <div className="flex justify-between"><span className="text-white/50">Allternit:</span> <span className="text-white">{systemInfo.isAllternitInstalled ? `v${systemInfo.allternitVersion}` : 'Will install natively'}</span></div>
        </div>
      )}
    </div>
  );
}
