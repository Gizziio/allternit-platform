// @ts-nocheck
'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsState } from '@/hooks/useSettingsState';
import { motion, AnimatePresence } from 'framer-motion';

import { ResourceUsageDashboard } from '@/components/usage/ResourceUsageDashboard';
import { BrainsPanel } from '@/components/settings/BrainsPanel';
import {
  GearSix,
  Cpu,
  Info,
  Plus,
  Sun,
  Moon,
  DeviceMobile,
  User,
  HardDrives,
  Shield,
  Cloud,
  Lock,
  Target,
  Recycle,
  FileCode,
  Code,
  Warning,
  X,
  Play,
  ChartBar,
  Clock,
  Lightning,
  CaretRight,
  CaretDown,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  GitBranch,
  Stack,
  FileText as FileCheck,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ClockCounterClockwise,
  Copy,
  ShieldCheck,
  FileText,
  CircleNotch,
  Globe,
  Question,
  ArrowUpRight,
  DownloadSimple,
  Gift,
  MagnifyingGlass,
  Sparkle,
  PlugsConnected,
  PuzzlePiece,
} from '@phosphor-icons/react';
import { VPSConnectionsPanel } from './VPSConnectionsPanel';
import { ToastProvider } from '@/components/ui/toast-provider';
import { usePlatformUser, usePlatformSignOut, usePlatformHardSignOut, usePlatformSessions, PlatformSignIn, isPlatformAuthDisabled } from '@/lib/platform-auth-client';
import { useThemeStore } from '@/design/ThemeStore';
import { LocalModelManager } from '@/components/models/LocalModelManager';
import { InfrastructureSettings } from './InfrastructureSettings';
import { ServiceUrlSettings } from './ServiceUrlSettings';
import { EnvironmentSettings } from './EnvironmentSettings';
import { listOwnedConnectors } from '@/lib/design/owned-connector';
import { SETTINGS_NAV_ITEMS, SETTINGS_NAV_GROUPS, SETTINGS_SECTION_MAP, type SettingsSection } from './settings.config';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { Toggle } from '@/components/settings/Toggle';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsTable, SettingsTableCell, SettingsTableChip } from '@/components/settings/SettingsTable';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { Badge } from '@/components/settings/Badge';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { MonoChip } from '@/components/settings/MonoChip';
import { AgentOpsPanel } from './AgentOpsPanel';
import { SecurityPanel } from './SecurityPanel';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS, SETTINGS_SELECT_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FontSize = 'small' | 'medium' | 'large';
type DefaultMode = 'chat' | 'cowork' | 'code';


interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  hasSubmenu?: boolean;
  onClick?: () => void;
  children?: MenuItem[];
}



// ─── Constants ───────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { action: 'New Chat', shortcut: '⌘N' },
  { action: 'Toggle Sidebar', shortcut: '⌘\\' },
  { action: 'Search', shortcut: '⌘K' },
  { action: 'Close View', shortcut: '⌘W' },
  { action: 'Switch Mode (Chat)', shortcut: '⌘1' },
  { action: 'Switch Mode (Cowork)', shortcut: '⌘2' },
  { action: 'Switch Mode (Code)', shortcut: '⌘3' },
  { action: 'Run Agent', shortcut: '⌘R' },
  { action: 'Toggle Theme', shortcut: '⌘Shift+T' },
  { action: 'Open Settings', shortcut: '⌘,' },
];



// ─── Helpers ──────────────────────────────────────────────────────────────────



// ─── Sub-components (extracted to module scope) ───────────────────────────────

const SectionDivider = (): React.ReactNode => (
  <div className="h-px bg-[var(--border-subtle)] my-3" />
);

const NavButton: React.FC<{ item: any; activeSection: SettingsSection; onClick: () => void }> = ({ item, activeSection, onClick }) => {
  const isActive = activeSection === item.id;
  return (
    <button type="button"
      onClick={onClick}
      title={item.label}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 border-none rounded-lg text-left cursor-pointer transition-colors duration-150",
        isActive
          ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
          : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      <span className="shrink-0 flex items-center">{item.icon}</span>
      <span className="truncate text-[14px]">{item.label}</span>
    </button>
  );
};

const MetricBar = ({ label, value, suffix = '%', inverse = false }: { label: string, value: number, suffix?: string, inverse?: boolean }) => {
  const color = inverse 
    ? (value < 50 ? 'var(--status-success)' : value < 100 ? 'var(--status-warning)' : 'var(--status-error)')
    : (value > 80 ? 'var(--status-success)' : value > 50 ? 'var(--status-warning)' : 'var(--status-error)');
  
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1.5">
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{value}{suffix}</span>
      </div>
      <div className="h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-500 ease-out" 
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  );
};

const PermissionRow: React.FC<{
  label: string;
  description: string;
  status?: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  onGrant: () => void;
}> = ({ label, description, status, onGrant }) => {
  const granted = status === 'granted';
  const denied = status === 'denied';

  return (
    <SettingsRow label={label} description={description}>
      {granted && (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--status-success)]/15 text-[var(--status-success)]">
          <CheckCircle size={12} weight="fill" /> Granted
        </span>
      )}
      {denied && (
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)]">Not granted</span>
          <button type="button" onClick={onGrant} className={QUIET_BUTTON_CLASS}>Grant</button>
        </span>
      )}
      {!granted && !denied && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)]">Checking…</span>
      )}
    </SettingsRow>
  );
};

// ─── Main View Component ──────────────────────────────────────────────────────

