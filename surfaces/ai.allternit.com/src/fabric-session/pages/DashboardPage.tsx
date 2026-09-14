"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellSlash,
  CaretLeft,
  DesktopTower,
  DownloadSimple,
  Monitor,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { FabricDesktopDrive, useVisualViewportRect } from "@/components/dispatch/FabricDesktopDrive";
import {
  hasDesktopConnection,
  hasNodeDaemon,
  useRuntimes,
  type RuntimeViewModel,
} from "@/components/dispatch/useRuntimes";
import { cloudApiUrl } from "@/lib/cloud-api";
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
import { FabricSessionRailControls } from "@/components/dispatch/FabricSessionRailControls";
import type { FabricDriveKind } from "@/lib/fabric-session-kind";
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
import { useToast } from "@/hooks/use-toast";
import { MachinesPanel } from "@/components/dispatch/MachinesPanel";
<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/pages/DashboardPage.tsx
import { RemoteSessionPanel } from "@/components/dispatch/RemoteSessionPanel";
import { FabricDesktopDrive } from "@/components/dispatch/FabricDesktopDrive";
import { RecordingsPanel } from "../recordings/RecordingsPanel";
========
import { FabricSessionPanel } from "@/components/dispatch/FabricSessionPanel";
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/pages/DashboardPage.tsx
import { useRuntimes, type RuntimeViewModel } from "@/components/dispatch/useRuntimes";
import { useRuntimeSelection } from "@/components/dispatch/useRuntimeSelection";
import { useFabricPendingCounts } from "@/components/dispatch/useFabricPendingCounts";
import {
  useFabricSessionThemeStore,
  type Theme,
} from "@/fabric-session/theme/FabricSessionThemeStore";
import type { BeforeInstallPromptEvent } from "../types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBots } from "@/lib/bots/bot-profile";
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

}

