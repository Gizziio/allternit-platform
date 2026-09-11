"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellSlash,
  DesktopTower,
  DownloadSimple,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import {
  FabricAppHeader,
  FabricHeaderControl,
  FabricStatusCluster,
  FabricViewTitle,
} from "@/components/dispatch/FabricAppChrome";
import { PlatformSignIn, usePlatformAuth, usePlatformUser } from "@/lib/platform-auth-client";
import { env } from "@/lib/env";
import { fabricSessionStayUrl, isFabricSessionPwaHost } from "@/lib/fabric-session-pwa";
import { useToast } from "@/hooks/use-toast";
import { MachinesPanel } from "@/components/dispatch/MachinesPanel";
import { FabricOperatorKeys } from "@/components/dispatch/FabricOperatorKeys";
import { FabricSessionPanel } from "@/components/dispatch/FabricSessionPanel";
import { useRuntimes, type RuntimeViewModel } from "@/components/dispatch/useRuntimes";
import { useRuntimeSelection } from "@/components/dispatch/useRuntimeSelection";
import { useFabricPendingCounts } from "@/components/dispatch/useFabricPendingCounts";
import {
  useFabricSessionThemeStore,
  type Theme,
} from "@/fabric-session/theme/FabricSessionThemeStore";
import type { BeforeInstallPromptEvent } from "../types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useUnifiedRoster } from "@/lib/bots/use-unified-roster";
import { BotsRosterSection } from "./BotsRosterSection";

interface DashboardPageProps {
  installPrompt: BeforeInstallPromptEvent | null;
  onInstallClick: () => void;
  onSelectBot?: (botId: string) => void;
  pendingByBot?: Record<string, boolean>;
  watching?: boolean;
  onToggleWatch?: () => void;
}

const PUSH_WORKER_URL =
  env("VITE_FABRIC_SESSION_PUSH_URL") || env("VITE_REMOTE_CONTROL_PUSH_URL") || "https://push.fabrictransport.allternit.com";
const PLATFORM_HUB_URL = env("VITE_ALLTERNIT_PLATFORM_URL") ?? "https://platform.allternit.com";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function useVapidKey() {
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${PUSH_WORKER_URL}/vapid-public-key`)
      .then((r) => (r.ok ? r.text() : null))
      .then((key) => setVapidKey(key))
      .catch(() => setVapidKey(null));
  }, []);
  return vapidKey;
}

function usePushByRuntime(
  runtimes: RuntimeViewModel[],
  getToken: () => Promise<string | null>
) {
  const [pushByRuntime, setPushByRuntime] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || runtimes.length === 0) {
      return;
    }
    let cancelled = false;

    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const map: Record<string, boolean> = {};
          runtimes.forEach((r) => {
            map[r.id] = false;
          });
          if (!cancelled) setPushByRuntime(map);
          return;
        }

        const token = await getToken().catch(() => null);
        if (!token) return;

        const res = await fetch(
          `${PUSH_WORKER_URL}/subscriptions?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to fetch push subscriptions");

        const data = (await res.json()) as { runtimeIds?: string[] };
        const ids = new Set(data.runtimeIds ?? []);
        const map: Record<string, boolean> = {};
        runtimes.forEach((r) => {
          map[r.id] = ids.has(r.id);
        });
        if (!cancelled) setPushByRuntime(map);
      })
      .catch(() => {
        const map: Record<string, boolean> = {};
        runtimes.forEach((r) => {
          map[r.id] = false;
        });
        if (!cancelled) setPushByRuntime(map);
      });

    return () => {
      cancelled = true;
    };
  }, [runtimes, getToken]);

  return { pushByRuntime, setPushByRuntime };
}

