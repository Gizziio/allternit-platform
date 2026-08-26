"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DesktopTower, Circle, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { usePlatformAuth } from "@/lib/platform-auth-client";
import { cn } from "@/lib/utils";

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
}

const CLOUD_API_BASE_URL = "https://api.allternit.com";

const STATUS_COLORS: Record<string, string> = {
  online: "var(--status-success)",
  busy: "var(--status-warning)",
  offline: "var(--ui-text-muted)",
};

export function MachinesPanel({ selectedRuntimeId, onSelectRuntime }: MachinesPanelProps): React.ReactNode {
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<CloudRuntimeDevice[]>([]);
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
      setRuntimes(devices);
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

  return (
    <div className="px-4 pb-4 space-y-1">
      {runtimes.map((rt) => {
        const isOnline = rt.status === "online";
        const isSelected = selectedRuntimeId === rt.id;
        return (
          <button
            key={rt.id}
            type="button"
            onClick={() => onSelectRuntime?.(isSelected ? null : rt.id)}
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
                {rt.name || rt.hostname || "Unnamed machine"}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                {rt.platform} · {rt.hostname}
              </div>
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
