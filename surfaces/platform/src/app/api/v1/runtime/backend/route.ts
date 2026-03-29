import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import {
  ensureBackendPreference,
  resolveRuntimeBackendForAuthUserId,
  setActiveRuntimeBackendPreference,
  upsertRuntimeBackendTargetFromConnection,
  verifyRuntimeBackendHealth,
  type RuntimeMode,
} from '@/lib/runtime-backend';
import { resolvePlatformUserId } from '@/lib/server-user';

function serializeBackendTarget(target: {
  id: string;
  sshConnectionId: string;
  name: string;
  status: string;
  installState: string;
  backendUrl: string | null;
  gatewayUrl: string | null;
  gatewayWsUrl: string | null;
  installedVersion: string | null;
  supportedClientRange: string | null;
  lastVerifiedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastError: string | null;
}) {
  return {
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
  };
}

export async function GET() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, mode, fallbackMode, source, backendTarget, gatewayUrl, gatewayWsUrl } =
    await resolveRuntimeBackendForAuthUserId(authUserId);

  const availableTargets = await prisma.remoteBackendTarget.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
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
    mode,
    fallback_mode: fallbackMode,
    source,
    gateway_url: gatewayUrl,
    gateway_ws_url: gatewayWsUrl,
    active_backend: backendTarget
      ? {
          id: backendTarget.id,
          ssh_connection_id: backendTarget.sshConnectionId,
          name: backendTarget.name,
          status: backendTarget.status,
          install_state: backendTarget.installState,
          backend_url: backendTarget.backendUrl,
          gateway_url: backendTarget.gatewayUrl,
          gateway_ws_url: backendTarget.gatewayWsUrl,
          installed_version: backendTarget.installedVersion,
          supported_client_range: backendTarget.supportedClientRange,
          last_verified_at: backendTarget.lastVerifiedAt,
          last_heartbeat_at: backendTarget.lastHeartbeatAt,
          last_error: backendTarget.lastError,
        }
      : null,
    available_backends: availableTargets.map(serializeBackendTarget),
  });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId, orgId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = await resolvePlatformUserId(authUserId);
  await ensureBackendPreference(userId);

  const body = await request.json().catch(() => ({}));
  const mode = typeof body.mode === 'string' ? body.mode as RuntimeMode : undefined;
  const fallbackMode = typeof body.fallbackMode === 'string'
    ? body.fallbackMode as RuntimeMode
    : undefined;
  const backendTargetId = typeof body.backendTargetId === 'string'
    ? body.backendTargetId
    : undefined;
  const sshConnectionId = typeof body.sshConnectionId === 'string'
    ? body.sshConnectionId
    : undefined;

  let resolvedBackendTargetId = backendTargetId;

  if (sshConnectionId) {
    const connection = await prisma.sshConnection.findFirst({
      where: { id: sshConnectionId, userId },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        a2rInstalled: true,
        a2rVersion: true,
      },
    });

    if (!connection) {
      return NextResponse.json({ error: 'SSH connection not found' }, { status: 404 });
    }

    const target = await upsertRuntimeBackendTargetFromConnection({
      userId,
      sshConnectionId: connection.id,
      name: connection.name,
      host: connection.host,
      connectionStatus: connection.status,
      a2rInstalled: connection.a2rInstalled ?? false,
      a2rVersion: connection.a2rVersion,
      markVerified: connection.a2rInstalled ?? false,
    });

    resolvedBackendTargetId = target.id;
  }

  if (mode === 'byoc-vps') {
    if (!resolvedBackendTargetId) {
      return NextResponse.json(
        { error: 'backendTargetId or sshConnectionId is required for byoc-vps mode' },
        { status: 400 },
      );
    }

    const target = await prisma.remoteBackendTarget.findFirst({
      where: { id: resolvedBackendTargetId, userId },
      select: {
        id: true,
        gatewayUrl: true,
        encryptedGatewayToken: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: 'Backend target not found' }, { status: 404 });
    }

    if (!target.gatewayUrl) {
      return NextResponse.json(
        { error: 'Selected backend target does not have an installed runtime endpoint yet' },
        { status: 400 },
      );
    }

    const health = await verifyRuntimeBackendHealth(target.gatewayUrl, {
      authorizationHeader: target.encryptedGatewayToken
        ? decrypt(target.encryptedGatewayToken)
        : null,
    });
    if (!health.reachable) {
      await prisma.remoteBackendTarget.update({
        where: { id: target.id },
        data: {
          status: 'degraded',
          lastError: 'Remote backend is installed but not reachable from this shell',
        },
      });

      return NextResponse.json(
        { error: 'Selected backend target is installed but not reachable from this shell yet' },
        { status: 409 },
      );
    }

    await prisma.remoteBackendTarget.update({
      where: { id: target.id },
      data: {
        status: 'ready',
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });
  }

  if (resolvedBackendTargetId) {
    const target = await prisma.remoteBackendTarget.findFirst({
      where: { id: resolvedBackendTargetId, userId },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Backend target not found' }, { status: 404 });
    }
  }

  await setActiveRuntimeBackendPreference({
    userId,
    orgId: orgId ?? null,
    mode,
    fallbackMode,
    backendTargetId:
      mode === 'local'
        ? null
        : resolvedBackendTargetId,
  });
  await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
    // Do not fail runtime selection if Clerk metadata sync is temporarily unavailable.
  });

  const resolved = await resolveRuntimeBackendForAuthUserId(authUserId);

  return NextResponse.json({
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
  });
}