export function DashboardPage({
  installPrompt,
  onInstallClick,
  onSelectBot,
  pendingByBot,
  watching,
  onToggleWatch,
}: DashboardPageProps): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const { user } = usePlatformUser();
  const theme = useFabricSessionThemeStore((state) => state.theme);
  const setTheme = useFabricSessionThemeStore((state) => state.setTheme);
  const [loadTimedOut, setLoadTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (auth.isLoaded) {
      setLoadTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [auth.isLoaded]);

  const roster = useUnifiedRoster();

  React.useEffect(() => {
    if (!auth.isSignedIn) return;
    void useAgentStore.getState().fetchAgents().catch(() => {
      // Bots empty-state; machines still work.
    });
  }, [auth.isSignedIn]);

  const { runtimes, loading } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const [sessionOpen, setSessionOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(new URLSearchParams(window.location.search).get("runtime"));
  });

  const openSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSessionOpen(true);
    },
    [setSelectedId],
  );
  const closeSession = useCallback(() => {
    setSessionOpen(false);
    setSelectedId(null);
  }, [setSelectedId]);
  const onlineCount = runtimes.filter((r) => r.status === "online").length;
  const { permissions: pendingPermissions, questions: pendingQuestions, byRuntime } = useFabricPendingCounts(runtimes, auth.getToken);
  const attentionRuntimes = runtimes.filter((rt) => {
    const counts = byRuntime[rt.id];
    return Boolean(counts && counts.permissions + counts.questions > 0);
  });
  const signedInAs =
    user?.userEmail ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;

  const vapidKey = useVapidKey();
  const { pushByRuntime, setPushByRuntime } = usePushByRuntime(runtimes, auth.getToken);

  const togglePush = useCallback(
    async (rt: RuntimeViewModel) => {
      if (!vapidKey) {
        addToast({ title: "Push unavailable", description: "Push worker is not configured.", type: "error" });
        return;
      }
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        addToast({
          title: "Push unavailable",
          description: "Your browser does not support push notifications.",
          type: "error",
        });
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        addToast({
          title: "Notifications disabled",
          description: "Please allow notification access in your browser settings.",
          type: "error",
        });
        return;
      }

      const token = await auth.getToken();
      if (!token) {
        addToast({ title: "Sign in required", description: "Please sign in to manage push notifications.", type: "error" });
        return;
      }
      const authHeaders = { Authorization: `Bearer ${token}` };

      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        const enabled = Boolean(pushByRuntime[rt.id]);

        if (enabled && sub) {
          // Only remove this runtime's record on the worker. Keep the browser
          // subscription alive so other runtimes can still notify this device.
          await fetch(`${PUSH_WORKER_URL}/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ runtimeId: rt.id, endpoint: sub.endpoint }),
          });
          setPushByRuntime((prev) => ({ ...prev, [rt.id]: false }));
          addToast({ title: "Notifications disabled", type: "info" });
          return;
        }

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
        });
        await fetch(`${PUSH_WORKER_URL}/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            runtimeId: rt.id,
            endpoint: sub.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!)))
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=/g, ""),
              auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!)))
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=/g, ""),
            },
            label: rt.name,
          }),
        });
        setPushByRuntime((prev) => ({ ...prev, [rt.id]: true }));
        addToast({ title: "Notifications enabled", description: `You will be alerted for ${rt.name}.`, type: "success" });
      } catch (err) {
        addToast({
          title: "Push error",
          description: err instanceof Error ? err.message : "Could not change notification settings.",
          type: "error",
        });
      }
    },
    [addToast, auth, pushByRuntime, setPushByRuntime, vapidKey]
  );

  const pushAction = useCallback(
    (rt: RuntimeViewModel) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void togglePush(rt);
        }}
        className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
        title={pushByRuntime[rt.id] ? "Disable push notifications" : "Enable push notifications"}
      >
        {pushByRuntime[rt.id] ? (
          <Bell size={18} color="var(--status-success)" />
        ) : (
          <BellSlash size={18} color="var(--ui-text-muted)" />
        )}
      </button>
    ),
    [pushByRuntime, togglePush]
  );

  const cycleTheme = () => {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  if (!auth.isLoaded && !loadTimedOut) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]"
      >
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent mx-auto" />
          <div className="text-sm font-medium">Loading account…</div>
        </div>
      </div>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-5 bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]"
      >
        <div className="max-w-md w-full p-8 text-center rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)]">
          <DesktopTower size={48} style={{ opacity: 0.6 }} className="mx-auto mb-4" color="var(--accent-primary)" />
          <h1 className="text-[22px] font-semibold mb-2">Sign in to Fabric Transport</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">
            Sign in on this page. After Allternit auth you stay here on the
            dashboard — including if you opened this from a QR code.
          </p>
          <div className="text-left">
            <PlatformSignIn
              routing={isFabricSessionPwaHost() ? "virtual" : "path"}
              forceRedirectUrl={fabricSessionStayUrl()}
              signUpForceRedirectUrl={fabricSessionStayUrl()}
            />
          </div>
        </div>
      </div>
    );
  }

  const headerActions = (
    <FabricStatusCluster
      onlineCount={onlineCount}
      runtimeCount={runtimes.length}
      pendingPermissions={pendingPermissions}
      pendingQuestions={pendingQuestions}
    >
      <FabricHeaderControl onClick={cycleTheme} title="Toggle theme">
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </FabricHeaderControl>
      {installPrompt && (
        <FabricHeaderControl onClick={onInstallClick} title="Install">
          <DownloadSimple size={16} weight="bold" />
        </FabricHeaderControl>
      )}
      <FabricHeaderControl
        href={`${PLATFORM_HUB_URL}/shell`}
        title="Open Allternit Shell"
        className="hidden sm:inline-flex"
      >
        Shell
      </FabricHeaderControl>
    </FabricStatusCluster>
  );

  if (sessionOpen && selected) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]">
        <FabricAppHeader title={selected.name} onBack={closeSession}>
          {headerActions}
        </FabricAppHeader>
        <main className="flex-1 min-h-0">
          <FabricSessionPanel
            runtimeId={selected.id}
            runtime={selected}
            getToken={auth.getToken}
            watching={watching}
            onToggleWatch={onToggleWatch}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]">
      <FabricAppHeader>{headerActions}</FabricAppHeader>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-4 pt-6 pb-10 sm:px-8 sm:pt-10 sm:pb-12">
          <div className="mb-6 sm:mb-8">
            <FabricViewTitle
              title="Fabric Transport"
              subtitle="Open a machine to see its sessions. Bots and live desktop are in that view."
            />
            {signedInAs ? (
              <p className="m-0 mt-2 text-[12px] text-[var(--shell-item-muted)] truncate">
                {signedInAs}
              </p>
            ) : null}
          </div>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <button
              type="button"
              onClick={() => {
                const firstOnline = runtimes.find((rt) => rt.status === "online") ?? runtimes[0];
                if (firstOnline) openSession(firstOnline.id);
              }}
              className="text-left rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] p-4 cursor-pointer"
            >
              <div className="text-label text-[var(--shell-item-muted)]">Online machines</div>
              <div className="text-[28px] font-medium tracking-tight mt-1">{onlineCount}</div>
              <div className="text-caption text-[var(--shell-item-muted)]">of {runtimes.length} paired</div>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = attentionRuntimes.find((rt) => (byRuntime[rt.id]?.permissions ?? 0) > 0) ?? attentionRuntimes[0];
                if (target) openSession(target.id);
              }}
              className="text-left rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] p-4 cursor-pointer"
            >
              <div className="text-label text-[var(--shell-item-muted)]">Pending permissions</div>
              <div className="text-[28px] font-medium tracking-tight mt-1">{pendingPermissions}</div>
              <div className="text-caption text-[var(--shell-item-muted)]">Need your approval</div>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = attentionRuntimes.find((rt) => (byRuntime[rt.id]?.questions ?? 0) > 0) ?? attentionRuntimes[0];
                if (target) openSession(target.id);
              }}
              className="text-left rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] p-4 cursor-pointer"
            >
              <div className="text-label text-[var(--shell-item-muted)]">Pending questions</div>
              <div className="text-[28px] font-medium tracking-tight mt-1">{pendingQuestions}</div>
              <div className="text-caption text-[var(--shell-item-muted)]">Awaiting answers</div>
            </button>
          </div>

          {attentionRuntimes.length > 0 && (
            <section className="mb-8">
              <h2 className="text-[15px] font-semibold m-0 mb-3">Needs you</h2>
              <div className="flex flex-col gap-2">
                {attentionRuntimes.map((rt) => {
                  const counts = byRuntime[rt.id];
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => openSession(rt.id)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-4 py-3 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold truncate">{rt.name}</div>
                        <div className="text-[12px] text-[var(--shell-item-muted)] truncate">{rt.host}</div>
                      </div>
                      <div className="text-[12px] font-semibold text-[var(--status-warning)] shrink-0">
                        {(counts?.permissions ?? 0) > 0 ? `${counts?.permissions} perms` : null}
                        {(counts?.permissions ?? 0) > 0 && (counts?.questions ?? 0) > 0 ? " · " : null}
                        {(counts?.questions ?? 0) > 0 ? `${counts?.questions} questions` : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <h2 className="text-[15px] font-semibold m-0 mb-3">Machines</h2>
          <MachinesPanel
            runtimes={runtimes}
            loading={loading}
            selectedId={selectedId}
            onSelect={(id) => {
              if (id) openSession(id);
            }}
            action={pushAction}
            attention={(rt) => byRuntime[rt.id]}
            emptyMessage="Open Allternit Desktop or a hosted node while signed in to this account."
          />

          <BotsRosterSection
            bots={roster}
            pendingByBot={pendingByBot}
            onSelectBot={(id) => onSelectBot?.(id)}
            className="mt-8"
          />

          <FabricOperatorKeys getToken={auth.getToken} />
        </div>
      </main>
    </div>
  );
}