function ClerkAuthPanel() {
  const { isLoaded, isSignedIn, user: _user } = usePlatformUser();
  const { sessions } = usePlatformSessions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = _user as any;
  const signOut = usePlatformSignOut();
  const hardSignOut = usePlatformHardSignOut();
  const [backendSummary, setBackendSummary] = useState<{ mode: string; url: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).allternit?.backend;

  const handleRestartBackend = async () => {
    if (!isElectron) return;
    setRestarting(true);
    try {
      await (window as any).allternit.backend.restart();
    } catch (err) {
      logger.error({ err: err }, 'Failed to restart backend:');
    } finally {
      setRestarting(false);
    }
  };

  const refreshBackendSummary = useCallback(async () => {
    setRefreshing(true);
    try {
      const backend = await window.allternit?.connection?.getBackend?.();
      if (!backend) {
        setBackendSummary(null);
      } else {
        setBackendSummary({ mode: backend.mode, url: backend.url });
      }
    } catch {
      setBackendSummary(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshBackendSummary();
  }, [refreshBackendSummary]);

  const openSettingsSection = useCallback((section: SettingsSection, tab?: string) => {
    window.dispatchEvent(new CustomEvent('allternit:open-settings', {
      detail: { section, tab },
    }));
  }, []);

  const backendLabel = backendSummary
    ? backendSummary.mode === 'remote'
      ? 'BYOC / Remote backend connected'
      : backendSummary.mode === 'bundled'
        ? 'Bundled local backend connected'
        : 'Development backend connected'
    : null;

  const backendHelp = backendSummary
    ? backendSummary.mode === 'remote'
      ? 'This account is signed in while using a remote BYOC backend. Signing out ends the desktop session without changing the connected backend target.'
      : backendSummary.mode === 'bundled'
        ? 'This account is signed in against the bundled local stack. Signing out ends the desktop session without changing the bundled backend.'
        : 'This account is signed in while the desktop shell points at a development backend. Signing out only affects the desktop account session.'
    : 'Backend selection is managed separately from desktop OAuth and can be changed without signing out.';

  const manageBackendTab: 'overview' | 'connections' =
    backendSummary?.mode === 'remote' ? 'connections' : 'overview';

  const manageBackendLabel =
    backendSummary?.mode === 'remote' ? 'Manage remote backend' : 'Manage backend';

  if (!isLoaded) {
    return <div className="py-6 text-[var(--text-tertiary)] text-[13px]">Loading…</div>;
  }

  if (isPlatformAuthDisabled()) {
    return (
      <div className="py-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
        Authentication is unavailable in this build. No signed-in user is active.
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div>
        <SectionHeading>Sign in to your Allternit account</SectionHeading>
        <PlatformSignIn />
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mt-4">
          Desktop OAuth and backend selection are separate.
          Use Infrastructure or VPS Connections to change the active backend without resetting auth.
        </p>
      </div>
    );
  }

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Allternit User';
  const email =
    user?.emailAddresses?.[0]?.emailAddress
    ?? user?.primaryEmailAddress?.emailAddress
    ?? user?.userEmail
    ?? '';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div>
      <SectionHeading>Account</SectionHeading>
      <div className="flex items-center gap-4 py-4">
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={name} className="size-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="size-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-lg font-bold text-[var(--ui-text-inverse)] shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[var(--text-primary)] mb-0.5">{name}</div>
          {email && <div className="text-[13px] text-[var(--text-secondary)] truncate">{email}</div>}
        </div>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void signOut()}>
          Log out
        </button>
      </div>
      {user?.id && (
        <SettingsRow label="User ID" description="Your Allternit account identifier">
          <MonoChip className="max-w-[320px] break-all">{user.id}</MonoChip>
        </SettingsRow>
      )}
      <SettingsRow label="Log out of all devices" description="Ends every active session on all devices, including this one">
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void hardSignOut()}>
          Log out everywhere
        </button>
      </SettingsRow>

      <SectionHeading>Active sessions</SectionHeading>
      {sessions.length > 0 ? (
        <SettingsTable columns={['Session', 'Last active', '']}>
          {sessions.map((sess: any) => {
            const isCurrent = sess.id === (user as any)?.lastActiveSessionId;
            return (
              <tr key={sess.id}>
                <SettingsTableCell>
                  <span className="flex items-center gap-2">
                    <span className={cn("size-1.5 rounded-full shrink-0", sess.status === 'active' ? "bg-[var(--status-success)]" : "bg-[var(--ui-text-muted)]")} />
                    <span className="font-mono text-[12px] text-[var(--text-secondary)] truncate max-w-[200px]">{sess.id}</span>
                    {isCurrent && <SettingsTableChip>Current</SettingsTableChip>}
                  </span>
                </SettingsTableCell>
                <SettingsTableCell className="text-[var(--text-secondary)]">
                  {sess.latestActivityAt ? new Date(sess.latestActivityAt).toLocaleDateString() : '—'}
                </SettingsTableCell>
                <SettingsTableCell className="text-right">
                  {!isCurrent && (
                    <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => sess.revoke()}>Revoke</button>
                  )}
                </SettingsTableCell>
              </tr>
            );
          })}
        </SettingsTable>
      ) : (
        <p className="text-[13px] text-[var(--text-secondary)] py-3">No active sessions.</p>
      )}

      <SectionHeading>Trusted devices</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] py-3">No trusted devices.</p>

      <SectionHeading>Backend</SectionHeading>
      <SettingsRow label="Connection" description={backendLabel ?? 'Backend state unavailable'}>
        <div className="flex items-center gap-2">
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void refreshBackendSummary()} disabled={refreshing}>
            <ArrowsClockwise size={14} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
          {isElectron && (
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={handleRestartBackend} disabled={restarting}>
              <Cpu size={14} className={restarting ? 'animate-spin' : ''} /> {restarting ? 'Restarting…' : 'Restart backend'}
            </button>
          )}
        </div>
      </SettingsRow>
      {backendSummary?.url && (
        <SettingsRow label="Backend URL">
          <MonoChip className="max-w-[320px] break-all">{backendSummary.url}</MonoChip>
        </SettingsRow>
      )}
      <SettingsRow label="Backend routing" description={backendHelp}>
        <div className="flex items-center gap-2">
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettingsSection('infrastructure', manageBackendTab)}>
            <Cloud size={14} /> {manageBackendLabel}
          </button>
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettingsSection('infrastructure', 'connections')}>
            <HardDrives size={14} /> BYOC connections
          </button>
        </div>
      </SettingsRow>

      <SectionHeading>Offline-first sovereignty</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed py-1">
        Your Private Brain remains 100% functional without internet. All neural memories, local models (Ollama), and tool schemas are stored securely on this device.
      </p>
    </div>
  );
}
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('SettingsView');




