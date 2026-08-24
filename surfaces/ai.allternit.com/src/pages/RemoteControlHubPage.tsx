"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DesktopTower,
  WifiHigh,
  WifiSlash,
  Circle,
  ArrowSquareOut,
  Bell,
  BellSlash,
} from "@phosphor-icons/react";
import { GlassSurface } from "@/design/GlassSurface";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { openRemoteControlWindow } from "@/lib/open-remote-control-window";
import { RuntimeClient } from "@allternit/sdk/runtime";

interface RuntimeSummary {
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

export default function RemoteControlHubPage(): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<RuntimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPermissions, setPendingPermissions] = useState(0);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);

  const client = useMemo(
    () =>
      new RuntimeClient({
        baseUrl: "",
        getToken: auth.getToken,
      }),
    [auth]
  );

  const fetchRuntimes = useCallback(async () => {
    try {
      const { runtimes: data } = await client.listRuntimes();
      setRuntimes(data);
    } catch {
      addToast({ title: "Error", description: "Failed to load runtimes", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [client, addToast]);

  const fetchPending = useCallback(async () => {
    try {
      const [permissions, questions] = await Promise.all([
        fetch("/api/v1/permission", { headers: { "Content-Type": "application/json" } }).then(
          (r) => (r.ok ? r.json() : [])
        ),
        fetch("/api/v1/question", { headers: { "Content-Type": "application/json" } }).then(
          (r) => (r.ok ? r.json() : [])
        ),
      ]);
      setPendingPermissions(Array.isArray(permissions) ? permissions.length : 0);
      setPendingQuestions(Array.isArray(questions) ? questions.length : 0);
    } catch {
      // Non-fatal; keep stale counts.
    }
  }, []);

  useEffect(() => {
    void fetchRuntimes();
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  useEffect(() => {
    void fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(Boolean(sub)))
      .catch(() => setPushEnabled(false));
  }, []);

  const handleOpenDashboard = useCallback(() => {
    openRemoteControlWindow();
  }, []);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <DesktopTower size={28} weight="duotone" color="var(--accent-primary)" />
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight m-0">Remote Control</h1>
              <p className="text-[13px] text-[var(--text-tertiary)] m-0 mt-0.5">
                Carry your agents with you across machines.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors"
            style={{
              background: "var(--accent-primary)",
              color: "var(--text-inverse)",
            }}
          >
            <ArrowSquareOut size={16} weight="bold" />
            Open Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Connected Machines
            </div>
            <div className="text-[28px] font-bold">{runtimes.filter((r) => r.status === "online").length}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {runtimes.length} total
            </div>
          </GlassSurface>
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Permissions
            </div>
            <div className="text-[28px] font-bold">{pendingPermissions}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Need your approval</div>
          </GlassSurface>
          <GlassSurface className="p-4" intensity="base">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Pending Questions
            </div>
            <div className="text-[28px] font-bold">{pendingQuestions}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">Awaiting answers</div>
          </GlassSurface>
        </div>

        <h2 className="text-[16px] font-semibold mb-3">Your Runtimes</h2>
        {loading ? (
          <div className="text-[14px] text-[var(--text-secondary)] py-8 text-center">Loading runtimes…</div>
        ) : runtimes.length === 0 ? (
          <GlassSurface className="p-8 text-center" intensity="base">
            <DesktopTower size={48} style={{ opacity: 0.3 }} className="mx-auto mb-3" />
            <p className="text-[14px] text-[var(--text-secondary)] m-0">
              No runtimes paired yet. Pair a machine from the desktop app to get started.
            </p>
          </GlassSurface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runtimes.map((rt) => (
              <GlassSurface
                key={rt.id}
                className="p-4 flex flex-col gap-3"
                intensity="base"
                hover="lift"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Circle size={10} weight="fill" color={STATUS_COLORS[rt.status] ?? STATUS_COLORS.offline} />
                    <span className="text-[15px] font-semibold">{rt.name}</span>
                  </div>
                  {rt.status === "online" ? (
                    <WifiHigh size={18} color="var(--status-success)" />
                  ) : (
                    <WifiSlash size={18} color="var(--ui-text-muted)" />
                  )}
                </div>
                <div className="text-[13px] text-[var(--text-secondary)]">{rt.host}</div>
                {rt.lastHeartbeatAt && (
                  <div className="text-[12px] text-[var(--text-tertiary)]">
                    Last seen {new Date(rt.lastHeartbeatAt).toLocaleString()}
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
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center gap-3 text-[13px] text-[var(--text-secondary)]">
          {pushEnabled ? <Bell size={18} color="var(--status-success)" /> : <BellSlash size={18} />}
          <span>{pushEnabled ? "Push notifications enabled" : "Push notifications disabled"}</span>
        </div>
      </div>
    </div>
  );
}
