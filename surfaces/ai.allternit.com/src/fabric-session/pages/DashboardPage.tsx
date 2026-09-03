"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowSquareOut,
  Bell,
  BellSlash,
  DesktopTower,
  DownloadSimple,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { env } from "@/lib/env";
import { useToast } from "@/hooks/use-toast";
import { MachinesPanel } from "@/components/dispatch/MachinesPanel";
import { FabricSessionPanel } from "@/components/dispatch/FabricSessionPanel";
import { useRuntimes, type RuntimeViewModel } from "@/components/dispatch/useRuntimes";
import { useRuntimeSelection } from "@/components/dispatch/useRuntimeSelection";
import { useFabricPendingCounts } from "@/components/dispatch/useFabricPendingCounts";
import {
  useFabricSessionThemeStore,
  type Theme,
} from "@/fabric-session/theme/FabricSessionThemeStore";
import type { BeforeInstallPromptEvent } from "../types";

interface DashboardPageProps {
  installPrompt: BeforeInstallPromptEvent | null;
  onInstallClick: () => void;
}

const PUSH_WORKER_URL =
  env("VITE_FABRIC_SESSION_PUSH_URL") || env("VITE_REMOTE_CONTROL_PUSH_URL") || "https://push.fabric-session.allternit.com";
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

export function DashboardPage({ installPrompt, onInstallClick }: DashboardPageProps): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const theme = useFabricSessionThemeStore((state) => state.theme);
  const setTheme = useFabricSessionThemeStore((state) => state.setTheme);

  const { runtimes, loading } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const onlineCount = runtimes.filter((r) => r.status === "online").length;
  const { permissions: pendingPermissions, questions: pendingQuestions } = useFabricPendingCounts(runtimes, auth.getToken);

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

  if (!auth.isLoaded) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
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
        className="min-h-screen w-full flex items-center justify-center px-5"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <div className="max-w-md w-full p-8 text-center rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <DesktopTower size={48} style={{ opacity: 0.6 }} className="mx-auto mb-4" color="var(--accent-primary)" />
          <h1 className="text-[22px] font-semibold mb-2">Sign in to Fabric Session</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">
            Monitor and manage your agents across machines from any device.
          </p>
          <a
            href={`${PLATFORM_HUB_URL}/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-none text-[14px] font-semibold cursor-pointer transition-colors w-full"
            style={{ background: "var(--accent-primary)", color: "var(--accent-on-primary)" }}
          >
            Sign in with Allternit
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="max-w-6xl mx-auto px-5 py-8 md:px-8 md:py-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <DesktopTower size={32} weight="duotone" color="var(--accent-primary)" />
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight m-0">Fabric Session</h1>
              <p className="text-[13px] text-[var(--text-tertiary)] m-0 mt-0.5">
                Monitor and manage your agents across machines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors"
              style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
              title="Toggle theme"
            >
              {theme === "dark" ? <Moon size={16} /> : theme === "light" ? <Sun size={16} /> : <Sun size={16} />}
              <span className="capitalize">{theme}</span>
            </button>
            {installPrompt && (
              <button
                type="button"
                onClick={onInstallClick}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors"
                style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
              >
                <DownloadSimple size={16} weight="bold" />
                Install
              </button>
            )}
            <a
              href={`${PLATFORM_HUB_URL}/shell`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors"
              style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
            >
              <ArrowSquareOut size={16} weight="bold" />
              Open in Allternit
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div
            className="rounded-2xl border border-solid border-[var(--border-default)] p-4"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Online Machines
            </div>
            <div className="text-[32px] font-bold">{onlineCount}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">of {runtimes.length} paired</div>
          </div>
          <div
            className="rounded-2xl border border-solid border-[var(--border-default)] p-4"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Permissions
            </div>
            <div className="text-[32px] font-bold">{pendingPermissions}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Need your approval</div>
          </div>
          <div
            className="rounded-2xl border border-solid border-[var(--border-default)] p-4"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Questions
            </div>
            <div className="text-[32px] font-bold">{pendingQuestions}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Awaiting answers</div>
          </div>
        </div>

        <h2 className="text-[16px] font-semibold mb-3">Machines</h2>
        <MachinesPanel
          runtimes={runtimes}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          action={pushAction}
        />

        {selected && (
          <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden h-[600px]">
            <FabricSessionPanel runtimeId={selected.id} getToken={auth.getToken} />
          </div>
        )}
      </div>
    </div>
  );
}
