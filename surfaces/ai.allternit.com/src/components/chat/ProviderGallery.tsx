import React, { useEffect, useRef, useState } from "react";
import { useModelDiscovery } from "@/integration/api-client";
import { getProviderMeta } from "@/lib/providers/provider-registry";
import {
  Check,
  Shield,
  Key,
  Warning,
  CaretRight,
  CircleNotch,
  Plus as PlusIcon,
  ArrowSquareOut,
  Download,
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
  authenticated: boolean;
  onClick: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  name,
  icon,
  color,
  authenticated,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all group relative overflow-hidden",
        authenticated
          ? "bg-[var(--surface-panel)] border-[var(--ui-border-default)]"
          : "bg-transparent border-[var(--ui-border-muted)] hover:bg-[var(--surface-hover)]"
      )}
      style={{
        borderColor: authenticated ? `${color}40` : undefined,
      }}
    >
      {authenticated && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
          }}
        />
      )}

      <div
        className="size-16 rounded-2xl flex items-center justify-center relative z-10"
        style={{
          background: `${color}15`,
          border: `1px solid ${color}30`,
        }}
      >
        <img
          src={`/assets/runtime-logos/${icon}`}
          alt={name}
          className="size-10 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              parent.innerHTML = `<div class="text-2xl font-bold" style="color: ${color}">${name[0]}</div>`;
            }
          }}
        />

        {authenticated && (
          <div className="absolute -top-2 -right-2 size-6 rounded-full bg-status-success flex items-center justify-center border-2 border-[var(--surface-canvas)]">
            <Check className="size-3.5 text-[var(--ui-text-inverse)]" />
          </div>
        )}
      </div>

      <div className="text-center relative z-10">
        <h3 className="font-semibold text-[var(--ui-text-primary)] text-sm">
          {name}
        </h3>
        <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
          {authenticated ? "Connected" : "Not connected"}
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
}

export const ProviderGallery: React.FC<ProviderGalleryProps> = ({
  isOpen = false,
  onClose,
}) => {
  const { providers, fetchProviders, providersLoading } = useModelDiscovery();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState<ConnectPhase>({ phase: "idle" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const currentMeta = selectedProvider
    ? getProviderMeta(selectedProvider)
    : null;

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen, fetchProviders]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setApiKey("");
      setError(null);
      setPhase({ phase: "idle" });
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
    setSelectedProvider(id);
    setApiKey("");
    setError(null);
    setPhase({ phase: "idle" });
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className="sm:max-w-3xl border-[var(--shell-dialog-border)] bg-[var(--shell-dialog-bg)] text-[var(--ui-text-primary)] p-0 overflow-hidden"
        style={{
          background: "var(--shell-dialog-bg)",
          borderColor: "var(--shell-dialog-border)",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--ui-border-default)] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--shell-dialog-title)] mb-1">
              Connect Providers
            </h2>
            <p className="text-[var(--shell-dialog-text)] text-sm">
              Select an AI provider to enable their models. API-key providers and
              pre-authenticated CLI tools are both supported.
            </p>
          </div>
        </div>

        <div className="max-h-[min(72vh,560px)] overflow-y-auto px-6 py-6">
          {providersLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <CircleNotch className="size-8 text-[var(--ui-text-muted)] animate-spin" />
              <p className="text-[var(--ui-text-muted)] text-sm">
                Loading providers…
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {providers.map((p) => {
                const meta = getProviderMeta(p.provider_id);
                return (
                  <ProviderCard
                    key={p.provider_id}
                    providerId={p.provider_id}
                    name={meta.name}
                    icon={meta.icon}
                    color={meta.color}
                    authenticated={p.authenticated}
                    onClick={() => handleSelectProvider(p.provider_id)}
                  />
                );
              })}

              <button
                type="button"
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-[var(--ui-border-default)] bg-[var(--surface-hover)]/30 hover:bg-[var(--surface-hover)] transition-all group"
              >
                <div className="size-16 rounded-2xl flex items-center justify-center bg-[var(--surface-panel)] border border-[var(--ui-border-default)] group-hover:border-[var(--ui-border-strong)]">
                  <PlusIcon className="size-6 text-[var(--ui-text-muted)]" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-[var(--ui-text-muted)] text-sm italic">
                    Coming Soon
                  </h3>
                </div>
              </button>
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
          className="sm:max-w-md border-[var(--shell-dialog-border)] bg-[var(--shell-dialog-bg)] text-[var(--ui-text-primary)] p-0 overflow-hidden rounded-2xl"
          style={{
            background: "var(--shell-dialog-bg)",
            borderColor: "var(--shell-dialog-border)",
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
                    <img
                      src={`/assets/runtime-logos/${currentMeta.icon}`}
                      alt=""
                      className="size-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div>
                    <DialogTitle className="text-lg text-[var(--shell-dialog-title)]">
                      Connect {currentMeta.name}
                    </DialogTitle>
                    <DialogDescription className="text-[var(--shell-dialog-text)]">
                      {phase.phase === "api_key" || phase.phase === "needs_key"
                        ? `Configure your ${currentMeta.name} credentials`
                        : `Link your ${currentMeta.name} account or CLI tool`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4">
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
                      Complete the sign-in in your browser or terminal. This dialog will update automatically.
                    </p>
                  </div>
                )}

                {/* Confirm step */}
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

                {/* Not installed */}
                {phase.phase === "not_installed" && (
                  <div className="space-y-3">
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
                    {phase.page && (
                      <a
                        href={phase.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[var(--ui-border-default)] text-sm text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <Download className="size-4" />
                        Download {currentMeta.name}
                        <ArrowSquareOut className="size-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* API key input */}
                {(phase.phase === "api_key" || phase.phase === "needs_key") && (
                  <div className="space-y-3">
                    {phase.phase === "needs_key" && phase.page && (
                      <p className="text-sm text-[var(--ui-text-secondary)]">
                        Get an API key from{" "}
                        <a
                          href={phase.page}
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
                {(phase.phase === "api_key" || phase.phase === "needs_key") && (
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
                {phase.phase === "idle" && (
                  <Button
                    onClick={() => handleConnect(selectedProvider)}
                    className="flex-1 rounded-xl h-11 font-semibold transition-all text-[var(--ui-text-inverse)]"
                    style={{
                      background: currentMeta.color,
                    }}
                  >
                    Connect
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
