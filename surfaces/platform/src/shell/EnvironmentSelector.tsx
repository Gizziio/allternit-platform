/**
 * EnvironmentSelector - Runtime target switcher
 *
 * Small dropdown in header showing the active execution target.
 * This is now backed by the persisted runtime backend API instead of
 * the legacy in-memory environment service.
 */

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Desktop,
  Cloud,
  HardDrives,
  CloudSun,
  CaretDown,
  GearSix,
  Check,
  Pulse as Activity,
} from "@phosphor-icons/react";
import { GlassSurface } from "@/design/GlassSurface";
import {
  runtimeBackendApi,
  type RuntimeBackendMode,
  type RuntimeBackendResponse,
} from "@/api/infrastructure/runtime-backend";
import {
  loadRuntimeBackendSnapshot,
  subscribeRuntimeBackendSnapshot,
} from "@/lib/runtime-backend-client";

export type EnvironmentType = RuntimeBackendMode;

export interface EnvironmentTarget {
  id: string;
  type: EnvironmentType;
  name: string;
  description: string;
  status: "active" | "inactive" | "degraded" | "provisioning";
  region?: string;
  instances?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentSelectorProps {
  currentEnvironment?: EnvironmentType;
  environments?: EnvironmentTarget[];
  onEnvironmentChange?: (env: EnvironmentType) => void;
  onOpenControlCenter?: () => void;
  className?: string;
}

export function EnvironmentSelector({
  currentEnvironment = "local",
  environments = [],
  onEnvironmentChange,
  onOpenControlCenter,
  className,
}: EnvironmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalEnvs, setInternalEnvs] = useState<EnvironmentTarget[]>([
    getDefaultEnvironment(currentEnvironment),
  ]);
  const [runtimeBackend, setRuntimeBackend] = useState<RuntimeBackendResponse | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<EnvironmentType>(currentEnvironment);

  const refreshRuntime = useCallback(async () => {
    const runtime = await runtimeBackendApi.get();
    setRuntimeBackend(runtime);
    setSelectedEnvironment(runtime.mode);
    setInternalEnvs(mapRuntimeBackendToEnvironments(runtime));
    return runtime;
  }, []);

  useEffect(() => {
    loadRuntimeBackendSnapshot().catch(() => null);
    refreshRuntime().catch((error) => {
      console.error("Failed to load runtime environments:", error);
    });

    return subscribeRuntimeBackendSnapshot(() => {
      refreshRuntime().catch(() => null);
    });
  }, [refreshRuntime]);

  useEffect(() => {
    if (!runtimeBackend) {
      setSelectedEnvironment(currentEnvironment);
    }
  }, [currentEnvironment, runtimeBackend]);

  const envList = environments.length > 0 ? environments : internalEnvs;
  const currentEnv = useMemo(
    () =>
      envList.find((env) => env.type === selectedEnvironment) ||
      getDefaultEnvironment(selectedEnvironment),
    [envList, selectedEnvironment],
  );