const PermissionsPanel = () => {
  const [permStatus, setPermStatus] = useState<any>(null);
  const [permChecking, setPermChecking] = useState(false);

  useEffect(() => {
    const api = (window as any).allternit?.permissionGuide;
    if (!api) return;
    const unsub = api.onStatusChanged((status: any) => setPermStatus(status));
    api.check().then(setPermStatus).catch(() => {});
    return unsub;
  }, []);

  const checkPermissions = async () => {
    setPermChecking(true);
    try {
      const result = await (window as any).allternit!.permissionGuide!.requestCheck();
      setPermStatus(result);
    } finally {
      setPermChecking(false);
    }
  };

  const presentGuide = async (panel: any) => {
    await (window as any).allternit!.permissionGuide!.present(panel);
  };

  const hasApi = typeof window !== 'undefined' && !!(window as any).allternit?.permissionGuide;

  if (!hasApi) {
    return (
      <div>
        <SectionHeading>System permissions</SectionHeading>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Permission guide is only available in the Allternit Desktop app.
        </p>
      </div>
    );
  }

  const allGranted = permStatus?.accessibility === 'granted' && permStatus?.screenRecording === 'granted';

  return (
    <div>
      <SectionHeading>System permissions</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] mb-2">
        Allternit needs Accessibility and Screen Recording permissions to control your desktop and capture screenshots.
      </p>

      <PermissionRow
        label="Accessibility"
        description="Allows Allternit to click and type on your behalf"
        status={permStatus?.accessibility}
        onGrant={() => presentGuide('accessibility')}
      />
      <PermissionRow
        label="Screen Recording"
        description="Allows Allternit to see your screen and take screenshots"
        status={permStatus?.screenRecording}
        onGrant={() => presentGuide('screen-recording')}
      />

      <div className="flex items-center gap-3 mt-4">
        <button type="button"
          onClick={checkPermissions}
          disabled={permChecking}
          className={QUIET_BUTTON_CLASS}
        >
          <ArrowsClockwise size={14} className={permChecking ? 'animate-spin' : ''} />
          {permChecking ? 'Checking…' : 'Refresh status'}
        </button>
        {allGranted && (
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--status-success)]">
            <CheckCircle size={16} /> All permissions granted
          </span>
        )}
      </div>
    </div>
  );
};

const DiagnosticsPanel = () => {
  const telemetryRows: Array<{ label: string; value: string; status?: 'success' | 'warning' | 'error' }> = [
    { label: 'App Version', value: 'v0.9.1-beta' },
    { label: 'Platform', value: typeof window !== 'undefined' && (window as any).allternit?.backend ? 'Desktop (Native)' : 'Web' },
    { label: 'Kernel State', value: 'Operational (Port 3004)', status: 'success' },
    { label: 'Memory Bridge', value: 'Connected (Port 3201)', status: 'success' },
    { label: 'Gateway Sync', value: 'Healthy (Port 8013)', status: 'success' },
  ];

  return (
    <div>
      <SectionHeading>Telemetry & system</SectionHeading>
      <SettingsTable columns={['Item', 'Value']}>
        {telemetryRows.map((row) => (
          <tr key={row.label}>
            <SettingsTableCell className="text-[var(--text-secondary)]">{row.label}</SettingsTableCell>
            <SettingsTableCell>
              <span className="flex items-center gap-2">
                {row.status && (
                  <span className={cn(
                    "size-1.5 rounded-full shrink-0",
                    row.status === 'success' ? "bg-[var(--status-success)]" : row.status === 'warning' ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                  )} />
                )}
                <span className="font-mono text-[12px]">{row.value}</span>
              </span>
            </SettingsTableCell>
          </tr>
        ))}
      </SettingsTable>

      <SectionHeading>Session metrics</SectionHeading>
      <div className="py-2">
        <MetricBar label="Active Memory Ingestion" value={92} />
        <MetricBar label="Tool Execution Success" value={98} />
        <MetricBar label="Context Recall Latency" value={15} suffix="ms" inverse />
      </div>
    </div>
  );
};


