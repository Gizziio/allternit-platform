import { useCallback, useEffect, useState } from "react";
import { telemetryApi } from "./telemetry.service";
import type { TelemetrySnapshot } from "./schema";

export function useTelemetrySnapshot(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!sessionId) {
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await telemetryApi.fetchSnapshot(sessionId);
      setSnapshot(next);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load telemetry snapshot");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  return { snapshot, loading, error, refresh: fetchSnapshot };
}
