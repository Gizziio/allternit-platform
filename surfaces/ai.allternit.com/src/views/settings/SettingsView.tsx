/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsState } from '@/hooks/useSettingsState';

import { ResourceUsageDashboard } from '@/components/usage/ResourceUsageDashboard';
import { BrainsPanel } from '@/components/settings/BrainsPanel';
import {
  Cpu,
  Sun,
  Moon,
  DeviceMobile,
  HardDrives,
  Cloud,
  X,
  CaretRight,
  CheckCircle,
  ArrowsClockwise,
  ShieldCheck,
  DownloadSimple,
  MagnifyingGlass,
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
import { SettingsCard, SettingsCardRow } from '@/components/settings/SettingsCard';
import { MonoChip } from '@/components/settings/MonoChip';
import { AgentOpsPanel } from './AgentOpsPanel';
import { SecurityPanel } from './SecurityPanel';
import { SkillsSettingsPanel } from './SkillsSettingsPanel';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS, SETTINGS_SELECT_CLASS } from '@/components/settings/buttonStyles';
import { useFeaturePlugins } from '@/plugins/useFeaturePlugins';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────


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
  initialSection,
  initialTab,
  onOpenFullManager
}) => {
  // Guard against unknown section ids arriving via event detail
  const safeInitialSection: SettingsSection = SETTINGS_SECTION_MAP[initialSection ?? ''] ?? 'signin';
  const [activeSection, setActiveSection] = useState<SettingsSection>(safeInitialSection);
  const [navQuery, setNavQuery] = useState('');
  const [infrastructureTab, setInfrastructureTab] = useState<string | undefined>(initialTab);
  const featurePlugins = useFeaturePlugins();

  // Inline state adjustment for initialSection change
  const [prevInitialSection, setPrevInitialSection] = useState(safeInitialSection);
  if (safeInitialSection !== prevInitialSection) {
    setPrevInitialSection(safeInitialSection);
    setActiveSection(safeInitialSection);
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
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [compactDensity, setCompactDensity] = useSettingsState('appearance.compactDensity', false);
  const [showSidebarLabels, setTwoSidebarLabels] = useSettingsState('appearance.showSidebarLabels', true);
  const [streaming, setStreaming] = useState(true);
  const [bypassPermissions, setBypassPermissions] = useSettingsState('gizziio-code.bypassPermissions', false);
  const [drawAttentionNotifications, setDrawAttentionNotifications] = useSettingsState('gizziio-code.drawAttentionNotifications', true);
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
        <button type="button" onClick={() => window.open('https://allternit.com/terms', '_blank', 'noopener,noreferrer')} className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">Terms</button>
        <button type="button" onClick={() => window.open('https://allternit.com/privacy', '_blank', 'noopener,noreferrer')} className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">Privacy</button>
        <button type="button" onClick={() => window.open('https://github.com/allternit', '_blank', 'noopener,noreferrer')} className="bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium cursor-pointer">GitHub</button>
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
        <span className="text-[13px] text-[var(--accent-primary)] font-mono">~/Allternit/Cowork</span>
      </SettingsRow>

      <SectionHeading>Access</SectionHeading>
      <SettingsRow label="Trusted folders" description="Folders Cowork agents may read and write">
        <span className="text-[13px] text-[var(--text-tertiary)]">Coming soon</span>
      </SettingsRow>
      <SettingsRow label="Global instructions" description="Instructions applied to every Cowork session">
        <span className="text-[13px] text-[var(--text-tertiary)]">Coming soon</span>
      </SettingsRow>
    </div>
  );

  const renderExtensionsPanel = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionHeading className="mb-1">Extensions</SectionHeading>
          <p className="text-[13px] text-[var(--text-secondary)] m-0 leading-relaxed">
            Allow Allternit to directly interact with apps, data, and tools on your computer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'marketplace' } }))}
          className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer transition-colors hover:brightness-110"
        >
          Browse extensions
        </button>
      </div>

      <EmptyState
        icon={<PuzzlePiece size={56} weight="thin" />}
        title="No extensions installed"
        caption="Extensions let Allternit connect to external tools and services."
        ctaLabel="Browse extensions"
        primaryCta
        onCtaClick={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'marketplace' } }))}
      />

      <SettingsCard title="Extension settings" description="Configure how extensions are installed and updated.">
        <SettingsCardRow
          label="Enable auto-updates for extensions"
          description="Background update all marketplace and sidecar extensions"
        >
          <Toggle value={autoUpdateExtensions} onChange={setAutoUpdateExtensions} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Use Built-in Node.js for MCP"
          description="Ensure stability by using Allternit's verified runtime"
        >
          <Toggle value={useBuiltinNode} onChange={setUseBuiltinNode} />
        </SettingsCardRow>
      </SettingsCard>
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
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => window.open('https://billing.allternit.com', '_blank', 'noopener,noreferrer')}>
          Manage billing portal
        </button>
      </SettingsRow>
    </div>
  );

  const renderUsagePanel = () => {
    const handleUsageRefresh = () => {
      setUsageRefreshing(true);
      setTimeout(() => {
        setUsageUpdatedLabel('just now');
        setUsageRefreshing(false);
      }, 600);
    };

    return (
      <div>
        <EmptyState
          icon={<ArrowsClockwise size={40} weight="thin" />}
          caption="Real-time usage breakdown is not available yet. Refresh to check again."
          ctaLabel={usageRefreshing ? 'Refreshing…' : 'Refresh'}
          onCtaClick={handleUsageRefresh}
        />
        <div className="flex items-center justify-end py-3">
          <span className="text-[12px] text-[var(--text-tertiary)]">Last updated: {usageUpdatedLabel}</span>
        </div>
        <SectionHeading>Usage details</SectionHeading>
        <ResourceUsageDashboard />
      </div>
    );
  };

  const handleExportData = () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith('allternit')) continue;
      const raw = window.localStorage.getItem(key);
      try { data[key] = JSON.parse(raw ?? 'null'); } catch { data[key] = raw; }
    }
    const payload = { exportedAt: new Date().toISOString(), source: 'allternit-platform-settings', data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allternit-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      <SettingsRow label="Export data" description="Download your local settings and preferences as JSON">
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={handleExportData}>
          <DownloadSimple size={14} /> Export
        </button>
      </SettingsRow>
      <SettingsRow label="Memory preferences" description="Control what Allternit remembers between sessions">
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => {
          window.dispatchEvent(new CustomEvent('allternit:close-settings'));
          window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'memory' } }));
        }}>Manage</button>
      </SettingsRow>
    </div>
  );

  const renderSkillsPanel = () => (
    <SkillsSettingsPanel onBrowse={() => onOpenFullManager?.('skills')} />
  );

  const renderConnectorsPanel = () => (
    <div>
      <PanelHeader title="Connectors">
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => onOpenFullManager?.('connectors')}>
          Open full manager
        </button>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void fetchConnectors()} disabled={connectorsLoading}>
          <ArrowsClockwise size={14} className={connectorsLoading ? 'animate-spin' : ''} /> Refresh
        </button>
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

  const renderCapabilityRow = ({
    id,
    name,
    description,
    meta,
    enabled,
    onToggle,
  }: {
    id: string;
    name: string;
    description?: string;
    meta?: string;
    enabled: boolean;
    onToggle: () => void;
  }) => (
    <SettingsRow key={id} label={name} description={description || meta || 'No description provided'}>
      <div className="flex items-center gap-3">
        {meta && <span className="hidden md:inline max-w-[150px] truncate text-[11px] text-[var(--text-tertiary)]">{meta}</span>}
        <Toggle value={enabled} onChange={onToggle} />
      </div>
    </SettingsRow>
  );

  // Note: this panel shows built-in FEATURE toggles (featurePlugins —
  // enable/disable whole app features like Design/Cowork surfaces), which is
  // a real, distinct concept from the installed marketplace plugin packages
  // shown in the full manager's own "Plugins" tab — the two aren't actually
  // duplicates despite the name overlap. This used to also render a
  // "Skills" sub-list from the static BUNDLED_SKILLS import, which WAS a
  // real duplicate of the (now real, filesystem-backed) Customize > Skills
  // panel above; that block is removed rather than kept in sync with two
  // data sources.
  const renderPluginsPanel = () => {
    const pluginRows = featurePlugins.allPlugins;

    return (
      <div>
        <PanelHeader title="Allternit Plugins">
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => onOpenFullManager?.('plugins')}>
            Open full manager
          </button>
        </PanelHeader>
        <SectionHeading>Features</SectionHeading>
        {pluginRows.length === 0 ? (
          <EmptyState
            icon={<PuzzlePiece size={40} weight="thin" />}
            caption="No plugins installed."
          />
        ) : (
          <div>
            {pluginRows.map((plugin) => renderCapabilityRow({
              id: plugin.id,
              name: plugin.name,
              description: plugin.description,
              meta: [
                plugin.builtin ? 'Built in' : undefined,
                plugin.category,
                plugin.version,
              ].filter(Boolean).join(' · '),
              enabled: featurePlugins.enabledIds.has(plugin.id),
              onToggle: () => featurePlugins.toggle(plugin.id),
            }))}
          </div>
        )}
      </div>
    );
  };

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
      case 'security': return <SecurityPanel />;
      case 'agents': return <AgentOpsPanel />;
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
        className={cn(
          "flex w-full min-w-[600px] h-[80vh] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-solid border-white/10 bg-[var(--view-settings-bg,var(--surface-canvas))]",
          'max-w-[1000px]'
        )}
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
