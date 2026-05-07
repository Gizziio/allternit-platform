/**
 * Legacy backend install compatibility route.
 *
 * The canonical flow is now:
 * 1. save/update SSH connection
 * 2. connect/probe via /api/v1/ssh-connections
 * 3. install via /api/v1/ssh-connections/:id/install-agent
 * 4. activate via /api/v1/runtime/backend
 *
 * This route keeps older clients working without maintaining a separate
 * websocket installer contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NodeSSH } from 'node-ssh';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';
import { gatherSSHSystemInfo, type SSHSystemInfo } from '@/lib/ssh-system-info';
import { backendInstaller, type InstallProgress } from '@/services/backend/BackendInstallerService';
import {
  defaultBackendUrlForHost,
  ensureBackendPreference,
  setActiveRuntimeBackendPreference,
  toGatewayAuthorizationHeader,
  upsertRuntimeBackendTargetFromConnection,
  verifyRuntimeBackendHealth,
} from '@/lib/runtime-backend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LegacyInstallRequest = {
  installation_id?: string;
  host?: string;
  port?: number;
  username?: string;
  private_key?: string;
  password?: string;
};

function toLegacySystemInfo(systemInfo: SSHSystemInfo) {
  return {
    os: systemInfo.os,
    distro: systemInfo.distro,
    version: systemInfo.version,
    architecture: systemInfo.architecture,
    isAllternitInstalled: systemInfo.allternitInstalled,
    allternitVersion: systemInfo.allternitVersion,
    hasSystemd: systemInfo.hasSystemd,
  };
}

async function saveLegacyConnection(
  userId: string,
  body: LegacyInstallRequest,
) {
  const host = body.host?.trim();
  const username = body.username?.trim();
  const port = body.port || 22;
  const privateKey = body.private_key?.trim() || undefined;
  const password = body.password || undefined;
  const authType = privateKey ? 'key' : password ? 'password' : null;

  if (!host || !username) {
    throw new Error('Missing required fields: host, username');
  }

  if (!authType) {
    throw new Error('Either private_key or password is required');
  }

  const existing = await prisma.sshConnection.findFirst({
    where: {
      userId,
      host,
      port,
      username,
    },
    select: { id: true },
  });

  const payload = {
    name: host,
    host,
    port,
    username,
    authType,
    encryptedPrivateKey: privateKey ? encrypt(privateKey) : null,
    encryptedPassword: password ? encrypt(password) : null,
    updatedAt: new Date(),
  } as const;

  if (existing) {
    return prisma.sshConnection.update({
      where: { id: existing.id },
      data: payload,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        status: true,
      },
    });
  }

  return prisma.sshConnection.create({
    data: {
      userId,
      ...payload,
      status: 'disconnected',
    },
    select: {
      id: true,
      name: true,
      host: true,
      port: true,
      username: true,
      status: true,
    },
  });
}

// Simple HTTP endpoint retained for compatibility. The websocket transport has
// been retired in favor of the canonical SSH/runtime API sequence.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  return NextResponse.json({
    websocket_url: null,
    compatibility_mode: true,
    deprecated: true,
    install_url: `${url.origin}/api/v1/backend-install/progress`,
    canonical_routes: [
      '/api/v1/ssh-connections',
      '/api/v1/ssh-connections/:id/connect',
      '/api/v1/ssh-connections/:id/install-agent',
      '/api/v1/runtime/backend',
    ],
    message: 'WebSocket installation streaming has been removed. This endpoint now runs the canonical SSH/runtime backend flow over HTTP.',
  });
}

export async function POST(request: NextRequest) {
  const log: string[] = [];
  let connectionId: string | null = null;

  try {
    const { userId: authUserId, orgId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const body = (await request.json()) as LegacyInstallRequest;
    const connection = await saveLegacyConnection(userId, body);
    connectionId = connection.id;

    const { NodeSSH } = await import('node-ssh');
    const ssh = new NodeSSH();
    const privateKey = body.private_key?.trim() || undefined;
    const password = body.password || undefined;

    await ssh.connect({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      privateKey,
      password,
      readyTimeout: 20000,
    });

    const systemInfo = await gatherSSHSystemInfo(ssh);
    ssh.dispose();

    const connected = await prisma.sshConnection.update({
      where: { id: connection.id },
      data: {
        status: 'connected',
        os: systemInfo.os,
        architecture: systemInfo.architecture,
        dockerInstalled: systemInfo.dockerInstalled,
        allternitInstalled: systemInfo.allternitInstalled,
        allternitVersion: systemInfo.allternitVersion ?? null,
        lastConnectedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        allternitInstalled: true,
        allternitVersion: true,
      },
    });

    const defaultBackendUrl = defaultBackendUrlForHost(connected.host);
    const existingBackendTarget = await prisma.remoteBackendTarget.findUnique({
      where: { sshConnectionId: connected.id },
      select: { encryptedGatewayToken: true },
    });
    const existingAuthorization = toGatewayAuthorizationHeader(
      existingBackendTarget?.encryptedGatewayToken
        ? decrypt(existingBackendTarget.encryptedGatewayToken)
        : null,
    );
    const existingHealth = connected.allternitInstalled
      ? await verifyRuntimeBackendHealth(defaultBackendUrl, {
          authorizationHeader: existingAuthorization,
        })
      : { reachable: false, healthUrl: null };

    if (connected.allternitInstalled && existingHealth.reachable) {
      const backendTarget = await upsertRuntimeBackendTargetFromConnection({
        userId,
        sshConnectionId: connected.id,
        name: connected.name,
        host: connected.host,
        connectionStatus: connected.status,
        allternitInstalled: true,
        allternitVersion: connected.allternitVersion,
        backendUrl: defaultBackendUrl,
        gatewayUrl: defaultBackendUrl,
        gatewayToken: existingAuthorization,
        markVerified: true,
        backendReachable: true,
      });

      await ensureBackendPreference(userId);
      await setActiveRuntimeBackendPreference({
        userId,
        orgId: orgId ?? null,
        mode: 'byoc-vps',
        fallbackMode: 'local',
        backendTargetId: backendTarget.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Allternit backend is already installed on this server',
        installation_log: ['Allternit backend already installed, skipping reinstallation.'],
        version: connected.allternitVersion ?? backendInstaller.getBackendVersion(),
        api_url: defaultBackendUrl,
        backend_target_id: backendTarget.id,
        reachable_from_shell: true,
        system_info: toLegacySystemInfo(systemInfo),
      });
    }

    const installationId = body.installation_id || `legacy-${connection.id}-${Date.now()}`;
    const result = await backendInstaller.installBackend(
      installationId,
      {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey,
        password,
      },
      (progress: InstallProgress) => {
        if (progress.message) {
          log.push(progress.message);
        }
      },
    );

    if (!result.success) {
      await prisma.sshConnection.update({
        where: { id: connection.id },
        data: { status: 'error' },
      });

      await upsertRuntimeBackendTargetFromConnection({
        userId,
        sshConnectionId: connection.id,
        name: connection.name,
        host: connection.host,
        connectionStatus: 'error',
        allternitInstalled: false,
        allternitVersion: null,
        lastError: result.error ?? 'Installation failed',
      });

      return NextResponse.json({
        success: false,
        error: result.error ?? 'Installation failed',
        installation_log: log,
      });
    }

    const installed = await prisma.sshConnection.update({
      where: { id: connection.id },
      data: {
        status: 'connected',
        allternitInstalled: true,
        allternitVersion: backendInstaller.getBackendVersion(),
        lastConnectedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        allternitInstalled: true,
        allternitVersion: true,
      },
    });

    const health = result.apiUrl
      ? await verifyRuntimeBackendHealth(result.apiUrl, {
          authorizationHeader: result.gatewayAuthHeader,
        })
      : { reachable: false, healthUrl: null };

    const backendTarget = await upsertRuntimeBackendTargetFromConnection({
      userId,
      sshConnectionId: installed.id,
      name: installed.name,
      host: installed.host,
      connectionStatus: installed.status,
      allternitInstalled: installed.allternitInstalled ?? false,
      allternitVersion: installed.allternitVersion,
      backendUrl: result.apiUrl ?? null,
      gatewayUrl: result.apiUrl ?? null,
      gatewayToken: result.gatewayAuthHeader ?? null,
      markVerified: health.reachable,
      backendReachable: health.reachable,
      lastError: health.reachable
        ? null
        : 'Remote backend installed successfully but is not reachable from this shell yet',
    });

    if (health.reachable) {
      await ensureBackendPreference(userId);
      await setActiveRuntimeBackendPreference({
        userId,
        orgId: orgId ?? null,
        mode: 'byoc-vps',
        fallbackMode: 'local',
        backendTargetId: backendTarget.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: health.reachable
        ? 'Allternit backend installed and activated successfully'
        : 'Allternit backend installed, but it is not reachable from this shell yet',
      installation_log: log,
      version: installed.allternitVersion,
      api_url: result.apiUrl ?? null,
      backend_target_id: backendTarget.id,
      reachable_from_shell: health.reachable,
      system_info: toLegacySystemInfo({
        ...systemInfo,
        allternitInstalled: true,
        allternitVersion: installed.allternitVersion ?? systemInfo.allternitVersion,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Installation failed';

    if (connectionId) {
      await prisma.sshConnection.update({
        where: { id: connectionId },
        data: { status: 'error' },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: false,
      error: message,
      installation_log: log,
    });
  }
}
