/**
 * SSH Connections API - Install A2R Backend
 *
 * POST /api/v1/ssh-connections/:id/install-agent
 *
 * Legacy route name retained for compatibility with the current UI.
 * Internally this now runs the canonical native backend installer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';
import { backendInstaller } from '@/services/backend/BackendInstallerService';
import {
  defaultBackendUrlForHost,
  toGatewayAuthorizationHeader,
  upsertRuntimeBackendTargetFromConnection,
  verifyRuntimeBackendHealth,
} from '@/lib/runtime-backend';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/ssh-connections/:id/install-agent
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log: string[] = [];

  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);
    const { id } = await params;

    const connection = await prisma.sshConnection.findFirst({
      where: { id, userId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'SSH connection not found' },
        { status: 404 },
      );
    }

    const existingBackendUrl = defaultBackendUrlForHost(connection.host);
    const existingBackendTarget = await prisma.remoteBackendTarget.findUnique({
      where: { sshConnectionId: connection.id },
      select: { encryptedGatewayToken: true },
    });
    const existingAuthorization = toGatewayAuthorizationHeader(
      existingBackendTarget?.encryptedGatewayToken
        ? decrypt(existingBackendTarget.encryptedGatewayToken)
        : null,
    );
    const existingHealth =
      connection.allternitInstalled && connection.status === 'connected'
        ? await verifyRuntimeBackendHealth(existingBackendUrl, {
            authorizationHeader: existingAuthorization,
          })
        : { reachable: false, healthUrl: null };

    if (connection.allternitInstalled && connection.status === 'connected' && existingHealth.reachable) {
      const backendTarget = await upsertRuntimeBackendTargetFromConnection({
        userId,
        sshConnectionId: connection.id,
        name: connection.name,
        host: connection.host,
        connectionStatus: connection.status,
        allternitInstalled: true,
        allternitVersion: connection.allternitVersion,
        markVerified: true,
        backendUrl: existingBackendUrl,
        gatewayUrl: existingBackendUrl,
        gatewayToken: existingAuthorization,
        backendReachable: true,
      });

      await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
        // Preserve the local backend state even if Clerk metadata sync is unavailable.
      });

      return NextResponse.json({
        success: true,
        message: 'A2R backend is already installed on this server',
        installation_log: ['A2R backend already installed, skipping reinstallation.'],
        version: connection.allternitVersion ?? backendInstaller.getBackendVersion(),
        api_url: existingBackendUrl,
        backend_target_id: backendTarget.id,
      });
    }

    let privateKey: string | undefined;
    let password: string | undefined;

    if (connection.authType === 'key' && connection.encryptedPrivateKey) {
      privateKey = decrypt(connection.encryptedPrivateKey);
    } else if (connection.authType === 'password' && connection.encryptedPassword) {
      password = decrypt(connection.encryptedPassword);
    } else {
      return NextResponse.json(
        { success: false, message: 'No valid SSH credentials found', installation_log: ['ERROR: No valid SSH credentials found'] },
        { status: 200 },
      );
    }

    const installationId = `ssh-${connection.id}-${Date.now()}`;
    const result = await backendInstaller.installBackend(
      installationId,
      {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey,
        password,
      },
      (progress) => {
        if (progress.message) {
          log.push(progress.message);
        }
      },
    );

    if (!result.success) {
      await prisma.sshConnection.update({
        where: { id: connection.id },
        data: {
          status: 'error',
        },
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

      await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
        // Preserve the local failure state even if Clerk metadata sync is unavailable.
      });

      return NextResponse.json({
        success: false,
        message: result.error ?? 'Installation failed',
        installation_log: log,
      }, { status: 200 });
    }

    const updated = await prisma.sshConnection.update({
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

    const externalHealth = result.apiUrl
      ? await verifyRuntimeBackendHealth(result.apiUrl, {
          authorizationHeader: result.gatewayAuthHeader,
        })
      : { reachable: false, healthUrl: null };

    const backendTarget = await upsertRuntimeBackendTargetFromConnection({
      userId,
      sshConnectionId: updated.id,
      name: updated.name,
      host: updated.host,
      connectionStatus: updated.status,
      allternitInstalled: updated.allternitInstalled ?? false,
      allternitVersion: updated.allternitVersion,
      backendUrl: result.apiUrl ?? null,
      gatewayUrl: result.apiUrl ?? null,
      gatewayToken: result.gatewayAuthHeader ?? null,
      markVerified: externalHealth.reachable,
      backendReachable: externalHealth.reachable,
      lastError: externalHealth.reachable
        ? null
        : 'Remote backend installed successfully but is not reachable from this shell yet',
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Preserve the local install result even if Clerk metadata sync is unavailable.
    });

    return NextResponse.json({
      success: true,
      message: externalHealth.reachable
        ? 'A2R backend installed and started successfully'
        : 'A2R backend installed, but it is not reachable from this shell yet',
      installation_log: log,
      version: updated.allternitVersion,
      api_url: result.apiUrl ?? null,
      backend_target_id: backendTarget.id,
      reachable_from_shell: externalHealth.reachable,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Installation failed';
    log.push(`ERROR: ${message}`);

    return NextResponse.json({
      success: false,
      message,
      installation_log: log,
    }, { status: 200 });
  }
}
