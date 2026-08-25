"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  DesktopTower,
  WifiHigh,
  WifiSlash,
  Circle,
  Bell,
  BellSlash,
  ArrowSquareOut,
  DownloadSimple,
} from "@phosphor-icons/react";
import { GlassSurface } from "@/design/GlassSurface";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { env } from "@/lib/env";
import type { BeforeInstallPromptEvent } from "../types";

interface DashboardPageProps {
  installPrompt: BeforeInstallPromptEvent | null;
  onInstallClick: () => void;
}

interface CloudRuntimeDevice {
  id: string;
  name: string;
  runtimeType: string;
  hostname: string;
  platform: string;
  version: string;
  capabilities: string[];
  status: string;
  lastSeenAt: string | null;
}

interface RuntimeViewModel {
  id: string;
  name: string;
  host: string;
  status: string;
  lastHeartbeatAt?: number;
  agentClis: { name: string; icon: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  online: "var(--status-success)",
  busy: "var(--status-warning)",
  offline: "var(--ui-text-muted)",
};

const CLOUD_API_BASE_URL = "https://api.allternit.com";
const PUSH_WORKER_URL =
  env("VITE_REMOTE_CONTROL_PUSH_URL") ?? "https://push.remotecontrol.allternit.com";
const PLATFORM_HUB_URL = env("VITE_ALLTERNIT_API_URL") ?? "https://ai.allternit.com";

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

function deviceToViewModel(device: CloudRuntimeDevice): RuntimeViewModel {
  return {
    id: device.id,
    name: device.name || device.hostname || "Unnamed machine",
    host: `${device.platform} · ${device.hostname}`,
    status: device.status === "online" ? "online" : "offline",
    lastHeartbeatAt: device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : undefined,
    agentClis: (device.capabilities || []).map((cap) => ({ name: cap, icon: "" })),
  };
}

export function DashboardPage({ installPrompt, onInstallClick }: DashboardPageProps): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<RuntimeViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushByRuntime, setPushByRuntime] = useState<Record<string, boolean>>({});
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  const fetchRuntimes = useCallback(async () => {
    try {
      const token = await auth.getToken();
      const res = await fetch(`${CLOUD_API_BASE_URL}/api/v1/runtime-devices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load runtimes (${res.status})`);
      const data = (await res.json()) as { devices?: CloudRuntimeDevice[] } | CloudRuntimeDevice[];
      const devices = Array.isArray(data) ? data : data.devices ?? [];
      setRuntimes(devices.map(deviceToViewModel));
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load runtimes",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [auth, addToast]);

  useEffect(() => {
    void fetchRuntimes();
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  useEffect(() => {
    fetch(`${PUSH_WORKER_URL}/vapid-public-key`)
      .then((r) => (r.ok ? r.text() : null))
      .then((key) => setVapidKey(key))
      .catch(() => setVapidKey(null));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) =>
        Promise.all(
          runtimes.map(async (rt) => {
            const sub = await reg.pushManager.getSubscription();
            return { id: rt.id, subscribed: Boolean(sub) };
          })
        )
      )
      .then((results) => {
        const map: Record<string, boolean> = {};
        results.forEach((r) => {
          map[r.id] = r.subscribed;
        });
        setPushByRuntime(map);
      })
      .catch(() => {});
  }, [runtimes]);

  const togglePush = useCallback(
    async (rt: RuntimeViewModel) => {
      if (!vapidKey) {
        addToast({ title: "Push unavailable", description: "Push worker is not configured.", type: "error" });
        return;
      }
      if (!("serviceWorker" in navigator)) {
        addToast({
          title: "Push unavailable",
          description: "Your browser does not support push notifications.",
          type: "error",
        });
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        const enabled = Boolean(pushByRuntime[rt.id]);

        if (enabled && sub) {
          await sub.unsubscribe();
          await fetch(`${PUSH_WORKER_URL}/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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
    [addToast, pushByRuntime, vapidKey]
  );

  const onlineCount = runtimes.filter((r) => r.status === "online").length;

  if (!auth.isLoaded) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <div className="text-center">
          <div
            className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent mx-auto"
          />
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
        <GlassSurface className="max-w-md w-full p-8 text-center" intensity="base">
          <DesktopTower size={48} style={{ opacity: 0.6 }} className="mx-auto mb-4" color="var(--accent-primary)" />
          <h1 className="text-[22px] font-semibold mb-2">Sign in to Remote Control</h1>
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
        </GlassSurface>
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
              <h1 className="text-[24px] font-semibold tracking-tight m-0">Remote Control</h1>
              <p className="text-[13px] text-[var(--text-tertiary)] m-0 mt-0.5">
                Monitor and manage your agents across machines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              href={PLATFORM_HUB_URL ? `${PLATFORM_HUB_URL}/remote-control` : "/remote-control"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors"
              style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
            >
              <ArrowSquareOut size={16} weight="bold" />
              Platform Hub
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Online Machines
            </div>
            <div className="text-[32px] font-bold">{onlineCount}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">of {runtimes.length} paired</div>
          </GlassSurface>
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Permissions
            </div>
            <div className="text-[32px] font-bold">0</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Need your approval</div>
          </GlassSurface>
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Questions
            </div>
            <div className="text-[32px] font-bold">0</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Awaiting answers</div>
          </GlassSurface>
        </div>

        <h2 className="text-[16px] font-semibold mb-3">Machines</h2>
        {loading ? (
          <div className="text-[14px] text-[var(--text-secondary)] py-8 text-center">Loading runtimes…</div>
        ) : runtimes.length === 0 ? (
          <GlassSurface className="p-8 text-center" intensity="base">
            <DesktopTower size={48} style={{ opacity: 0.3 }} className="mx-auto mb-3" />
            <p className="text-[14px] text-[var(--text-secondary)] m-0">
              No runtimes paired yet. Pair a machine from the Allternit desktop app to get started.
            </p>
          </GlassSurface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runtimes.map((rt) => {
              const pushEnabled = Boolean(pushByRuntime[rt.id]);
              return (
                <GlassSurface
                  key={rt.id}
                  className="p-4 flex flex-col gap-3"
                  intensity="base"
                  hover="lift"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Circle
                        size={10}
                        weight="fill"
                        color={STATUS_COLORS[rt.status] ?? STATUS_COLORS.offline}
                      />
                      <span className="text-[15px] font-semibold">{rt.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {rt.status === "online" ? (
                        <WifiHigh size={18} color="var(--status-success)" />
                      ) : (
                        <WifiSlash size={18} color="var(--ui-text-muted)" />
                      )}
                      <button
                        type="button"
                        onClick={() => void togglePush(rt)}
                        className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                        title={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                      >
                        {pushEnabled ? (
                          <Bell size={18} color="var(--status-success)" />
                        ) : (
                          <BellSlash size={18} color="var(--ui-text-muted)" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-[13px] text-[var(--text-secondary)]">{rt.host}</div>
                  {rt.lastHeartbeatAt && (
                    <div className="text-[12px] text-[var(--text-tertiary)]">
                      Last heartbeat {new Date(rt.lastHeartbeatAt).toLocaleString()}
                    </div>
                  )}
                  {rt.agentClis.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {rt.agentClis.map((cli) => (
                        <span
                          key={cli.name}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                          style={{
                            background: "var(--surface-hover)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {cli.name}
                        </span>
                      ))}
                    </div>
                  )}
                </GlassSurface>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
