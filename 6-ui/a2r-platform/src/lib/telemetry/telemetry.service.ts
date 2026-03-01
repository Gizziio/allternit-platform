import { API_BASE_URL, apiRequest } from "@/lib/agents/api-config";
import type { TelemetrySnapshot } from "./schema";

const TELEMETRY_BASE = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, "")}/api/v1/telemetry`;

export interface TelemetryProviderInfo {
  id: string;
  name: string;
  iconUrl?: string;
  active: boolean;
  lastUpdated: number;
  description?: string;
}

export const telemetryApi = {
  fetchSnapshot: (sessionId: string) =>
    apiRequest<TelemetrySnapshot>(`${TELEMETRY_BASE}/sessions/${encodeURIComponent(sessionId)}`),
  listProviders: () => apiRequest<TelemetryProviderInfo[]>(`${TELEMETRY_BASE}/providers`),
};
