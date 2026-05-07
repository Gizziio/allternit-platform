"use client";

import { useCallback, useEffect, useState } from "react";

export type RuntimeDriverType = "process" | "container" | "microvm" | "wasm";
export type RuntimeIsolationLevel =
  | "limited"
  | "standard"
  | "hardened"
  | "maximum";
export type RuntimeReplayCaptureLevel = "none" | "minimal" | "full";

export interface RuntimeDriverConfig {
  driver_type: RuntimeDriverType;
  isolation_level: RuntimeIsolationLevel;
  enabled: boolean;
}

export interface RuntimeResourceLimits {
  cpu_millicores: number;
  memory_mib: number;
  budget_credits_per_hour: number | null;
}

export interface RuntimeReplayConfig {
  capture_level: RuntimeReplayCaptureLevel;
  deterministic_mode: boolean;
  snapshot_interval_seconds: number;
}

export interface RuntimePrewarmConfig {
  enabled: boolean;
  pool_size: number;
  warmup_commands: string[];
}

export interface RuntimeVersioningConfig {
  auto_commit: boolean;
  commit_message_template: string;
  branch_prefix: string;
}

export interface RuntimeSettings {
  driver: RuntimeDriverConfig;
  resources: RuntimeResourceLimits;
  replay: RuntimeReplayConfig;
  prewarm: RuntimePrewarmConfig;
  versioning: RuntimeVersioningConfig;
}

export interface RuntimeSettingsPatch {
  driver?: RuntimeDriverConfig;
  resources?: RuntimeResourceLimits;
  replay?: RuntimeReplayConfig;
  prewarm?: RuntimePrewarmConfig;
  versioning?: RuntimeVersioningConfig;
}

export interface RuntimeDriverInfo {
  driver_type: RuntimeDriverType;
  name: string;
  description: string;
  isolation: RuntimeIsolationLevel;
  available: boolean;
  recommended: boolean;
  max_resources: RuntimeResourceLimits;
}

export interface RuntimeDriverStatus {
  driver_type: RuntimeDriverType;
  status: string;
  active_instances: number;
  pool_size: number;
  healthy: boolean;
  message?: string | null;
}

export interface RuntimeDriverRecord extends RuntimeDriverInfo {
  statusInfo: RuntimeDriverStatus | null;
  isActive: boolean;
}

export interface UseRuntimeSettingsResult {
  settings: RuntimeSettings | null;
  drivers: RuntimeDriverRecord[];
  isLoading: boolean;
  isSaving: boolean;
  isResetting: boolean;
  isActivatingDriver: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateSettings: (patch: RuntimeSettingsPatch) => Promise<RuntimeSettings>;
  resetSettings: () => Promise<RuntimeSettings>;
  activateDriver: (driverType: RuntimeDriverType) => Promise<void>;
}

const SETTINGS_ENDPOINT = "/api/v1/runtime/settings";
const SETTINGS_RESET_ENDPOINT = "/api/v1/runtime/settings/reset";
const DRIVERS_ENDPOINT = "/api/v1/runtime/drivers";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Runtime settings request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function fetchDriverStatus(
  driverType: RuntimeDriverType,
): Promise<RuntimeDriverStatus | null> {
  try {
    const response = await fetch(
      `${DRIVERS_ENDPOINT}/${encodeURIComponent(driverType)}/status`,
    );
    return await handleResponse<RuntimeDriverStatus>(response);
  } catch (error) {
    return {
      driver_type: driverType,
      status: "unavailable",
      active_instances: 0,
      pool_size: 0,
      healthy: false,
      message:
        error instanceof Error ? error.message : "Failed to load driver status",
    };
  }
}

async function fetchDriverRecords(
  activeDriverType: RuntimeDriverType | undefined,
): Promise<RuntimeDriverRecord[]> {
  const driverInfos = await handleResponse<RuntimeDriverInfo[]>(
    await fetch(DRIVERS_ENDPOINT),
  );

  const statuses = await Promise.all(
    driverInfos.map((driver) => fetchDriverStatus(driver.driver_type)),
  );

  return driverInfos.map((driver, index) => ({
    ...driver,
    statusInfo: statuses[index],
    isActive: driver.driver_type === activeDriverType,
  }));
}

export function useRuntimeSettings(): UseRuntimeSettingsResult {
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [drivers, setDrivers] = useState<RuntimeDriverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isActivatingDriver, setIsActivatingDriver] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSettings = await handleResponse<RuntimeSettings>(
        await fetch(SETTINGS_ENDPOINT),
      );
      const nextDrivers = await fetchDriverRecords(nextSettings.driver.driver_type);

      setSettings(nextSettings);
      setDrivers(nextDrivers);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load runtime settings"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateSettings = useCallback(
    async (patch: RuntimeSettingsPatch): Promise<RuntimeSettings> => {
      setIsSaving(true);
      setError(null);

      try {
        const nextSettings = await handleResponse<RuntimeSettings>(
          await fetch(SETTINGS_ENDPOINT, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          }),
        );
        const nextDrivers = await fetchDriverRecords(
          nextSettings.driver.driver_type,
        );
        setSettings(nextSettings);
        setDrivers(nextDrivers);
        return nextSettings;
      } catch (err) {
        const normalizedError =
          err instanceof Error
            ? err
            : new Error("Failed to update runtime settings");
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const resetSettings = useCallback(async (): Promise<RuntimeSettings> => {
    setIsResetting(true);
    setError(null);

    try {
      const nextSettings = await handleResponse<RuntimeSettings>(
        await fetch(SETTINGS_RESET_ENDPOINT, {
          method: "POST",
        }),
      );
      const nextDrivers = await fetchDriverRecords(nextSettings.driver.driver_type);
      setSettings(nextSettings);
      setDrivers(nextDrivers);
      return nextSettings;
    } catch (err) {
      const normalizedError =
        err instanceof Error
          ? err
          : new Error("Failed to reset runtime settings");
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsResetting(false);
    }
  }, []);

  const activateDriver = useCallback(
    async (driverType: RuntimeDriverType): Promise<void> => {
      setIsActivatingDriver(true);
      setError(null);

      try {
        await handleResponse(
          await fetch(
            `${DRIVERS_ENDPOINT}/${encodeURIComponent(driverType)}/activate`,
            {
              method: "POST",
            },
          ),
        );
        const nextSettings = await handleResponse<RuntimeSettings>(
          await fetch(SETTINGS_ENDPOINT),
        );
        const nextDrivers = await fetchDriverRecords(
          nextSettings.driver.driver_type,
        );
        setSettings(nextSettings);
        setDrivers(nextDrivers);
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error("Failed to activate driver");
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsActivatingDriver(false);
      }
    },
    [],
  );

  return {
    settings,
    drivers,
    isLoading,
    isSaving,
    isResetting,
    isActivatingDriver,
    error,
    refetch,
    updateSettings,
    resetSettings,
    activateDriver,
  };
}
