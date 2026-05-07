import { useCallback, useEffect, useState } from "react";
import type { TelemetryProviderInfo } from "./telemetry.service";
import { telemetryApi } from "./telemetry.service";

export function useTelemetryProviders(pollIntervalMs: number = 30000) {
  const [providers, setProviders] = useState<TelemetryProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const next = await telemetryApi.listProviders();
      setProviders(next);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    const handle = setInterval(fetchProviders, pollIntervalMs);
    return () => clearInterval(handle);
  }, [fetchProviders, pollIntervalMs]);

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders,
  };
}
