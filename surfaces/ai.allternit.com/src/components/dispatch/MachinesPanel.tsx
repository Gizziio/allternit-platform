"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DesktopTower, Circle, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { MachineCard, type MachineCardRuntime } from "./MachineCard";
import { cn } from "@/lib/utils";

export { type MachineCardRuntime } from "./MachineCard";

const STATUS_COLORS: Record<string, string> = {
  online: "var(--status-success)",
  busy: "var(--status-warning)",
  offline: "var(--ui-text-muted)",
};

interface CloudRuntimeDevice {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  version: string;
  capabilities: string[];
  status: string;
  lastSeenAt: string | null;
}

interface MachinesPanelProps {
  selectedRuntimeId?: string | null;
  onSelectRuntime?: (id: string | null) => void;
  pushByRuntime?: Record<string, boolean>;
  onTogglePush?: (rt: MachineCardRuntime) => void;
  onHandoff?: (rt: MachineCardRuntime) => void;
  onOpenSession?: (rt: MachineCardRuntime) => void;
  showSelection?: boolean;
  showHandoff?: boolean;
  showOpenSession?: boolean;
  layout?: "grid" | "list";
  className?: string;
}

const CLOUD_API_BASE_URL = "https://api.allternit.com";

export function useRuntimes() {
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<MachineCardRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuntimes = useCallback(async () => {
    try {
      const token = await auth.getToken();
      const res = await fetch(`${CLOUD_API_BASE_URL}/api/v1/runtime-devices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401) {
          setRuntimes([]);
          return;
        }
        throw new Error(`Failed to load runtimes (${res.status})`);
      }
      const data = (await res.json()) as { runtimes?: CloudRuntimeDevice[] } | CloudRuntimeDevice[];
      const devices = Array.isArray(data) ? data : data.runtimes ?? [];
      setRuntimes(
        devices.map((rt) => ({
          id: rt.id,
          name: rt.name || rt.hostname || "Unnamed machine",
          host: `${rt.platform} · ${rt.hostname}`,
          status: rt.status === "online" ? "online" : "offline",
          lastHeartbeatAt: rt.lastSeenAt ? new Date(rt.lastSeenAt).getTime() : undefined,
          agentClis: (rt.capabilities || []).map((cap) => ({ name: cap, icon: "" })),
        }))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtimes");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void fetchRuntimes();
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  return { runtimes, loading, error, refetch: fetchRuntimes };
}

export function MachinesPanel({
  selectedRuntimeId,
  onSelectRuntime,
  pushByRuntime,
  onTogglePush,
  onHandoff,
  onOpenSession,
  showSelection,
  showHandoff,
  showOpenSession,
  layout = "grid",
  className,
}: MachinesPanelProps): React.ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();
  const { runtimes, loading, error } = useRuntimes();

  // Sync selected runtime from URL query param on first load.
  useEffect(() => {
    if (!showSelection) return;
    const runtimeFromUrl = searchParams.get("runtime");
    if (runtimeFromUrl && runtimes.some((r) => r.id === runtimeFromUrl)) {
      onSelectRuntime?.(runtimeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimes.length, showSelection]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectRuntime?.(id);
      if (showSelection) {
        const next = new URLSearchParams(searchParams);
        next.set("runtime", id);
        setSearchParams(next, { replace: true });
      }
    },
    [onSelectRuntime, searchParams, setSearchParams, showSelection]
  );

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="text-[12px] text-[var(--text-tertiary)]">Loading machines…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <div className="text-[12px] text-[var(--status-error)]">{error}</div>
      </div>
    );
  }

  if (runtimes.length === 0) {
    return (
      <div className="px-4 py-4">
        <div className="rounded-xl bg-[var(--surface-hover)] border border-dashed border-[var(--border-default)] px-3 py-3">
          <p className="m-0 text-[12px] text-[var(--text-tertiary)] italic">
            No paired machines. Pair a machine from the Allternit desktop app to get started.
          </p>
        </div>
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className={cn("px-4 pb-4 space-y-1", className)}>
        {runtimes.map((rt) => {
          const isOnline = rt.status === "online";
          const isSelected = selectedRuntimeId === rt.id;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => (isSelected ? onSelectRuntime?.(null) : handleSelect(rt.id))}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                  : "border-[var(--border-default)] bg-transparent hover:bg-[var(--surface-hover)]"
              )}
            >
              <DesktopTower size={18} className="text-[var(--text-tertiary)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                  {rt.name}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate">{rt.host}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Circle size={8} weight="fill" color={STATUS_COLORS[rt.status] ?? STATUS_COLORS.offline} />
                {isOnline ? (
                  <WifiHigh size={14} color="var(--status-success)" />
                ) : (
                  <WifiSlash size={14} color="var(--ui-text-muted)" />
                )}
              </div>
            </button>
          );
        })}
        {selectedRuntimeId && (
          <button
            type="button"
            onClick={() => onSelectRuntime?.(null)}
            className="w-full text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-left px-1"
          >
            Clear selection
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", !showSelection && "lg:grid-cols-3", className)}>
      {runtimes.map((rt) => (
        <MachineCard
          key={rt.id}
          runtime={rt}
          selected={selectedRuntimeId === rt.id}
          pushEnabled={pushByRuntime?.[rt.id]}
          showSelection={showSelection}
          showHandoff={showHandoff}
          showOpenSession={showOpenSession}
          onSelect={handleSelect}
          onTogglePush={onTogglePush}
          onHandoff={onHandoff}
          onOpenSession={onOpenSession}
        />
      ))}
    </div>
  );
}
