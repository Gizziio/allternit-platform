import React, { useEffect, useMemo, useRef, useState } from "react";
import { useModelDiscovery } from "@/integration/api-client";
import { getProviderMeta, PROVIDER_REGISTRY, type ProviderKind, type ProviderMeta } from "@/lib/providers/provider-registry";
import {
  Check,
  Shield,
  Key,
  Warning,
  CaretRight,
  CircleNotch,
  ArrowSquareOut,
  Download,
  Terminal,
  Copy,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProviderCardProps {
  providerId: string;
  name: string;
  icon: string;
  color: string;
  kind: ProviderKind;
  authenticated: boolean;
  status: string;
  onClick: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  name,
  icon,
  color,
  kind,
  authenticated,
  status,
  onClick,
}) => {
  const src = icon ? `/assets/runtime-logos/${icon}` : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all group relative overflow-hidden",
        authenticated
          ? "bg-[var(--surface-hover)] border-[var(--ui-border-default)]"
          : "bg-transparent border-[var(--ui-border-muted)] hover:bg-[var(--surface-hover)]"
      )}
    >

      <div className="size-16 flex items-center justify-center relative z-10">
        {src ? (
          <img
            src={src}
            alt={name}
            className="size-12 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Terminal size={40} className="text-[var(--ui-text-muted)]" />
        )}

        {authenticated && (
          <div className="absolute -top-1 -right-1 size-5 rounded-full bg-status-success flex items-center justify-center border-2 border-[var(--shell-view-bg)]">
            <Check className="size-3 text-[var(--ui-text-inverse)]" />
          </div>
        )}
      </div>

      <div className="text-center relative z-10">
        <h3 className="font-semibold text-[var(--ui-text-primary)] text-sm">
          {name}
        </h3>
        <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
          {authenticated
            ? "Connected"
            : kind === "cli"
            ? status === "offline"
              ? "Not installed"
              : "Sign in"
            : "Not connected"}
        </p>
      </div>

      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CaretRight className="size-4 text-[var(--ui-text-muted)]" />
      </div>
    </button>
  );
};

type ConnectPhase =
  | { phase: "idle" }
  | { phase: "busy" }
  | { phase: "polling"; label: string }
  | { phase: "confirm"; label: string }
  | { phase: "needs_key"; label: string; page?: string }
  | { phase: "not_installed"; label: string; page?: string; binary?: string }
  | { phase: "api_key" }
  | { phase: "error"; message: string };

type ConnectTab = "cli" | "api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(text || `${res.status}`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

interface ProviderGalleryProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Pre-select a provider when the gallery opens (e.g. "claude" or "openai"). */
  initialProvider?: string | null;
}

