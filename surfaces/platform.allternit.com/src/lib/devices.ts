import { api } from "@/lib/api-client";

export interface RuntimeDevice {
  id: string;
  name: string;
  runtimeType: string;
  hostname?: string | null;
  platform?: string | null;
  version?: string | null;
  capabilities: string[];
  publicKeyFingerprint: string;
  status: "online" | "offline" | "revoked" | string;
  lastSeenAt?: string | null;
  createdAt: string;
  credentialExpiresAt: string;
}

export interface PairingRequest {
  pairingId: string;
  userCode: string;
  name: string;
  runtimeType: string;
  hostname?: string | null;
  platform?: string | null;
  publicKeyFingerprint: string;
  capabilities: string[];
  status: string;
  expiresAt: string;
}

export async function listRuntimeDevices(): Promise<RuntimeDevice[]> {
  const response = await api.get<{ runtimes: RuntimeDevice[] }>("/api/v1/runtime-devices");
  return response.runtimes;
}

export async function revokeRuntimeDevice(id: string): Promise<{ id: string; status: string }> {
  return api.delete<{ id: string; status: string }>(`/api/v1/runtime-devices/${encodeURIComponent(id)}`);
}

export async function getPairingInfo(code: string): Promise<PairingRequest> {
  return api.get<PairingRequest>(`/api/v1/runtime-pairings/code/${encodeURIComponent(code)}`);
}

export async function approvePairing(code: string): Promise<{ status: string; pairingId?: string; runtimeName?: string }> {
  return api.post<{ status: string; pairingId?: string; runtimeName?: string }>(
    `/api/v1/runtime-pairings/code/${encodeURIComponent(code)}/approve`
  );
}

export async function denyPairing(code: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/api/v1/runtime-pairings/code/${encodeURIComponent(code)}/deny`);
}