  const handleSelect = useCallback(
    async (type: EnvironmentType) => {
      setIsLoading(true);

      try {
        let updatedRuntime: RuntimeBackendResponse;

        if (type === "local") {
          updatedRuntime = await runtimeBackendApi.activateLocal();
        } else if (type === "byoc-vps") {
          const backendTargetId =
            runtimeBackend?.active_backend?.id ||
            runtimeBackend?.available_backends?.[0]?.id;

          if (!backendTargetId) {
            throw new Error("No BYOC backend is available yet");
          }

          updatedRuntime = await runtimeBackendApi.setBackend({
            mode: "byoc-vps",
            fallbackMode: "local",
            backendTargetId,
          });
        } else {
          updatedRuntime = await runtimeBackendApi.setBackend({
            mode: type,
            fallbackMode: "local",
          });
        }

        setRuntimeBackend(updatedRuntime);
        setSelectedEnvironment(updatedRuntime.mode);
        setInternalEnvs(mapRuntimeBackendToEnvironments(updatedRuntime));
        onEnvironmentChange?.(updatedRuntime.mode);
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to switch environment:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onEnvironmentChange, runtimeBackend],
  );

  const getEnvironmentIcon = (type: EnvironmentType) => {
    switch (type) {
      case "local":
        return Desktop;
      case "cloud":
        return Cloud;
      case "byoc-vps":
        return HardDrives;
      case "hybrid":
        return CloudSun;
      default:
        return Cloud;
    }
  };

  const getEnvironmentColor = (type: EnvironmentType) => {
    switch (type) {
      case "local":
        return "text-emerald-500";
      case "cloud":
        return "text-blue-500";
      case "byoc-vps":
        return "text-purple-500";
      case "hybrid":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const CurrentIcon = getEnvironmentIcon(selectedEnvironment);

  return (
    <div className={`relative ${className || ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {isLoading ? (
          <Activity className="h-4 w-4 animate-spin text-blue-500" />
        ) : (
          <CurrentIcon
            className={`h-4 w-4 ${getEnvironmentColor(selectedEnvironment)}`}
          />
        )}
        <span className="font-medium">{currentEnv.name}</span>
        <CaretDown className="h-3 w-3 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <GlassSurface
            intensity="thick"
            className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border shadow-xl"
            style={{
              background: "var(--glass-bg-thick)",
            }}
          >
            <div className="border-b border-border bg-secondary/30 px-4 py-3">
              <h4 className="text-sm font-semibold">Runtime Environment</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select execution target
              </p>
            </div>

            <div className="py-2">
              {envList.length > 0 ? (
                envList.map((env) => {
                  const Icon = getEnvironmentIcon(env.type);
                  const isSelected = env.type === selectedEnvironment;

                  return (
                    <button
                      key={env.id}
                      onClick={() => handleSelect(env.type)}
                      disabled={isLoading}
                      className={`w-full px-4 py-3 flex items-start gap-3 transition-colors hover:bg-accent/10 ${
                        isSelected ? "bg-accent/5" : ""
                      } ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <div className="flex-shrink-0">
                        <Icon className={`h-5 w-5 ${getEnvironmentColor(env.type)}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{env.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {env.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              env.status === "active"
                                ? "bg-green-500"
                                : env.status === "degraded"
                                  ? "bg-yellow-500"
                                  : env.status === "provisioning"
                                    ? "bg-blue-500"
                                    : "bg-gray-500"
                            }`}
                          />
                          <span className="text-xs capitalize">{env.status}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Cloud className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No environments configured</p>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-secondary/30 px-4 py-3">
              <button
                onClick={onOpenControlCenter}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
              >
                <GearSix size={16} />
                <span>Manage Environments</span>
              </button>
            </div>
          </GlassSurface>
        </>
      )}
    </div>
  );
}

function getDefaultEnvironment(type: EnvironmentType): EnvironmentTarget {
  const now = new Date().toISOString();

  switch (type) {
    case "local":
      return {
        id: "local-default",
        type: "local",
        name: "This Device",
        description: "Use the desktop-local backend",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
    case "cloud":
      return {
        id: "cloud-default",
        type: "cloud",
        name: "A2R Cloud",
        description: "Hosted execution plane",
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      };
    case "byoc-vps":
      return {
        id: "byoc-default",
        type: "byoc-vps",
        name: "BYOC VPS",
        description: "Connect and install a backend on your VPS",
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      };
    case "hybrid":
      return {
        id: "hybrid-default",
        type: "hybrid",
        name: "Hybrid",
        description: "Cloud + VPS combined",
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      };
    default:
      return {
        id: "unknown",
        type: "local",
        name: "Unknown",
        description: "Unknown environment",
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      };
  }
}

function mapRemoteStatus(
  runtime: RuntimeBackendResponse,
  target?: RuntimeBackendResponse["active_backend"],
): EnvironmentTarget["status"] {
  if (!target) {
    return "inactive";
  }

  if (target.status === "degraded") {
    return "degraded";
  }

  if (target.install_state === "installing" || target.install_state === "unknown") {
    return "provisioning";
  }

  if (
    runtime.mode === "byoc-vps" ||
    target.status === "ready" ||
    target.status === "connected" ||
    target.status === "installed"
  ) {
    return runtime.mode === "byoc-vps" ? "active" : "inactive";
  }

  return "inactive";
}

function mapRuntimeBackendToEnvironments(
  runtime: RuntimeBackendResponse,
): EnvironmentTarget[] {
  const now = new Date().toISOString();
  const remoteTarget = runtime.active_backend ?? runtime.available_backends?.[0] ?? null;
  const environments: EnvironmentTarget[] = [
    {
      id: "local-runtime",
      type: "local",
      name: "This Device",
      description: "Use the desktop-local backend",
      status: runtime.mode === "local" ? "active" : "inactive",
      createdAt: now,
      updatedAt: now,
    },
  ];

  if (remoteTarget || (runtime.available_backends?.length ?? 0) > 0) {
    environments.push({
      id: remoteTarget?.id || "byoc-runtime",
      type: "byoc-vps",
      name: remoteTarget?.name || "BYOC VPS",
      description:
        remoteTarget?.gateway_url ||
        remoteTarget?.backend_url ||
        "Connected VPS runtime pending install",
      status: mapRemoteStatus(runtime, remoteTarget || undefined),
      createdAt: now,
      updatedAt: now,
    });
  }

  return environments;
}

export default EnvironmentSelector;
