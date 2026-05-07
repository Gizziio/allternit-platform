import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import { encrypt } from "@/lib/crypto";
import { syncRuntimeBackendPreferenceToClerk } from "@/lib/runtime-backend-clerk";
import {
  resolveRuntimeBackendForAuthUserId,
  setActiveRuntimeBackendPreference,
  verifyRuntimeBackendHealth,
} from "@/lib/runtime-backend";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Manual Runtime Backend";
  const gatewayUrl =
    typeof body?.gatewayUrl === "string" && body.gatewayUrl.trim()
      ? body.gatewayUrl.trim().replace(/\/+$/, "")
      : null;
  const gatewayWsUrl =
    typeof body?.gatewayWsUrl === "string" && body.gatewayWsUrl.trim()
      ? body.gatewayWsUrl.trim().replace(/\/+$/, "")
      : gatewayUrl?.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://") ?? null;
  const gatewayToken =
    typeof body?.gatewayToken === "string" && body.gatewayToken.trim()
      ? body.gatewayToken.trim()
      : null;

  if (!gatewayUrl) {
    return NextResponse.json(
      { error: "gatewayUrl is required" },
      { status: 400 },
    );
  }

  const health = await verifyRuntimeBackendHealth(gatewayUrl, {
    authorizationHeader: gatewayToken,
  });
  if (!health.reachable) {
    return NextResponse.json(
      { error: "Runtime backend is not reachable" },
      { status: 400 },
    );
  }

  const resolved = await resolveRuntimeBackendForAuthUserId(authUserId);
  const parsedGatewayUrl = new URL(gatewayUrl);
  const sshConnectionId = `manual-${resolved.userId}-${Buffer.from(gatewayUrl)
    .toString("base64url")
    .slice(0, 24)}`;

  const target = await prisma.$transaction(async (tx) => {
    await tx.sshConnection.upsert({
      where: { id: sshConnectionId },
      update: {
        userId: resolved.userId,
        name,
        host: parsedGatewayUrl.hostname,
        port: Number(parsedGatewayUrl.port || (parsedGatewayUrl.protocol === "https:" ? 443 : 80)),
        username: "manual",
        authType: "password",
        status: "connected",
        allternitInstalled: true,
        lastConnectedAt: new Date(),
      },
      create: {
        id: sshConnectionId,
        userId: resolved.userId,
        name,
        host: parsedGatewayUrl.hostname,
        port: Number(parsedGatewayUrl.port || (parsedGatewayUrl.protocol === "https:" ? 443 : 80)),
        username: "manual",
        authType: "password",
        status: "connected",
        allternitInstalled: true,
        lastConnectedAt: new Date(),
      },
    });

    return tx.remoteBackendTarget.upsert({
      where: { sshConnectionId },
      update: {
        userId: resolved.userId,
        name,
        status: "ready",
        installState: "installed",
        backendUrl: gatewayUrl,
        gatewayUrl,
        gatewayWsUrl,
        lastVerifiedAt: new Date(),
        encryptedGatewayToken: gatewayToken ? encrypt(gatewayToken) : null,
        lastError: null,
      },
      create: {
        userId: resolved.userId,
        sshConnectionId,
        name,
        status: "ready",
        installState: "installed",
        backendUrl: gatewayUrl,
        gatewayUrl,
        gatewayWsUrl,
        lastVerifiedAt: new Date(),
        encryptedGatewayToken: gatewayToken ? encrypt(gatewayToken) : null,
      },
    });
  });

  await setActiveRuntimeBackendPreference({
    userId: resolved.userId,
    mode: "byoc-vps",
    fallbackMode: "local",
    backendTargetId: target.id,
  });
  await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
    // Local preference save still succeeds if Clerk sync is unavailable.
  });

  return NextResponse.json({
    success: true,
    message: "Runtime backend registered",
    backend_target: {
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
    },
  });
}
