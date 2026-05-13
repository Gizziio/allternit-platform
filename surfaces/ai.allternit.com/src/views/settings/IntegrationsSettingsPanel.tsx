"use client";

import { useState, useCallback } from 'react';
import {
  AppWindow,
  Plus,
  Trash,
  ArrowsClockwise,
  PushPin,
  PushPinSlash,
  Link,
  PlugsConnected,
  Cpu,
  CircleNotch,
  Globe,
  Warning,
  CheckCircle,
} from '@phosphor-icons/react';
import { useMiniAppDiscovery } from '../aci/use-mini-app-discovery';
import { pinMiniApp, unpinMiniApp } from '../aci/mini-app-registry';
import type { InstalledMiniApp } from '../aci/mini-app.types';

const STATUS_ICON: Record<InstalledMiniApp['status'], React.ReactNode> = {
  running: <span className="size-1.5  rounded-full bg-green-500 inline-block" />,
  available: <span className="size-1.5  rounded-full bg-blue-400 inline-block" />,
  pinned: <span className="size-1.5  rounded-full bg-[var(--border-strong)] inline-block" />,
  offline: <span className="size-1.5  rounded-full bg-[var(--status-error)] inline-block" />,
};

function MiniAppRow({ app, onPin, onUnpin }: {
  app: InstalledMiniApp;
  onPin: (app: InstalledMiniApp) => void;
  onUnpin: (id: string) => void;
}) {
  const isPinned = app.status === 'pinned' || app.status === 'running';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)] transition-colors">
      <div className="flex size-8  shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <Cpu size={14} className="text-[var(--text-secondary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{app.name}</span>
          {STATUS_ICON[app.status]}
          {app.version && <span className="text-[12px] text-[var(--text-tertiary)]">v{app.version}</span>}
        </div>
        <p className="text-xs text-[var(--text-secondary)] truncate">{app.description}</p>
        {app.sourceUrl && (
          <p className="text-[12px] text-[var(--text-tertiary)] font-mono">{app.sourceUrl}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {isPinned ? (
          <button
            onClick={() => onUnpin(app.id)}
            className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--status-error)] hover:text-[var(--status-error)] transition-colors"
            title="Unpin from ACI"
          >
            <PushPinSlash size={11} />
            Unpin
          </button>
        ) : (
          <button
            onClick={() => onPin(app)}
            className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
            title="Pin to ACI mini-apps"
          >
            <PushPin size={11} />
            Pin to ACI
          </button>
        )}
      </div>
    </div>
  );
}

function AddUrlForm({ onAdd }: { onAdd: (url: string, name: string) => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  const submit = useCallback(() => {
    const trimUrl = url.trim();
    const trimName = name.trim() || trimUrl;
    if (!trimUrl) return;
    onAdd(trimUrl, trimName);
    setUrl('');
    setName('');
    setOpen(false);
  }, [url, name, onAdd]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-2.5 text-sm text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <Plus size={14} />
        Add custom URL
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-secondary)] p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="h-7 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="https://…"
          className="h-7 flex-[2] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">Cancel</button>
        <button onClick={submit} disabled={!url.trim()} className="rounded bg-[var(--accent-primary)] px-3 py-1 text-xs text-white disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

export function IntegrationsSettingsPanel() {
  const { all, discovered, pinned, probing, reprobe } = useMiniAppDiscovery();

  const handlePin = useCallback((app: InstalledMiniApp) => {
    pinMiniApp(app);
  }, []);

  const handleUnpin = useCallback((id: string) => {
    unpinMiniApp(id);
  }, []);

  const handleAddUrl = useCallback((url: string, name: string) => {
    pinMiniApp({
      id: `custom-${Date.now()}`,
      name,
      description: url,
      category: 'custom',
      source: 'url',
      url,
    });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-6 py-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Integrations</h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Manage mini-apps, MCP servers, and connected services. Everything added here is accessible across the platform.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-8">

        {/* Mini-apps */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AppWindow size={14} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Mini-apps</span>
              <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[12px] text-[var(--text-tertiary)]">
                {all.length}
              </span>
            </div>
            <button
              onClick={reprobe}
              disabled={probing}
              className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              title="Re-scan for local services"
            >
              {probing
                ? <CircleNotch size={11} className="animate-spin" />
                : <ArrowsClockwise size={11} />}
              Scan
            </button>
          </div>

          {discovered.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
              <CheckCircle size={11} className="text-green-500" />
              {discovered.length} service{discovered.length !== 1 ? 's' : ''} found on localhost
            </div>
          )}

          {all.length === 0 && !probing && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs text-[var(--text-tertiary)]">
              <Warning size={13} />
              No local services found. Start OpenClaw or Hermes and click Scan.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {all.map((app) => (
              <MiniAppRow key={app.id} app={app} onPin={handlePin} onUnpin={handleUnpin} />
            ))}
            <AddUrlForm onAdd={handleAddUrl} />
          </div>
        </section>

        {/* MCP Servers */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlugsConnected size={14} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">MCP Servers</span>
            </div>
            <button className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]">
              <Plus size={11} />
              Add server
            </button>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            MCP servers expose tools and resources to agents. Manage detailed config in{' '}
            <button className="text-[var(--accent-primary)] underline underline-offset-2">Capability Manager</button>.
          </p>
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
            No MCP servers configured. Add a server to expose tools to your agents.
          </div>
        </section>

        {/* Connected Apps */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link size={14} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Connected Apps</span>
            </div>
            <button className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]">
              <Plus size={11} />
              Connect app
            </button>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            OAuth-connected services (Notion, Linear, GitHub, Slack). Once connected they appear as available mini-apps in ACI and as context sources in chat and projects.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Notion', 'Linear', 'GitHub', 'Slack', 'Figma', 'Jira', 'Airtable'].map((app) => (
              <button
                key={app}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Globe size={11} />
                {app}
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