<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/pages/DashboardPage.tsx
const PUSH_WORKER_URL = env("VITE_REMOTE_CONTROL_PUSH_URL") ?? "https://push.fabrictransport.allternit.com";
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
========
const PUSH_WORKER_URL =
  env("VITE_FABRIC_SESSION_PUSH_URL") || env("VITE_REMOTE_CONTROL_PUSH_URL") || "https://push.fabric-session.allternit.com";
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/pages/DashboardPage.tsx
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
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Failed to load runtimes (${res.status})`);
      }
      const data = (await res.json()) as { runtimes?: CloudRuntimeDevice[] } | CloudRuntimeDevice[];
      const devices = Array.isArray(data) ? data : data.runtimes ?? [];
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

  const agents = useAgentStore((s) => s.agents);
  const roster = React.useMemo(() => getBots(agents), [agents]);

  React.useEffect(() => {
    if (!auth.isSignedIn) return;
    void useAgentStore.getState().fetchAgents().catch(() => {
      // Bots empty-state; machines still work.
    });
  }, [auth.isSignedIn]);

  const isLandscape = useMediaQuery("(orientation: landscape) and (pointer: coarse)");
  const vv = useVisualViewportRect();
  const { runtimes, loading } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const [sessionOpen, setSessionOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(new URLSearchParams(window.location.search).get("runtime"));
  });
  const [desktopOpen, setDesktopOpen] = React.useState(false);
  const [startingDesktop, setStartingDesktop] = React.useState(false);

  // Daemon-only node: the Monitor affordance degrades to "Start desktop",
  // which asks the daemon (node.launch) to bring Allternit Desktop up. The
  // live viewer lights up once the app connects and claims its capabilities.
  const startDesktop = useCallback(async () => {
    if (!selected) return;
    const token = await auth.getToken().catch(() => null);
    if (!token) return;
    setStartingDesktop(true);
    try {
      await fetch(
        cloudApiUrl(`/api/v1/runtime-devices/${encodeURIComponent(selected.id)}/proxy`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method: "POST",
            path: "/api/v1/node/launch",
            body: JSON.stringify({ action: "start" }),
            bodyEncoding: "utf8",
          }),
        },
      ).catch(() => {});
      setDesktopOpen(true);
    } finally {
      setStartingDesktop(false);
    }
  }, [selected, auth]);
  const [driveKind, setDriveKind] = React.useState<FabricDriveKind>("chat");
  const [railCollapsed, setRailCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(max-width: 768px)").matches) return true;
    try {
      return window.localStorage.getItem("fabric-session:rail-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const toggleRail = useCallback(() => {
    setRailCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined" && !window.matchMedia("(max-width: 768px)").matches) {
        try {
          window.localStorage.setItem("fabric-session:rail-collapsed", String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const openSession = useCallback(
    (id: string) => {
      setDesktopOpen(false);
      setDriveKind("chat");
      setRailCollapsed(typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches);
      setSelectedId(id);
      setSessionOpen(true);
    },
    [setSelectedId],
  );
  const closeSession = useCallback(() => {
    setDesktopOpen(false);
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
export function DashboardPage({ installPrompt, onInstallClick }: DashboardPageProps): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const theme = useFabricSessionThemeStore((state) => state.theme);
  const setTheme = useFabricSessionThemeStore((state) => state.setTheme);

  const { runtimes, loading } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const [machineTab, setMachineTab] = useState<"desktop" | "sessions">("sessions");
  const onlineCount = runtimes.filter((r) => r.status === "online").length;
  const { permissions: pendingPermissions, questions: pendingQuestions } = useFabricPendingCounts(runtimes, auth.getToken);

  const vapidKey = useVapidKey();
  const { pushByRuntime, setPushByRuntime } = usePushByRuntime(runtimes, auth.getToken);
      .catch(() => {});
  }, [runtimes]);

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
        className="min-h-[100dvh] w-full flex items-center justify-center px-5 overflow-y-auto bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]"
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
      {sessionOpen && selected ? (
        hasNodeDaemon(selected) && !hasDesktopConnection(selected) ? (
          <FabricHeaderControl
            onClick={() => void startDesktop()}
            title={startingDesktop ? "Starting desktop…" : "Start desktop on this node"}
            active={false}
          >
            <DesktopTower size={16} weight="bold" />
          </FabricHeaderControl>
        ) : (
          <FabricHeaderControl onClick={() => setDesktopOpen(true)} title="Live desktop" active={desktopOpen}>
            <Monitor size={16} weight="bold" />
          </FabricHeaderControl>
        )
      ) : null}
      <FabricHeaderControl onClick={cycleTheme} title="Toggle theme">
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </FabricHeaderControl>
      {installPrompt && (
        <FabricHeaderControl onClick={onInstallClick} title="Install">
          <DownloadSimple size={16} weight="bold" />
        </FabricHeaderControl>
      )}
      <FabricHeaderControl
        href={env("VITE_ALLTERNIT_WEB_URL") || "https://ai.allternit.com"}
        title="Open Allternit"
        className="hidden sm:inline-flex"
      >
        Shell
      </FabricHeaderControl>
    </FabricStatusCluster>
  );

  if (sessionOpen && selected) {
    if (desktopOpen) {
      return (
        <div
          className="z-50 bg-[#0b0b0a] text-white overflow-hidden"
          style={{
            position: "fixed",
            top: vv.height ? vv.top : 0,
            left: vv.height ? vv.left : 0,
            width: vv.height ? vv.width : "100%",
            height: vv.height ? vv.height : "100%",
          }}
        >
          <button
            type="button"
            onClick={() => setDesktopOpen(false)}
            className="absolute z-30 left-2 inline-flex items-center gap-1 rounded-full border-none bg-black/55 px-2 py-1.5 text-[13px] font-semibold text-white cursor-pointer"
            style={{ top: "max(8px, env(safe-area-inset-top))" }}
            title="Back to sessions"
          >
            <CaretLeft size={16} weight="bold" />
            {!isLandscape ? "Sessions" : null}
          </button>
          <FabricDesktopDrive runtimeId={selected.id} getToken={auth.getToken} hostName={selected.name} />
        </div>
      );
    }
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]">
        <FabricAppHeader
          title={selected.name}
          onBack={closeSession}
          leading={(
            <FabricSessionRailControls
              railCollapsed={railCollapsed}
              driveKind={driveKind}
              onToggleRail={toggleRail}
              onDriveKindChange={setDriveKind}
            />
          )}
        >
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
            driveKind={driveKind}
            onDriveKindChange={setDriveKind}
            railCollapsed={railCollapsed}
            onToggleRail={toggleRail}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]">
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
              <p className="m-0 mt-2 text-[12px] text-[var(--shell-item-muted)] truncate">{signedInAs}</p>
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
        className="min-h-screen w-full flex items-center justify-center px-5"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <div className="max-w-md w-full p-8 text-center rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <DesktopTower size={48} style={{ opacity: 0.6 }} className="mx-auto mb-4" color="var(--accent-primary)" />
<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/pages/DashboardPage.tsx
          <h1 className="text-[22px] font-semibold mb-2">Sign in to Fabric Transport</h1>
========
          <h1 className="text-[22px] font-semibold mb-2">Sign in to Fabric Session</h1>
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/pages/DashboardPage.tsx
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">
            Monitor and manage this desktop and other paired runtimes from any device.
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
    window.location.replace('/sign-in');
    return null;
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
<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/pages/DashboardPage.tsx
              <h1 className="text-[24px] font-semibold tracking-tight m-0">Fabric Transport</h1>
========
              <h1 className="text-[24px] font-semibold tracking-tight m-0">Fabric Session</h1>
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/pages/DashboardPage.tsx
              <p className="text-[13px] text-[var(--text-tertiary)] m-0 mt-0.5">
                Monitor and manage this desktop and other paired runtimes.
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
              href={PLATFORM_HUB_URL || "https://ai.allternit.com"}
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
        <MachinesPanel
          runtimes={runtimes}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          action={pushAction}
        />

        {selected && (
<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/pages/DashboardPage.tsx
          <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden h-[600px] flex flex-col">
            <div className="shrink-0 flex gap-1 p-2 border-b border-solid border-[var(--border-subtle)]">
              {(['sessions', 'desktop'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMachineTab(tab)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold border-none cursor-pointer"
                  style={{
                    background: machineTab === tab ? 'var(--bg-primary)' : 'transparent',
                    color: machineTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {tab === 'desktop' ? 'Desktop' : 'Sessions'}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              {machineTab === 'desktop' ? (
                <div className="h-full p-3">
                  <FabricDesktopDrive runtimeId={selected.id} getToken={auth.getToken} hostName={selected.name} />
                </div>
              ) : (
                <RemoteSessionPanel runtimeId={selected.id} getToken={auth.getToken} />
              )}
            </div>
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
========
          <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden h-[600px]">
            <FabricSessionPanel runtimeId={selected.id} getToken={auth.getToken} />
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/pages/DashboardPage.tsx
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-[16px] font-semibold mb-3">Recordings</h2>
          <RecordingsPanel />
        </section>
      </div>
    </div>
  );
}
