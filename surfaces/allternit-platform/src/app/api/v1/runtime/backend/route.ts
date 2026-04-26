import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import { syncRuntimeBackendPreferenceToClerk } from "@/lib/runtime-backend-clerk";
import {
  resolveRuntimeBackendForAuthUserId,
  setActiveRuntimeBackendPreference,
} from "@/lib/runtime-backend";
import { prisma } from "@/lib/db";

function toResponsePayload(
  resolved: Awaited<ReturnType<typeof resolveRuntimeBackendForAuthUserId>>,
) {
  return {
    mode: resolved.mode,
    fallback_mode: resolved.fallbackMode,
    source: resolved.source,
    gateway_url: resolved.gatewayUrl,
    gateway_ws_url: resolved.gatewayWsUrl,
    active_backend: resolved.backendTarget
      ? {
          id: resolved.backendTarget.id,
          ssh_connection_id: resolved.backendTarget.sshConnectionId,
          name: resolved.backendTarget.name,
          status: resolved.backendTarget.status,
          install_state: resolved.backendTarget.installState,
          backend_url: resolved.backendTarget.backendUrl,
          gateway_url: resolved.backendTarget.gatewayUrl,
          gateway_ws_url: resolved.backendTarget.gatewayWsUrl,
          installed_version: resolved.backendTarget.installedVersion,
          supported_client_range: resolved.backendTarget.supportedClientRange,
          last_verified_at: resolved.backendTarget.lastVerifiedAt,
          last_heartbeat_at: resolved.backendTarget.lastHeartbeatAt,
          last_error: resolved.backendTarget.lastError,
        }
      : null,
    available_backends: [],
  };
}

export async function GET() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveRuntimeBackendForAuthUserId(authUserId);
  const availableTargets = await prisma.remoteBackendTarget.findMany({
    where: { userId: resolved.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      sshConnectionId: true,
      name: true,
      status: true,
      installState: true,
      backendUrl: true,
      gatewayUrl: true,
      gatewayWsUrl: true,
      installedVersion: true,
      supportedClientRange: true,
      lastVerifiedAt: true,
      lastHeartbeatAt: true,
      lastError: true,
    },
  });

  return NextResponse.json({
    ...toResponsePayload(resolved),
    available_backends: availableTargets.map((target) => ({
      id: target.id,
      ssh_connection_id: target.sshConnectionId,
      name: target.name,
      status: target.status,
      install_state: target.installState,
      backend_url: target.backendUrl,
      gateway_url: target.gatewayUrl,
      gateway_ws_url: target.gatewayWsUrl,
      installed_version: target.installedVersion,
      supported_client_range: target.supportedClientRange,
      last_verified_at: target.lastVerifiedAt?.toISOString() ?? null,
      last_heartbeat_at: target.lastHeartbeatAt?.toISOString() ?? null,
      last_error: target.lastError,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode =
    body?.mode === "byoc-vps" ||
    body?.mode === "cloud" ||
    body?.mode === "hybrid" ||
    body?.mode === "local"
      ? body.mode
      : "local";
  const fallbackMode =
    body?.fallbackMode === "byoc-vps" ||
    body?.fallbackMode === "cloud" ||
    body?.fallbackMode === "hybrid" ||
    body?.fallbackMode === "local"
      ? body.fallbackMode
      : "local";

  const resolved = await resolveRuntimeBackendForAuthUserId(authUserId);

  let backendTargetId: string | null | undefined = undefined;
  if (body?.backendTargetId && typeof body.backendTargetId === "string") {
    backendTargetId = body.backendTargetId;
  } else if (body?.sshConnectionId && typeof body.sshConnectionId === "string") {
    const target = await prisma.remoteBackendTarget.findFirst({
      where: {
        userId: resolved.userId,
        sshConnectionId: body.sshConnectionId,
      },
      select: { id: true },
    });
    backendTargetId = target?.id ?? null;
  } else if (mode === "local") {
    backendTargetId = null;
  }

  await setActiveRuntimeBackendPreference({
    userId: resolved.userId,
    mode,
    fallbackMode,
    backendTargetId,
  });
  await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
    // Local preference save still succeeds if Clerk sync is unavailable.
  });

  const updated = await resolveRuntimeBackendForAuthUserId(authUserId);
  return NextResponse.json(toResponsePayload(updated));
}
