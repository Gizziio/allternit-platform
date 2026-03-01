/**
 * ContextBanner - Shows current context mode and system status
 */

import React from "react";
import {
  X,
  Wifi,
  WifiOff,
  AlertCircle,
  GitBranch,
  ClipboardList,
  Activity,
  Eye,
  CheckCircle,
} from "lucide-react";
import type { ContextMode, SystemHealth } from "@/lib/agents/unified.store";

interface ContextBannerProps {
  mode: ContextMode;
  health: SystemHealth;
  error: string | null;
  onDismissError: () => void;
}

const modeConfig: Record<ContextMode, { label: string; icon: React.ElementType; tone: string }> = {
  idle: { label: "Idle", icon: CheckCircle, tone: "border-white/10 bg-white/5 text-muted-foreground" },
  planning: { label: "Planning", icon: GitBranch, tone: "border-blue-300/20 bg-blue-300/10 text-blue-100" },
  executing: { label: "Executing", icon: Activity, tone: "border-amber-300/20 bg-amber-300/10 text-amber-100" },
  working: { label: "Working", icon: ClipboardList, tone: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" },
  reviewing: { label: "Reviewing", icon: Eye, tone: "border-pink-300/20 bg-pink-300/10 text-pink-100" },
  monitoring: { label: "Monitoring", icon: Activity, tone: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100" },
};

export function ContextBanner({ mode, health, error, onDismissError }: ContextBannerProps) {
  const config = modeConfig[mode];
  const ModeIcon = config.icon;
  const isConnected = health.rails && health.gateway;

  return (
    <div className="border-b border-white/5 bg-black/20 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] ${config.tone}`}>
            <ModeIcon className="h-4 w-4" />
            {config.label}
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
              isConnected
                ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                : "border-red-400/20 bg-red-400/10 text-red-100"
            }`}
          >
            {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isConnected ? "Rails + Gateway Connected" : "Connection Degraded"}
          </div>

          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            v{health.version}
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100 xl:max-w-2xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button
              onClick={onDismissError}
              className="rounded-full p-1 transition hover:bg-white/10"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ContextBanner;
