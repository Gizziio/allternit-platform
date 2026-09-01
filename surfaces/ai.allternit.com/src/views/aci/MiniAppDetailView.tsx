"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  CircleNotch,
  CloudArrowUp,
  GithubLogo,
  Globe,
  PushPin,
  PushPinSlash,
  Stop,
  Trash,
  Wrench,
  Download,
} from "@phosphor-icons/react";
import type { InstalledMiniApp } from "./mini-app.types";
import {
  updateMiniAppInstallStatus,
  updateMiniAppStatus,
} from "./mini-app-registry";
import { resolveMiniAppPresentation } from "./mini-app-presentation";
import { MiniAppIcon } from "./MiniAppIcon";
import { MiniAppConfigureModal } from "./MiniAppConfigureModal";
import { MiniAppConnectionsPanel } from "./MiniAppConnectionsPanel";
import { MiniAppPublishModal } from "./MiniAppPublishModal";
import { MiniAppSecretsPanel } from "./MiniAppSecretsPanel";

export function MiniAppDetailView({
  app,
  onBack,
  onOpen,
  onPin,
  onUnpin,
  onRemove,
  onUpdate,
}: {
  app: InstalledMiniApp;
  onBack: () => void;
  onOpen: (app: InstalledMiniApp) => void;
  onPin: (app: InstalledMiniApp) => void;
  onUnpin: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (app: InstalledMiniApp) => void;
}) {
  const pinned = app.status !== "available" && app.isPinned !== false;
  const miniApps =
    typeof window !== "undefined" ? window.allternit?.miniApps : undefined;
  const [running, setRunning] = useState(app.status === "running");
  const [busy, setBusy] = useState<
    "checking" | "installing" | "starting" | "stopping" | null
  >(app.registryName ? null : "checking");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const canLaunch = !app.registryName && running;
  const presentation = resolveMiniAppPresentation(app);
  const canOpenWithoutRuntime = !app.registryName && !app.downloadable && !app.requiresRuntimeApproval && Boolean(presentation.uiUrl || presentation.mode === "native");

  useEffect(() => {
    if (!miniApps || app.registryName) {
      setBusy(null);
      return;
    }
    void miniApps
      .getStatus(app.id)
      .then((status) => {
        setRunning(status.running);
        updateMiniAppStatus(app.id, status.running ? "running" : "offline");
        setBusy(null);
      })
      .catch(() => setBusy(null));
    return miniApps.onProgress((event) => {
      if (event.id === app.id)
        setLogs((current) => [...current.slice(-60), event.line]);
    });
  }, [app.id, app.registryName, miniApps]);

  const setupAndStart = async () => {
    if (!miniApps) return;
    if (app.installState !== "installed") onPin(app);
    setError("");
    setLogs([]);
    setBusy("starting");
    let result = await miniApps.start(app.id);
    if (!result.success) {
      setBusy("installing");
      updateMiniAppInstallStatus(app.id, "installing");
      const installed = await miniApps.install(app.id);
      if (!installed.success) {
        setError(installed.error ?? "Installation failed");
        setBusy(null);
        return;
      }
      updateMiniAppInstallStatus(app.id, "installed");
      setBusy("starting");
      result = await miniApps.start(app.id);
    }
    if (!result.success) {
      setError(result.error ?? "Runtime failed to start");
      setBusy(null);
      return;
    }
    setRunning(true);
    updateMiniAppStatus(app.id, "running");
    setBusy(null);
  };

  const stopRuntime = async () => {
    if (!miniApps) return;
    setBusy("stopping");
    setError("");
    const result = await miniApps.stop(app.id);
    if (!result.success) {
      setError("Runtime failed to stop");
      setBusy(null);
      return;
    }
    setRunning(false);
    updateMiniAppStatus(app.id, "offline");
    setBusy(null);
  };

  const approveRuntime = async () => {
    if (!miniApps?.reviewAndApprove) return;
    setApprovalError("");
    const result = await miniApps.reviewAndApprove({
      id: app.id,
      name: app.name,
      version: app.version,
      installCommand: app.lifecycle?.install?.command,
      startCommand: app.lifecycle?.start?.command,
      stopCommand: app.lifecycle?.stop?.command,
      healthUrl: app.lifecycle?.health?.url,
      permissions: app.permissions,
      oauth: app.oauth,
    });
    if (!result.success || !result.approved) {
      if (result.error) setApprovalError(result.error);
      return;
    }
    onUpdate({ ...app, requiresRuntimeApproval: false, installState: app.lifecycle?.install ? "not-installed" : "installed" });
  };

  const exportManifest = () => {
    const manifest = {
      id: app.id, name: app.name, description: app.description, version: app.version || "0.1.0", icon: app.icon,
      category: app.category, pinnable: true, repo: app.repo, githubUrl: app.githubUrl, downloadable: app.downloadable,
      presentation: app.presentation, harness: app.harness, lifecycle: app.lifecycle, permissions: app.permissions,
      compatibility: app.compatibility, release: app.release, oauth: app.oauth,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "miniapp.json"; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-5xl px-8 pb-16 pt-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={16} /> Back to Miniapps Store
        </button>
        <div className="flex flex-col gap-6 border-b border-[var(--border-subtle)] pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)]">
              <MiniAppIcon app={app} size={80} />
            </div>
            <div>
              <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                {app.category}
              </span>
              <h1
                className="mt-3 text-3xl font-medium tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {app.name}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Version {app.version || "latest"} · {app.source}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfigureOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"><Wrench size={15} />Configure</button>
            <button type="button" onClick={exportManifest} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"><Download size={15} />Export manifest</button>
            {!app.registryName && (
              <button type="button" onClick={() => setPublishOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"><CloudArrowUp size={15} />Publish</button>
            )}
            <button
              type="button"
              onClick={() => (pinned ? onUnpin(app.id) : onPin(app))}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
            >
              {pinned ? <PushPinSlash size={16} /> : <PushPin size={16} />}
              {pinned ? "Unpin" : app.registryName ? "Connect" : "Add"}
            </button>
            {app.catalogOnly || app.requiresRuntimeApproval ? null : app.registryName ? null : canOpenWithoutRuntime ? (
              <button type="button" onClick={() => onOpen(app)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)]">
                Open <ArrowSquareOut size={15} />
              </button>
            ) : canLaunch ? (
              <>
                <button
                  type="button"
                  onClick={() => void stopRuntime()}
                  disabled={Boolean(busy)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)] disabled:opacity-50"
                >
                  <Stop size={15} /> Stop
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(app)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)]"
                >
                  Open <ArrowSquareOut size={15} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void setupAndStart()}
                disabled={!miniApps || Boolean(busy)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
              >
                {busy ? (
                  <CircleNotch size={15} className="animate-spin" />
                ) : null}
                {busy === "installing"
                  ? "Installing…"
                  : busy === "starting"
                    ? "Starting…"
                    : busy === "checking"
                      ? "Checking…"
                      : "Set up and start"}
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}
        {app.catalogOnly && (
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
            This community listing does not yet declare a reviewed installer. Add it to My Miniapps as a draft, then complete its runtime, permissions, and presentation configuration before launch.
          </div>
        )}
        {app.requiresRuntimeApproval && (
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
            Runtime commands are configured but not approved. Allternit Desktop must review the commands and requested permissions before installation or launch is enabled.
            {miniApps?.reviewAndApprove && <button type="button" onClick={() => void approveRuntime()} className="mt-3 block h-9 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)]">Review and approve runtime</button>}
            {approvalError && <p className="mt-2 text-xs text-red-500">{approvalError}</p>}
          </div>
        )}
        {logs.length > 0 && (
          <pre className="mt-5 max-h-44 overflow-auto rounded-xl bg-black/90 p-4 text-[11px] leading-5 text-neutral-300">
            {logs.join("\n")}
          </pre>
        )}
        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main>
            <h2 className="text-lg font-semibold">About this miniapp</h2>
            <p className="mt-3 text-[15px] leading-7 text-[var(--text-secondary)]">
              {app.description}
            </p>
            <h2 className="mt-10 text-lg font-semibold">Integration</h2>
            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] p-5 text-sm text-[var(--text-secondary)]">
              <p>
                Experience:{" "}
                <span className="text-[var(--text-primary)]">
                  {presentation.mode === "hybrid"
                    ? "Allternit controls + embedded app"
                    : presentation.mode === "embedded"
                      ? "Embedded app"
                      : "Native Allternit interface"}
                </span>
              </p>
              {presentation.nativeRenderer && (
                <p className="mt-3">
                  Native renderer:{" "}
                  <span className="text-[var(--text-primary)]">
                    {presentation.nativeRenderer}
                  </span>
                </p>
              )}
              <p className="mt-3">
                Transport:{" "}
                <span className="text-[var(--text-primary)]">
                  {app.harness?.transport || "Web"}
                </span>
              </p>
              {app.harness?.model && (
                <p className="mt-3">
                  Model:{" "}
                  <span className="text-[var(--text-primary)]">
                    {app.harness.model}
                  </span>
                </p>
              )}
            </div>
          </main>
          <aside className="self-start">
            <div className="rounded-xl border border-[var(--border-subtle)] p-5">
            <h2 className="text-sm font-semibold">Miniapp details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--text-tertiary)]">Status</dt>
                <dd className="mt-1 capitalize">
                  {app.registryName
                    ? pinned
                      ? "connected"
                      : "available"
                    : running
                      ? "running"
                      : busy || "stopped"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-tertiary)]">Marketplace</dt>
                <dd className="mt-1 capitalize">{app.catalogSource || app.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-tertiary)]">
                  Category
                </dt>
                <dd className="mt-1 capitalize">{app.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-tertiary)]">Source</dt>
                <dd className="mt-1 capitalize">{app.source}</dd>
              </div>
              {app.release?.publishedAt && <div><dt className="text-xs text-[var(--text-tertiary)]">Published</dt><dd className="mt-1">{new Date(app.release.publishedAt).toLocaleDateString()}</dd></div>}
            </dl>
            {app.githubUrl && (
              <a
                href={app.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
              >
                <GithubLogo size={16} /> View source
              </a>
            )}
            {app.url && (
              <div className="mt-3 flex items-center gap-2 truncate text-xs text-[var(--text-tertiary)]">
                <Globe size={14} /> {app.url}
              </div>
            )}
            {app.installState === "installed" && (
              <button
                type="button"
                onClick={() => onRemove(app.id)}
                className="mt-6 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 text-sm text-red-500 hover:bg-red-500/10"
              >
                <Trash size={15} /> Remove miniapp
              </button>
            )}
            </div>
            <MiniAppSecretsPanel app={app} />
            <MiniAppConnectionsPanel app={app} />
          </aside>
        </div>
      </div>
      <MiniAppConfigureModal app={app} isOpen={configureOpen} onClose={() => setConfigureOpen(false)} onSave={onUpdate} />
      <MiniAppPublishModal app={app} isOpen={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  );
}