export const ProviderGallery: React.FC<ProviderGalleryProps> = ({
  isOpen = false,
  onClose,
  initialProvider,
}) => {
  const { providers, fetchProviders, providersLoading } = useModelDiscovery();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState<ConnectPhase>({ phase: "idle" });
  const [connectTab, setConnectTab] = useState<ConnectTab>("cli");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const currentMeta = selectedProvider
    ? getProviderMeta(selectedProvider)
    : null;

  // If the backend is unreachable, still show the registry so the user can
  // see which CLI/API providers are supported and connect them.
  const displayProviders = useMemo(() => {
    if (providers.length > 0) return providers;
    return Object.values(PROVIDER_REGISTRY).map((meta) => ({
      provider_id: meta.id,
      authenticated: false,
      status: meta.kind === "cli" ? "offline" : "unconfigured",
    }));
  }, [providers]);

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen, fetchProviders]);

  useEffect(() => {
    if (isOpen && initialProvider) {
      const meta = getProviderMeta(initialProvider);
      if (meta.id !== "allternit") {
        handleSelectProvider(meta.id);
      }
    }
  }, [isOpen, initialProvider]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setApiKey("");
      setError(null);
      setPhase({ phase: "idle" });
      setConnectTab("cli");
      setCopied(false);
      setCopiedCommand(null);
      Object.values(pollTimers.current).forEach(clearInterval);
      pollTimers.current = {};
    }
  }, [isOpen]);

  const stopPoll = (id: string) => {
    if (pollTimers.current[id]) {
      clearInterval(pollTimers.current[id]);
      delete pollTimers.current[id];
    }
  };

  const startPoll = (id: string, label: string) => {
    stopPoll(id);
    setPhase({ phase: "polling", label });
    let elapsed = 0;
    pollTimers.current[id] = setInterval(async () => {
      elapsed += 2000;
      try {
        const s = await api<{ status: string }>(
          `/api/v1/providers/${encodeURIComponent(id)}/connect/status`
        );
        if (s.status === "success") {
          stopPoll(id);
          setSelectedProvider(null);
          setPhase({ phase: "idle" });
          await fetchProviders();
        }
      } catch {
        // keep polling; detection may lag
      }
      if (elapsed >= 120_000) {
        stopPoll(id);
        setPhase({ phase: "confirm", label });
      }
    }, 2000);
  };

  const handleSelectProvider = (id: string) => {
    const meta = getProviderMeta(id);
    setSelectedProvider(id);
    setConnectTab(meta.kind === "cli" ? "cli" : "api");
    setApiKey("");
    setError(null);
    setPhase({ phase: "idle" });
    setCopied(false);
    setCopiedCommand(null);
  };

  const handleConnect = async (id: string) => {
    setPhase({ phase: "busy" });
    setError(null);
    try {
      const r = await api<any>(`/api/v1/providers/${encodeURIComponent(id)}/connect`, {
        method: "POST",
      });
      switch (r.status) {
        case "already_connected":
          setSelectedProvider(null);
          setPhase({ phase: "idle" });
          await fetchProviders();
          break;
        case "started":
          startPoll(id, r.label ?? id);
          break;
        case "not_installed":
          setPhase({
            phase: "not_installed",
            label: r.label ?? id,
            page: r.page,
            binary: r.binary,
          });
          break;
        case "needs_api_key":
          setConnectTab("api");
          setPhase({ phase: "needs_key", label: r.label ?? id, page: r.page });
          break;
        default:
          setSelectedProvider(null);
          setPhase({ phase: "idle" });
          await fetchProviders();
      }
    } catch (e: any) {
      // 404 unknown_provider => not a subscription/CLI brain; it uses an API key instead.
      if (e?.status === 404) {
        if (currentMeta?.kind === "cli") {
          setConnectTab("api");
        }
        setPhase({ phase: "api_key" });
      } else {
        setPhase({
          phase: "error",
          message: e?.message ?? "Connect failed",
        });
      }
    }
  };

  const handleConfirm = async (id: string) => {
    setPhase({ phase: "busy" });
    try {
      await api(`/api/v1/providers/${encodeURIComponent(id)}/connect/confirm`, {
        method: "POST",
      });
      setSelectedProvider(null);
      setPhase({ phase: "idle" });
      await fetchProviders();
    } catch (e: any) {
      setPhase({
        phase: "error",
        message: e?.message ?? "Confirm failed",
      });
    }
  };

  const saveApiKey = async (id: string) => {
    const key = apiKey.trim();
    if (!key) return;
    setIsSaving(true);
    setError(null);
    try {
      await api("/api/v1/onboarding/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: id,
          name: currentMeta?.name || id,
          apiKey: key,
          authType: "api_key",
          setDefault: false,
        }),
      });
      setApiKey("");
      setSelectedProvider(null);
      setPhase({ phase: "idle" });
      setConnectTab("cli");
      await fetchProviders();
    } catch (failure: any) {
      setPhase({
        phase: "error",
        message: failure?.message ?? "Could not store provider credential",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const closeConnectDialog = () => {
    if (selectedProvider) {
      stopPoll(selectedProvider);
    }
    setSelectedProvider(null);
    setApiKey("");
    setError(null);
    setPhase({ phase: "idle" });
    setConnectTab("cli");
    setCopied(false);
    setCopiedCommand(null);
  };

  const copyCommand = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCommand(label);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setCopiedCommand(null);
      }, 1500);
    });
  };

  const installCli = async (meta: ProviderMeta) => {
    if (!meta.installCommand) return;
    try {
      await navigator.clipboard.writeText(meta.installCommand);
      setCopiedCommand("install");
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setCopiedCommand(null);
      }, 1500);
    } catch {
      // Clipboard denied; fall through to opening terminal anyway.
    }
    // Ask the shell to open a terminal so the user can paste and run the command.
    window.dispatchEvent(
      new CustomEvent("allternit:open-terminal", {
        detail: { command: meta.installCommand, provider: meta.id },
      })
    );
  };

  const renderCliInstructions = () => {
    if (!currentMeta || currentMeta.kind !== "cli") return null;
    const { cliCommand, installCommand, authCommand, homepage, description } =
      currentMeta;

    const authCmd = authCommand || cliCommand;

    return (
      <div className="space-y-4">
        {description && (
          <p className="text-sm text-[var(--ui-text-secondary)]">{description}</p>
        )}

        <div className="rounded-xl border border-[var(--ui-border-default)] bg-[var(--surface-panel)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ui-text-muted)] uppercase tracking-wide">
              Install
            </span>
            {installCommand && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => installCli(currentMeta)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-chat)] hover:underline"
                >
                  <Download size={12} />
                  Install
                </button>
                <span className="text-[var(--ui-border-strong)]">|</span>
                <button
                  type="button"
                  onClick={() => copyCommand(installCommand, "install")}
                  className="flex items-center gap-1 text-xs text-[var(--accent-chat)] hover:underline"
                >
                  {copied && copiedCommand === "install" ? <Check size={12} /> : <Copy size={12} />}
                  {copied && copiedCommand === "install" ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
          {installCommand ? (
            <code className="block text-xs font-mono text-[var(--ui-text-primary)] break-all">
              {installCommand}
            </code>
          ) : (
            <p className="text-xs text-[var(--ui-text-muted)]">
              This CLI is bundled with its host application. Install the app and make sure{" "}
              <code className="font-mono">{cliCommand}</code> is on your PATH.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--ui-border-default)] bg-[var(--surface-panel)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ui-text-muted)] uppercase tracking-wide">
              Authenticate
            </span>
            {authCmd && (
              <button
                type="button"
                onClick={() => copyCommand(authCmd, "auth")}
                className="flex items-center gap-1 text-xs text-[var(--accent-chat)] hover:underline"
              >
                {copied && copiedCommand === "auth" ? <Check size={12} /> : <Copy size={12} />}
                {copied && copiedCommand === "auth" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--ui-text-secondary)]">
            Run this in your terminal to sign in with your existing subscription:
          </p>
          <code className="block text-xs font-mono text-[var(--ui-text-primary)] break-all">
            {authCmd}
          </code>
        </div>

        {homepage && (
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[var(--ui-border-default)] text-sm text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowSquareOut className="size-4" />
            Visit {currentMeta.name}
          </a>
        )}
      </div>
    );
  };

  const renderApiKeyForm = () => {
    if (!currentMeta) return null;
    const page = phase.phase === "needs_key" ? phase.page : undefined;

    return (
      <div className="space-y-3">
        {page && (
          <p className="text-sm text-[var(--ui-text-secondary)]">
            Get an API key from{" "}
            <a
              href={page}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent-chat)] hover:underline"
            >
              {currentMeta.name}
              <ArrowSquareOut className="size-3" />
            </a>
            .
          </p>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--ui-text-secondary)] flex items-center gap-2">
            <Key className="size-3.5" />
            API Key
          </div>
          <input
            aria-label={`Enter your ${currentMeta.name}`}
            type="password"
            placeholder={`Enter your ${currentMeta.name} API key…`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-[var(--surface-panel)] border border-[var(--ui-border-default)] rounded-xl px-4 py-3 text-sm text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-muted)] outline-none focus:border-[var(--accent-chat)]/50 transition-all"
          />
          <p className="text-[12px] text-[var(--ui-text-muted)] flex items-center gap-1.5 mt-1.5 px-1">
            <Shield size={12} />
            Your key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>
    );
  };

  const isCliProvider = currentMeta?.kind === "cli";
  const showCliTab = isCliProvider && connectTab === "cli";
  const showApiTab = (isCliProvider && connectTab === "api") || !isCliProvider;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className="sm:max-w-3xl border border-[var(--ui-border-default)] bg-[var(--shell-view-bg)] text-[var(--ui-text-primary)] p-0 overflow-hidden shadow-2xl"
        style={{
          background: "var(--shell-view-bg)",
          borderColor: "var(--ui-border-default)",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--ui-border-default)] px-6 py-5">
          <div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--ui-text-primary)] mb-1">
              Connect Providers
            </h2>
            <p className="text-[var(--ui-text-muted)] text-[var(--text-sm)]">
              Bring your own CLI tools and API keys. Allternit routes to the
              runtimes you already have installed and authenticated.
            </p>
          </div>
        </div>

        <div className="max-h-[min(72vh,560px)] overflow-y-auto px-6 py-6">
          {providersLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <CircleNotch className="size-8 text-[var(--ui-text-muted)] animate-spin" />
              <p className="text-[var(--ui-text-muted)] text-[var(--text-sm)]">
                Loading providers…
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {displayProviders.map((p) => {
                const meta = getProviderMeta(p.provider_id);
                return (
                  <ProviderCard
                    key={p.provider_id}
                    providerId={p.provider_id}
                    name={meta.name}
                    icon={meta.icon}
                    color={meta.color}
                    kind={meta.kind}
                    authenticated={p.authenticated}
                    status={p.status}
                    onClick={() => handleSelectProvider(p.provider_id)}
                  />
                );
              })}

            </div>
          )}
        </div>
      </DialogContent>

      {/* Connection Dialog */}
      <Dialog
        open={!!selectedProvider}
        onOpenChange={(open) => !open && closeConnectDialog()}
      >
        <DialogContent
          className="sm:max-w-md border border-[var(--ui-border-default)] bg-[var(--shell-view-bg)] text-[var(--ui-text-primary)] p-0 overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: "var(--shell-view-bg)",
            borderColor: "var(--ui-border-default)",
          }}
        >
          {currentMeta && selectedProvider && (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="size-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${currentMeta.color}20`,
                      border: `1px solid ${currentMeta.color}40`,
                    }}
                  >
                    {currentMeta.icon ? (
                      <img
                        src={`/assets/runtime-logos/${currentMeta.icon}`}
                        alt=""
                        className="size-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Terminal size={28} style={{ color: currentMeta.color }} />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-lg text-[var(--ui-text-primary)]">
                      Connect {currentMeta.name}
                    </DialogTitle>
                    <DialogDescription className="text-[var(--ui-text-muted)]">
                      {isCliProvider
                        ? "Install the CLI, sign in with your subscription, and it appears here."
                        : "Add your API key to start routing requests."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4">
                {/* CLI providers: CLI-first tabs */}
                {isCliProvider &&
                  phase.phase !== "busy" &&
                  phase.phase !== "polling" &&
                  phase.phase !== "error" && (
                    <div className="flex p-1 rounded-xl bg-[var(--surface-panel)] border border-[var(--ui-border-default)]">
                      <button
                        type="button"
                        onClick={() => setConnectTab("cli")}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                          connectTab === "cli"
                            ? "bg-[var(--bg-elevated)] text-[var(--ui-text-primary)] shadow-sm"
                            : "text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]"
                        )}
                      >
                        <Terminal className="size-3.5" />
                        CLI
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnectTab("api")}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                          connectTab === "api"
                            ? "bg-[var(--bg-elevated)] text-[var(--ui-text-primary)] shadow-sm"
                            : "text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]"
                        )}
                      >
                        <Key className="size-3.5" />
                        API Key
                      </button>
                    </div>
                  )}

                {/* CLI instructions tab */}
                {showCliTab && (
                  <>
                    {(phase.phase === "idle" ||
                      phase.phase === "confirm" ||
                      phase.phase === "not_installed") &&
                      renderCliInstructions()}

                    {phase.phase === "confirm" && (
                      <div className="space-y-3">
                        <p className="text-sm text-[var(--ui-text-secondary)]">
                          If you have finished signing in to {currentMeta.name}, confirm
                          below to enable it.
                        </p>
                        <Button
                          onClick={() => handleConfirm(selectedProvider)}
                          className="w-full"
                          style={{
                            background: "var(--accent-chat)",
                            color: "var(--ui-text-inverse)",
                          }}
                        >
                          <Check className="size-4 mr-2" />
                          I&apos;ve signed in
                        </Button>
                      </div>
                    )}

                    {phase.phase === "not_installed" && (
                      <div className="flex items-start gap-3 rounded-xl border border-status-warning/20 bg-status-warning-bg p-3">
                        <Warning className="size-5 text-status-warning shrink-0 mt-0.5" />
                        <div className="text-sm text-[var(--ui-text-secondary)]">
                          <p className="font-medium text-[var(--ui-text-primary)]">
                            {phase.binary ?? phase.label} is not installed
                          </p>
                          <p className="mt-1">
                            Install the CLI tool and make sure it is on your PATH.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* API key tab / non-CLI providers */}
                {showApiTab &&
                  (phase.phase === "idle" ||
                    phase.phase === "api_key" ||
                    phase.phase === "needs_key") &&
                  renderApiKeyForm()}

                {/* Polling / busy */}
                {(phase.phase === "busy" || phase.phase === "polling") && (
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <CircleNotch className="size-8 animate-spin text-[var(--accent-chat)]" />
                    <p className="text-sm text-[var(--ui-text-muted)] text-center">
                      {phase.phase === "polling"
                        ? `Waiting for ${phase.label} authentication…`
                        : "Starting connection…"}
                    </p>
                    <p className="text-xs text-[var(--ui-text-muted)] text-center max-w-[260px]">
                      Complete the sign-in in your terminal. This dialog will update automatically.
                    </p>
                  </div>
                )}

                {/* Error */}
                {phase.phase === "error" && (
                  <div className="bg-status-error-bg border border-status-error/20 rounded-xl p-3 flex items-start gap-3">
                    <Warning className="size-4 text-status-error mt-0.5 shrink-0" />
                    <p className="text-xs text-status-error/90 leading-normal">
                      {phase.message}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 pt-0 flex gap-3">
                <Button
                  variant="outline"
                  onClick={closeConnectDialog}
                  className="flex-1 rounded-xl border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)] h-11"
                >
                  Cancel
                </Button>

                {/* CLI tab primary action */}
                {showCliTab &&
                  (phase.phase === "idle" || phase.phase === "not_installed") &&
                  selectedProvider && (
                    <Button
                      onClick={() => handleConnect(selectedProvider)}
                      className="flex-1 rounded-xl h-11 font-semibold transition-all text-[var(--ui-text-inverse)]"
                      style={{
                        background: currentMeta.color,
                      }}
                    >
                      I&apos;ve installed & signed in
                    </Button>
                  )}

                {/* API key action */}
                {showApiTab &&
                  (phase.phase === "idle" ||
                    phase.phase === "api_key" ||
                    phase.phase === "needs_key") &&
                  selectedProvider && (
                    <Button
                      onClick={() => saveApiKey(selectedProvider)}
                      disabled={!apiKey || isSaving}
                      className="flex-1 rounded-xl h-11 font-semibold transition-all text-[var(--ui-text-inverse)]"
                      style={{
                        background: currentMeta.color,
                      }}
                    >
                      {isSaving ? (
                        <div className="flex items-center gap-2">
                          <CircleNotch className="size-4 animate-spin" />
                          Connecting…
                        </div>
                      ) : (
                        "Connect Account"
                      )}
                    </Button>
                  )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default ProviderGallery;