export const SettingsView: React.FC<SettingsViewProps> = ({ 
  initialSection = 'signin',
  initialTab 
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [navQuery, setNavQuery] = useState('');
  const [infrastructureTab, setInfrastructureTab] = useState<string | undefined>(initialTab);

  // Inline state adjustment for initialSection change
  const [prevInitialSection, setPrevInitialSection] = useState(initialSection);
  if (initialSection !== prevInitialSection) {
    setPrevInitialSection(initialSection);
    if (initialSection) setActiveSection(initialSection);
  }

  // Inline state adjustment for initialTab change
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    if (initialTab) setInfrastructureTab(initialTab);
  }

  React.useEffect(() => {
    const handleNavigateSettings = (event: CustomEvent<{ section: string; tab?: string }>) => {
      if (event.detail?.section && SETTINGS_SECTION_MAP[event.detail.section]) {
        setActiveSection(SETTINGS_SECTION_MAP[event.detail.section]);
        if (event.detail?.tab && SETTINGS_SECTION_MAP[event.detail.section] === 'infrastructure') {
          setInfrastructureTab(event.detail.tab);
        }
      }
    };
    window.addEventListener('allternit:navigate-settings' as any, handleNavigateSettings as any);
    window.addEventListener('allternit:open-settings' as any, handleNavigateSettings as any);
    return () => {
      window.removeEventListener('allternit:navigate-settings' as any, handleNavigateSettings as any);
      window.removeEventListener('allternit:open-settings' as any, handleNavigateSettings as any);
    };
  }, []);

  // State — migrated to persisted localStorage via useSettingsState
  const [language, setLanguage] = useSettingsState('general.language', 'English');
  const [timezone, setTimezone] = useSettingsState('general.timezone', 'UTC');
  const [showSystemMessages, setShowSystemMessages] = useSettingsState('general.showSystemMessages', true);
  const [enableTelemetry, setEnableTelemetry] = useSettingsState('general.enableTelemetry', true);
  const [autoSave, setAutoSave] = useSettingsState('general.autoSave', true);
  const [, _setDefaultMode] = useState<DefaultMode>('chat');
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [, _setFontSize] = useState<FontSize>('medium');
  const [compactDensity, setCompactDensity] = useSettingsState('appearance.compactDensity', false);
  const [showSidebarLabels, setTwoSidebarLabels] = useSettingsState('appearance.showSidebarLabels', true);
  const [, _setAnimateTransitions] = useState(true);
  const [, _setAccentColor] = useState('var(--accent-primary)');
  const [, _setChatModel] = useState('GPT-4o');
  const [, _setCodeModel] = useState('Claude 3.5');
  const [, _setAnalysisModel] = useState('Mistral 7B');
  const [, _setTemperature] = useState(0.7);
  const [, _setMaxTokens] = useState('2000');
  const [streaming, setStreaming] = useState(true);
  const [, _setApiKeys] = useState<Record<string, { masked: string; isSet: boolean }>>({
    OpenAI: { masked: 'sk-••••••••••••••••', isSet: true },
    Anthropic: { masked: '', isSet: false },
    Mistral: { masked: '', isSet: false },
    Google: { masked: '', isSet: false },
  });
  const [bypassPermissions, setBypassPermissions] = useSettingsState('gizziio-code.bypassPermissions', false);
  const [drawAttentionNotifications, setDrawAttentionNotifications] = useSettingsState('gizziio-code.drawAttentionNotifications', true);
  const [, _setWorktreeLocation] = useState('Inside project (.claude/)');
  const [gizziRevokeState, setGizziRevokeState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [autoUpdateExtensions, setAutoUpdateExtensions] = useSettingsState('extensions.autoUpdateExtensions', true);
  const [useBuiltinNode, setUseBuiltinNode] = useSettingsState('extensions.useBuiltinNode', true);

  // Privacy
  const [locationMetadata, setLocationMetadata] = useSettingsState('privacy.locationMetadata', false);
  const [improveModels, setImproveModels] = useSettingsState('privacy.improveModels', true);

  // Gizziio Code
  const [codeThemeLight, setCodeThemeLight] = useSettingsState('gizziio-code.codeThemeLight', 'GitHub Light');
  const [codeThemeDark, setCodeThemeDark] = useSettingsState('gizziio-code.codeThemeDark', 'Allternit Dark');
  const [browserTools, setBrowserTools] = useSettingsState('gizziio-code.browserTools', true);
  const [persistSessions, setPersistSessions] = useSettingsState('gizziio-code.persistSessions', '7 days');
  const [branchPrefix, setBranchPrefix] = useSettingsState('gizziio-code.branchPrefix', 'allternit');
  const [autoCreatePRs, setAutoCreatePRs] = useSettingsState('gizziio-code.autoCreatePRs', false);
  const [autofixPRs, setAutofixPRs] = useSettingsState('gizziio-code.autofixPRs', true);

  // Cowork
  const [dispatchEnabled, setDispatchEnabled] = useSettingsState('cowork.dispatchEnabled', false);

  // Usage
  const [usageUpdatedLabel, setUsageUpdatedLabel] = useState('just now');
  const [usageRefreshing, setUsageRefreshing] = useState(false);

  // Customize list panels
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; category: string; status: string }>>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);

  const renderGeneralPanel = () => (
    <div>
      <SectionHeading>Language & region</SectionHeading>
      <SettingsRow label="Language" description="Display language for the interface">
        <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} className="p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[13px] font-medium outline-none cursor-pointer focus:border-[var(--accent-primary)]">
          <option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Timezone" description="Used for timestamps and scheduling">
        <select aria-label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[13px] font-medium outline-none cursor-pointer focus:border-[var(--accent-primary)]">
          <option>UTC</option><option>EST</option><option>CST</option><option>PST</option><option>GMT</option>
        </select>
      </SettingsRow>
      <SectionHeading>Behavior</SectionHeading>
      <SettingsRow label="Show system messages" description="Display internal system operations">
        <Toggle value={showSystemMessages} onChange={setShowSystemMessages} />
      </SettingsRow>
      <SettingsRow label="Enable telemetry" description="Help improve Allternit by sharing usage data">
        <Toggle value={enableTelemetry} onChange={setEnableTelemetry} />
      </SettingsRow>
      <SettingsRow label="Auto-save" description="Automatically save your work">
        <Toggle value={autoSave} onChange={setAutoSave} />
      </SettingsRow>
    </div>
  );

  const renderAppearancePanel = () => (
    <div>
      <SectionHeading>Theme</SectionHeading>
      <SettingsRow label="Color theme" description="Choose how the interface looks">
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button type="button"
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex items-center justify-center gap-1.5 p-2 px-3 rounded-lg border border-solid text-[13px] font-medium cursor-pointer transition-all active:scale-95",
                theme === t
                  ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--text-primary)]"
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/5"
              )}
            >
              {t === 'light' && <Sun size={16} weight={theme === t ? "fill" : "regular"} />}
              {t === 'dark' && <Moon size={16} weight={theme === t ? "fill" : "regular"} />}
              {t === 'system' && <DeviceMobile size={16} weight={theme === t ? "fill" : "regular"} />}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </SettingsRow>
      <SectionHeading>Layout</SectionHeading>
      <SettingsRow label="Compact density" description="Use less vertical spacing">
        <Toggle value={compactDensity} onChange={setCompactDensity} />
      </SettingsRow>
      <SettingsRow label="Show sidebar labels" description="Display text labels in sidebar">
        <Toggle value={showSidebarLabels} onChange={setTwoSidebarLabels} />
      </SettingsRow>
    </div>
  );

  const renderModelsPanel = () => (
    <div>
      <LocalModelManager />

      <SectionHeading>Session controls</SectionHeading>
      <SettingsRow label="Streaming" description="Stream responses in real-time">
        <Toggle value={streaming} onChange={setStreaming} />
      </SettingsRow>
    </div>
  );

  const renderApiKeysPanel = () => (
    <div>
      <SectionHeading>Brains</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">
        Detected providers and their auth state. Connect a subscription or CLI brain in one click; API-key providers use a key.
      </p>
      <BrainsPanel />
    </div>
  );

  const renderShortcutsPanel = () => (
    <div>
      <SectionHeading>Keyboard shortcuts</SectionHeading>
      <SettingsTable columns={['Action', 'Shortcut']}>
        {SHORTCUTS.map((item, index) => (
          <tr key={`settings-index-${index}`}>
            <SettingsTableCell>{item.action}</SettingsTableCell>
            <SettingsTableCell>
              <MonoChip>{item.shortcut}</MonoChip>
            </SettingsTableCell>
          </tr>
        ))}
      </SettingsTable>
    </div>
  );

  const renderAboutPanel = () => (
    <div className="text-center py-10">
      <div className="mb-10">
        <div className="grid grid-cols-4 gap-2 size-40 mx-auto transform hover:rotate-3 transition-transform duration-500">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={`settings-i-${i}`} className="bg-[var(--accent-primary)] rounded-md transition-opacity duration-300" style={{ opacity: i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 1 }} />
          ))}
        </div>
      </div>
      <h1 className="text-3xl font-semibold m-0 mb-2 text-[var(--ui-text-primary)] tracking-tight">Allternit & <span className="text-[var(--accent-primary)]">Coffee</span></h1>
      <p className="text-[13px] text-[var(--ui-text-muted)] font-mono">v0.9.1-beta</p>
      <div className="mt-10 flex justify-center gap-6">
        <button type="button" className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">Terms</button>
        <button type="button" className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">Privacy</button>
        <button type="button" className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">GitHub</button>
      </div>
    </div>
  );

  const fetchConnectors = useCallback(async () => {
    setConnectorsLoading(true);
    setConnectorsError(null);
    try {
      // Real connector standard (ADR-0043): cmd/allternit-api/src/connector_routes.rs
      // + the open-connector sidecar. Was /api/v1/cowork/connectors, the now-removed
      // 15-package env-var-only system's status endpoint.
      const owned = await listOwnedConnectors();
      setConnectors(
        owned.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category || 'general',
          status: c.connection?.status === 'connected' ? 'connected' : 'unconfigured',
        })),
      );
    } catch {
      setConnectorsError('Failed to load connectors');
      setConnectors([]);
    } finally {
      setConnectorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'connectors' && connectors.length === 0 && !connectorsError) {
      void fetchConnectors();
    }
  }, [activeSection, connectors.length, connectorsError, fetchConnectors]);

  const renderSecurityPanel = () => (
    <div className="max-w-4xl">
      <div className="flex gap-0 border-b border-solid border-white/10 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'policies', label: 'Policies', icon: FileCheck, count: policies.filter((p: any) => p.status === 'active').length },
          { id: 'gating', label: 'Approvals', icon: Lock, count: approvals.filter((a: any) => a.status === 'pending').length },
          { id: 'purpose', label: 'Purpose Binding', icon: Target },
          { id: 'compliance', label: 'Compliance', icon: FileCheck },
        ].map((tab: any) => (
          <button type="button"
            key={tab.id}
            onClick={() => setSecurityTab(tab.id)}
            className={cn(
              "p-4 px-6 border-none bg-transparent text-[13px] font-bold cursor-pointer flex items-center gap-2.5 transition-all whitespace-nowrap relative border-b-2 border-solid",
              securityTab === tab.id ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-[var(--ui-text-muted)] border-transparent hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon size={18} weight={securityTab === tab.id ? "fill" : "regular"} />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "p-0.5 px-2 rounded-full text-[11px] font-black tabular-nums",
                securityTab === tab.id ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "bg-rose-500 text-white"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {securityLoading ? (
        <div className="text-center py-20">
          <ArrowsClockwise size={40} className="text-white/20 animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[var(--ui-text-muted)] font-bold uppercase tracking-widest">Hardening Core…</p>
        </div>
      ) : (
        <>
          {securityTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="p-8 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                  <Shield size={120} weight="fill" />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                    <Shield size={32} weight="bold" />
                  </div>
                  <div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest opacity-60">Active Threat Level</div>
                    <div className="text-3xl font-black text-amber-500 tracking-tight mt-1">MODERATE_RISK</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Active Policies" value={policies.filter((p: any) => p.status === 'active').length} color="var(--status-success)" />
                <StatCard label="Open Violations" value={violations.filter((v: any) => v.status === 'open').length} color="var(--status-error)" />
                <StatCard label="Pending Approvals" value={approvals.filter((a: any) => a.status === 'pending').length} color="var(--status-warning)" />
                <StatCard label="Compliance" value={`${complianceStatus?.score || 0}%`} color="var(--status-info)" />
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-black text-[var(--ui-text-inverse)] m-0 mb-4 uppercase tracking-widest opacity-60">Security Audit Log</h3>
                <div className="flex flex-col gap-2">
                  {securityEvents.slice(0, 5).map((event: any) => (
                    <div key={event.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-transparent hover:border-[var(--ui-border-muted)] transition-all flex items-center gap-4 group">
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center transition-colors",
                        event.severity === 'critical' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        <Warning size={18} weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--ui-text-inverse)] truncate">{event.title}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 truncate">{event.description}</div>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ui-text-muted)] tabular-nums opacity-60 group-hover:opacity-100">{new Date(event.timestamp || event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {securityTab === 'policies' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-[var(--ui-text-inverse)] m-0">Governance Policies</h3>
                <button type="button" className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">
                  + New Policy
                </button>
              </div>
              {policies.map((policy: any) => (
                <div key={policy.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] hover:border-[var(--ui-border-default)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "size-11 rounded-xl flex items-center justify-center shadow-lg transition-colors",
                        policy.status === 'active' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5" : "bg-zinc-800 text-zinc-500"
                      )}>
                        <Shield size={22} weight={policy.status === 'active' ? "fill" : "regular"} />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{policy.name}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 font-semibold uppercase tracking-wider opacity-70">{policy.type} • {policy.enforcementMode}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest",
                        policy.severity === 'critical' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500"
                      )}>
                        {policy.severity}
                      </span>
                      {policy.violationCount > 0 && (
                        <span className="p-1 px-3 bg-rose-500/20 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-solid border-rose-500/20">
                          {policy.violationCount} violations
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {securityTab === 'gating' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-bold text-[var(--ui-text-inverse)] m-0 mb-2">Pending Approvals</h3>
              {approvals.filter((a: any) => a.status === 'pending').map((approval: any) => (
                <div key={approval.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between group hover:border-[var(--ui-border-default)] transition-colors">
                  <div>
                    <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{approval.title}</div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-1">Requested by <span className="text-[var(--accent-primary)] font-bold">{approval.requester?.agentName}</span> • {new Date(approval.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button type="button" className="p-2 px-4 rounded-lg border border-solid border-rose-500/30 bg-transparent text-rose-500 text-[12px] font-bold cursor-pointer hover:bg-rose-500/10 active:scale-95 transition-all">Reject</button>
                    <button type="button" className="p-2 px-4 rounded-lg border-none bg-emerald-600 text-white text-[12px] font-bold cursor-pointer hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-600/20">Approve</button>
                  </div>
                </div>
              ))}
              {approvals.filter((a: any) => a.status === 'pending').length === 0 && (
                <div className="p-12 text-center bg-black/5 rounded-2xl border border-dashed border-white/10 text-[13px] text-[var(--ui-text-muted)] font-medium">
                  Queue is clear. All agent actions are compliant.
                </div>
              )}
            </div>
          )}

          {securityTab === 'purpose' && (
            <div className="text-center py-24 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)]">
              <Target size={64} className="text-white/10 mx-auto mb-6" weight="thin" />
              <h3 className="text-lg font-bold text-[var(--ui-text-inverse)] m-0 mb-2">Purpose Binding Architecture</h3>
              <p className="text-[14px] text-[var(--ui-text-muted)] max-w-sm mx-auto leading-relaxed">Agent goals are restricted to verified project scopes. Configure binding levels in the DAG / Project view.</p>
              <button type="button" className="mt-8 p-2 px-6 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--text-primary)] text-sm font-bold cursor-pointer hover:bg-white/5 transition-all">Open DAG Workspace</button>
            </div>
          )}

          {securityTab === 'compliance' && (
            <div className="flex flex-col gap-6">
              <div className="p-10 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent pointer-events-none" />
                <div className={cn(
                  "text-6xl font-black tabular-nums tracking-tighter",
                  complianceStatus?.score >= 80 ? "text-[var(--status-success)]" : complianceStatus?.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                )}>
                  {complianceStatus?.score || 0}%
                </div>
                <div className="text-[11px] font-black text-[var(--ui-text-muted)] uppercase tracking-[0.2em] mt-3 opacity-60">System Compliance Rating</div>
              </div>
              <div>
                <h3 className="text-xs font-black text-[var(--ui-text-inverse)] m-0 mb-4 uppercase tracking-widest opacity-60">Enforced Frameworks</h3>
                <div className="flex flex-col gap-2">
                  {complianceStatus?.frameworks?.map((fw: any) => (
                    <div key={fw.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="text-sm font-bold text-[var(--ui-text-inverse)]">{fw.name}</div>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full rounded-full transition-all duration-1000 ease-in-out",
                            fw.score >= 80 ? "bg-[var(--status-success)]" : fw.score >= 60 ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                          )} style={{ width: `${fw.score}%` }} />
                        </div>
                        <span className={cn(
                          "text-sm font-black tabular-nums min-w-[3ch] text-right",
                          fw.score >= 80 ? "text-[var(--status-success)]" : fw.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                        )}>{fw.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const handleRevokeGizziAccess = async () => {
    setGizziRevokeState('loading');
    try {
      const res = await fetch('/api/oauth/revoke-user', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setGizziRevokeState('done');
    } catch {
      setGizziRevokeState('error');
    }
  };

  const renderGizziioCodePanel = () => (
    <div>
      <section className="mb-10">
        <ToastProvider>
          <ServiceUrlSettings />
        </ToastProvider>
      </section>

      <SectionHeading>General</SectionHeading>
      <SettingsRow label="Allow bypass permissions mode" description="Bypass all permission checks (Developer only)">
        <Toggle value={bypassPermissions} onChange={setBypassPermissions} />
      </SettingsRow>
      <SettingsRow label="Draw attention on notifications" description="Bounce dock icon on important agent notifications">
        <Toggle value={drawAttentionNotifications} onChange={setDrawAttentionNotifications} />
      </SettingsRow>

      <SectionHeading>Code appearance</SectionHeading>
      <SettingsRow label="Light theme" description="Syntax theme used in light mode">
        <select aria-label="Light code theme" value={codeThemeLight} onChange={(e) => setCodeThemeLight(e.target.value)} className={SETTINGS_SELECT_CLASS}>
          <option>GitHub Light</option><option>Solarized Light</option><option>One Light</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Dark theme" description="Syntax theme used in dark mode">
        <select aria-label="Dark code theme" value={codeThemeDark} onChange={(e) => setCodeThemeDark(e.target.value)} className={SETTINGS_SELECT_CLASS}>
          <option>Allternit Dark</option><option>GitHub Dark</option><option>One Dark</option><option>Dracula</option>
        </select>
      </SettingsRow>
      <div className="grid grid-cols-2 gap-3 py-4">
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] overflow-hidden">
          <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-100 border-b border-solid border-zinc-200">Light</div>
          <div className="p-3 bg-white text-[11px] leading-relaxed font-mono text-zinc-700 overflow-x-auto">
            <div><span className="text-zinc-400 select-none">12&nbsp;&nbsp;</span><span className="text-purple-600">function</span> greet(name) {'{'}</div>
            <div className="bg-red-50 text-red-600 -mx-3 px-3"><span className="text-red-300 select-none">13&nbsp;</span>-&nbsp;&nbsp;return "hi " + name;</div>
            <div className="bg-green-50 text-green-700 -mx-3 px-3"><span className="text-green-400 select-none">13&nbsp;</span>+&nbsp;&nbsp;return 'hello ' + name;</div>
            <div><span className="text-zinc-400 select-none">14&nbsp;&nbsp;</span>{'}'}</div>
          </div>
        </div>
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] overflow-hidden">
          <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 bg-zinc-800 border-b border-solid border-zinc-700">Dark</div>
          <div className="p-3 bg-[#0d1117] text-[11px] leading-relaxed font-mono text-zinc-300 overflow-x-auto">
            <div><span className="text-zinc-600 select-none">12&nbsp;&nbsp;</span><span className="text-purple-400">function</span> greet(name) {'{'}</div>
            <div className="bg-red-500/10 text-red-300 -mx-3 px-3"><span className="text-red-400/50 select-none">13&nbsp;</span>-&nbsp;&nbsp;return "hi " + name;</div>
            <div className="bg-green-500/10 text-green-300 -mx-3 px-3"><span className="text-green-400/50 select-none">13&nbsp;</span>+&nbsp;&nbsp;return 'hello ' + name;</div>
            <div><span className="text-zinc-600 select-none">14&nbsp;&nbsp;</span>{'}'}</div>
          </div>
        </div>
      </div>

      <SectionHeading>Browser</SectionHeading>
      <SettingsRow label="Browser tools" description="Allow Gizziio Code to drive the built-in browser">
        <Toggle value={browserTools} onChange={setBrowserTools} />
      </SettingsRow>
      <SettingsRow label="Persist sessions" description="How long browser sessions stay alive">
        <select aria-label="Persist sessions" value={persistSessions} onChange={(e) => setPersistSessions(e.target.value)} className={SETTINGS_SELECT_CLASS}>
          <option>Don't keep</option><option>1 day</option><option>7 days</option><option>30 days</option>
        </select>
      </SettingsRow>

      <SectionHeading>Pull requests</SectionHeading>
      <SettingsRow label="Branch prefix" description="Prefix used for generated PR branches">
        <input
          type="text"
          value={branchPrefix}
          onChange={(e) => setBranchPrefix(e.target.value)}
          aria-label="Branch prefix"
          className="w-40 p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--accent-primary)]"
        />
      </SettingsRow>
      <SettingsRow label="Create pull requests automatically" description="Open a PR when a task completes">
        <Toggle value={autoCreatePRs} onChange={setAutoCreatePRs} />
      </SettingsRow>
      <SettingsRow label="Autofix review comments" description="Apply suggested fixes without asking">
        <Toggle value={autofixPRs} onChange={setAutofixPRs} />
      </SettingsRow>

      <SectionHeading>Authorized API access</SectionHeading>
      <SettingsRow label="Gizzi Code CLI" description="Full repository access — reads, writes, and deploys on your behalf.">
        <div className="flex items-center gap-3">
          {gizziRevokeState === 'done' && (
            <span className="text-[11px] font-medium text-[var(--status-success)]">Revoked</span>
          )}
          {gizziRevokeState === 'error' && (
            <span className="text-[11px] font-medium text-[var(--status-error)]">Failed</span>
          )}
          <button type="button"
            onClick={handleRevokeGizziAccess}
            disabled={gizziRevokeState === 'loading' || gizziRevokeState === 'done'}
            className={DESTRUCTIVE_BUTTON_CLASS}
          >
            {gizziRevokeState === 'loading' ? 'Revoking…' : 'Revoke access'}
          </button>
        </div>
      </SettingsRow>
      <p className="text-[12px] text-[var(--text-tertiary)] m-0 leading-relaxed">
        Revoking access signs Gizzi Code out on all machines. Re-authorize by running{' '}
        <code className="font-mono bg-[var(--bg-secondary)] p-0.5 px-1.5 rounded border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">gizzi login</code>.
      </p>
    </div>
  );

  const renderCoworkPanel = () => (
    <div>
      <SectionHeading>Cowork</SectionHeading>
      <SettingsRow
        label="Dispatch"
        description="Let agents hand off background tasks to Cowork sessions"
      >
        <span className="flex items-center gap-2">
          <Badge>Beta</Badge>
          <Toggle value={dispatchEnabled} onChange={setDispatchEnabled} />
        </span>
      </SettingsRow>
      <SettingsRow label="Files location" description="Where Cowork stores shared workspace files">
        <span className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--accent-primary)] underline underline-offset-2 font-mono cursor-pointer">~/Allternit/Cowork</span>
          <button type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[13px] font-medium text-[var(--status-warning)] cursor-pointer hover:bg-[var(--status-warning)]/15 transition-colors"
            title="Not wired yet"
            disabled
          >
            <Warning size={14} /> Use recommended
          </button>
          <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Change</button>
        </span>
      </SettingsRow>

      <SectionHeading>Access</SectionHeading>
      <SettingsRow label="Trusted folders" description="Folders Cowork agents may read and write">
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Manage</button>
      </SettingsRow>
      <SettingsRow label="Global instructions" description="Instructions applied to every Cowork session">
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Edit</button>
      </SettingsRow>
    </div>
  );

  const renderExtensionsPanel = () => (
    <div>
      <SectionHeading>Extensions</SectionHeading>
      <SettingsRow label="Enable auto-updates for extensions" description="Background update all marketplace and sidecar extensions">
        <Toggle value={autoUpdateExtensions} onChange={setAutoUpdateExtensions} />
      </SettingsRow>
      <SettingsRow label="Use Built-in Node.js for MCP" description="Ensure stability by using Allternit's verified runtime">
        <Toggle value={useBuiltinNode} onChange={setUseBuiltinNode} />
      </SettingsRow>
    </div>
  );

  const renderBillingPanel = () => (
    <div>
      <SectionHeading>Subscription & usage</SectionHeading>
      <SettingsRow label="Allternit Pro" description="$20.00 / month · Renews June 12">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--status-success)]/15 text-[var(--status-success)]">
          <ShieldCheck size={12} weight="fill" /> Active
        </span>
      </SettingsRow>
      <SettingsRow label="Billing portal" description="Update payment method, download invoices, or cancel">
        <button type="button" className={QUIET_BUTTON_CLASS}>Manage billing portal</button>
      </SettingsRow>
    </div>
  );

  const renderUsagePanel = () => {
    const sessionRows = [
      { label: 'Messages this session', used: 8 },
      { label: 'Tokens this session', used: 14 },
    ];
    const weeklyRows = [
      { label: 'Weekly message limit', used: 34 },
      { label: 'Weekly token limit', used: 27 },
    ];

    const renderBarRow = (row: { label: string; used: number }) => (
      <div key={row.label} className="py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[14px] font-medium text-[var(--text-primary)]">{row.label}</span>
          <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">{row.used}% used</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--text-tertiary)] transition-all duration-500" style={{ width: `${row.used}%` }} />
        </div>
      </div>
    );

    const handleUsageRefresh = () => {
      setUsageRefreshing(true);
      setTimeout(() => {
        setUsageUpdatedLabel('just now');
        setUsageRefreshing(false);
      }, 600);
    };

    return (
      <div>
        <SectionHeading>Current session</SectionHeading>
        {sessionRows.map(renderBarRow)}
        <SectionHeading>Weekly limits</SectionHeading>
        {weeklyRows.map(renderBarRow)}
        <div className="flex items-center justify-between py-3">
          <span className="text-[12px] text-[var(--text-tertiary)]">Last updated: {usageUpdatedLabel}</span>
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={handleUsageRefresh} disabled={usageRefreshing}>
            <ArrowsClockwise size={14} className={usageRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <SectionHeading>Usage details</SectionHeading>
        <ResourceUsageDashboard />
      </div>
    );
  };

  

  const openView = (viewType: string) => {
    window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType } }));
  };

  const renderPrivacyPanel = () => (
    <div>
      <SectionHeading>Privacy</SectionHeading>
      {['How we protect your data', 'How we use your data'].map((label) => (
        <button key={label} type="button"
          className="w-full flex items-center justify-between py-4 bg-transparent border-none cursor-pointer text-left group"
        >
          <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
          <CaretRight size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
        </button>
      ))}

      <SectionHeading>Preferences</SectionHeading>
      <SettingsRow label="Location metadata" description="Attach coarse location to usage analytics">
        <Toggle value={locationMetadata} onChange={setLocationMetadata} />
      </SettingsRow>
      <SettingsRow label="Help improve our models" description="Allow anonymized usage data to improve Allternit models">
        <Toggle value={improveModels} onChange={setImproveModels} />
      </SettingsRow>

      <SectionHeading>Your data</SectionHeading>
      <SettingsRow label="Export data" description="Download a copy of your account data">
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>
          <DownloadSimple size={14} /> Export
        </button>
      </SettingsRow>
      <SettingsRow label="Shared chats" description="Manage chats you have shared with others">
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Manage</button>
      </SettingsRow>
      <SettingsRow label="Memory preferences" description="Control what Allternit remembers between sessions">
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Manage</button>
      </SettingsRow>
    </div>
  );

  const renderSkillsPanel = () => (
    <div>
      <PanelHeader title="Skills">
        <button type="button" className="size-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] cursor-not-allowed" title="Not wired yet" disabled aria-label="Search skills">
          <MagnifyingGlass size={16} />
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openView('memory')}>Browse</button>
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Add <CaretDown size={12} /></button>
      </PanelHeader>
      <EmptyState
        icon={<Sparkle size={40} weight="thin" />}
        caption="No skills installed yet."
        ctaLabel="Browse skills"
        onCtaClick={() => openView('memory')}
      />
    </div>
  );

  const renderConnectorsPanel = () => (
    <div>
      <PanelHeader title="Connectors">
        <button type="button" className="size-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] cursor-not-allowed" title="Not wired yet" disabled aria-label="Search connectors">
          <MagnifyingGlass size={16} />
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void fetchConnectors()} disabled={connectorsLoading}>
          <ArrowsClockwise size={14} className={connectorsLoading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Add <CaretDown size={12} /></button>
      </PanelHeader>
      {connectorsLoading && connectors.length === 0 ? (
        <SkeletonRow lines={4} />
      ) : connectorsError ? (
        <EmptyState
          icon={<PlugsConnected size={40} weight="thin" />}
          caption={connectorsError}
          ctaLabel="Retry"
          onCtaClick={() => void fetchConnectors()}
        />
      ) : connectors.length === 0 ? (
        <EmptyState
          icon={<PlugsConnected size={40} weight="thin" />}
          caption="No connectors configured."
        />
      ) : (
        <SettingsTable columns={['Connector', 'Category', 'Status']}>
          {connectors.map((c) => (
            <tr key={c.id}>
              <SettingsTableCell>{c.name}</SettingsTableCell>
              <SettingsTableCell className="text-[var(--text-secondary)] capitalize">{c.category}</SettingsTableCell>
              <SettingsTableCell>
                <SettingsTableChip tone={c.status === 'connected' ? 'blue' : 'gray'}>
                  {c.status === 'connected' ? 'Connected' : 'Unconfigured'}
                </SettingsTableChip>
              </SettingsTableCell>
            </tr>
          ))}
        </SettingsTable>
      )}
    </div>
  );

  const renderPluginsPanel = () => (
    <div>
      <PanelHeader title="Plugins">
        <button type="button" className="size-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] cursor-not-allowed" title="Not wired yet" disabled aria-label="Search plugins">
          <MagnifyingGlass size={16} />
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openView('plugins')}>Browse</button>
        <button type="button" className={QUIET_BUTTON_CLASS} title="Not wired yet" disabled>Add <CaretDown size={12} /></button>
      </PanelHeader>
      <EmptyState
        icon={<PuzzlePiece size={40} weight="thin" />}
        caption="No plugins installed yet."
        ctaLabel="Browse plugins"
        onCtaClick={() => openView('plugins')}
      />
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralPanel();
      case 'appearance': return renderAppearancePanel();
      case 'models': return renderModelsPanel();
      case 'api-keys': return renderApiKeysPanel();
      case 'shortcuts': return renderShortcutsPanel();
      case 'permissions': return <PermissionsPanel />;
      case 'gizziio-code': return renderGizziioCodePanel();
      case 'cowork': return renderCoworkPanel();
      case 'extensions': return renderExtensionsPanel();
      case 'billing': return renderBillingPanel();
      case 'privacy': return renderPrivacyPanel();
      case 'usage': return renderUsagePanel();
      case 'diagnostics': return <DiagnosticsPanel />;
      case 'infrastructure': return <ToastProvider><InfrastructureSettings initialTab={infrastructureTab as any} /></ToastProvider>;
      case 'environment': return <ToastProvider><EnvironmentSettings /></ToastProvider>;
      case 'security': return <ToastProvider>{renderSecurityPanel()}</ToastProvider>;
      case 'agents': return <ToastProvider>{renderAgentsPanel()}</ToastProvider>;
      case 'about': return renderAboutPanel();
      case 'signin': return <ClerkAuthPanel />;
      case 'skills': return renderSkillsPanel();
      case 'connectors': return renderConnectorsPanel();
      case 'plugins': return renderPluginsPanel();
      case 'vps': return <ToastProvider><VPSConnectionsPanel /></ToastProvider>;
      default: return null;
    }
  };

  const navigationItems = SETTINGS_NAV_ITEMS;

  const navSearch = navQuery.trim().toLowerCase();
  const filteredNavItems = navSearch
    ? navigationItems.filter((item: any) => item.label.toLowerCase().includes(navSearch))
    : navigationItems;

  const closeSettings = () => window.dispatchEvent(new CustomEvent('allternit:close-settings'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px] text-[var(--text-primary)] font-sans"
      onClick={closeSettings}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="flex w-full max-w-[1000px] min-w-[600px] h-[80vh] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-solid border-white/10 bg-[var(--view-settings-bg,var(--surface-canvas))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar Nav */}
        <div className="w-[220px] min-w-[180px] h-full bg-transparent p-4 pb-8 overflow-y-auto shrink-0 no-scrollbar border-r border-solid border-white/[0.03]">
          <div className="relative mb-5">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="w-full pl-8 pr-3 py-2 rounded-full bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <nav className="flex flex-col">
            {SETTINGS_NAV_GROUPS.map((g) => {
              const groupItems = filteredNavItems.filter((i: any) => i.group === g.group);
              if (groupItems.length === 0) return null;
              return (
                <div key={g.group} className="mb-4 last:mb-0">
                  {g.label && (
                    <div className="px-3 mb-1 text-[12px] font-medium text-[var(--text-tertiary)]">{g.label}</div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {groupItems.map((item: any) => (
                      <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredNavItems.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--text-tertiary)]">No matching settings</div>
            )}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 h-full relative bg-[radial-gradient(circle_at_top_right,rgba(212,176,140,0.03),transparent_600px)]">
          <button type="button"
            onClick={closeSettings}
            className="absolute top-4 right-4 z-10 size-7 flex items-center justify-center rounded-lg bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
            aria-label="Close settings"
          >
            <X size={16} weight="bold" />
          </button>
          <div className="h-full overflow-y-auto">
          <div className="p-10 pb-32 w-full max-w-[740px]">
            <h1 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-6">
              {navigationItems.find((item: any) => item.id === activeSection)?.label}
            </h1>
            {renderContent()}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
