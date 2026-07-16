"use client";

import React from "react";
import { ArrowLeft, ArrowSquareOut, CheckCircle, LockKey, Plus, ToggleLeft, ToggleRight, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Extension } from "./BrowserExtensions.types";
import { ExtensionLogo } from "./ExtensionLogo";

const PERMISSION_COPY: Record<string, string> = {
  scripts: "Run approved automation on pages you open.",
  clipboard: "Read or write clipboard content when an action requires it.",
  downloads: "Create and manage files downloaded by an agent run.",
  tabs: "Read the active tab and open related browser surfaces.",
};

export function ExtensionDetailView({ extension, onBack, onToggle, onInstall, onUninstall }: {
  extension: Extension;
  onBack: () => void;
  onToggle: (id: string) => void;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  const openExtension = () => {
    if (extension.surfaceViewType) {
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: extension.surfaceViewType } }));
      return;
    }
    if (extension.launchUrl) window.open(extension.launchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-5xl px-8 pb-16 pt-8">
        <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} /> Back to extensions
        </button>

        <div className="flex flex-col gap-6 border-b border-[var(--border-subtle)] pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <ExtensionLogo extension={extension} size="detail" />
            <div className="min-w-0 pt-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{extension.category}</span>
                {extension.isInstalled && <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-green-600"><CheckCircle size={12} weight="fill" /> Installed</span>}
              </div>
              <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{extension.name}</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">By {extension.author} · Version {extension.version}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {extension.isInstalled ? (
              <>
                <button type="button" onClick={() => onToggle(extension.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
                  {extension.isEnabled ? <ToggleRight size={20} weight="fill" className="text-[var(--accent-primary)]" /> : <ToggleLeft size={20} weight="fill" />}
                  {extension.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                {(extension.surfaceViewType || extension.launchUrl) && <button type="button" onClick={openExtension} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90">Open <ArrowSquareOut size={15} /></button>}
              </>
            ) : (
              <button type="button" onClick={() => onInstall(extension.id)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"><Plus size={16} /> Install</button>
            )}
          </div>
        </div>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0">
            <section>
              <h2 className="text-lg font-semibold">About this extension</h2>
              <p className="mt-3 text-[15px] leading-7 text-[var(--text-secondary)]">{extension.description}</p>
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-semibold">Capabilities and permissions</h2>
              {extension.permissions.length > 0 ? (
                <div className="mt-4 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                  {extension.permissions.map((permission) => (
                    <div key={permission} className="flex items-start gap-3 p-4">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]"><LockKey size={16} /></div>
                      <div><div className="text-sm font-medium capitalize text-[var(--text-primary)]">{permission.replace(/[-_]/g, ' ')}</div><p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{PERMISSION_COPY[permission] ?? `Allows ${extension.name} to use this capability when you approve it.`}</p></div>
                      <span className="ml-auto rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{extension.permissionDetails?.[permission] ?? 'ask'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-[var(--text-tertiary)]">This extension does not request additional browser permissions.</p>}
            </section>
          </main>

          <aside className="space-y-6">
            <div className="rounded-xl border border-[var(--border-subtle)] p-5">
              <h2 className="text-sm font-semibold">Extension details</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <Detail label="Publisher" value={extension.author} />
                <Detail label="Version" value={extension.version} />
                <Detail label="Category" value={extension.category} capitalize />
                <Detail label="Surface" value={extension.officeHost ? `Microsoft ${extension.officeHost}` : 'ACI Browser'} capitalize />
                <Detail label="Status" value={extension.isInstalled ? (extension.isEnabled ? 'Installed and enabled' : 'Installed and disabled') : 'Not installed'} />
              </dl>
            </div>

            {extension.isInstalled && <button type="button" onClick={() => onUninstall(extension.id)} className={cn("inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-sm transition-colors", extension.owned ? "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]" : "border-red-500/30 text-red-500 hover:bg-red-500/10")}>{extension.owned ? <X size={16} /> : <Trash size={16} />}{extension.owned ? 'Disable extension' : 'Uninstall extension'}</button>}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return <div><dt className="text-xs text-[var(--text-tertiary)]">{label}</dt><dd className={cn("mt-1 text-[var(--text-primary)]", capitalize && "capitalize")}>{value}</dd></div>;
}

