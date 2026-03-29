/**
 * SSH Connections API - Connect to SSH Server
 * 
 * POST /api/v1/ssh-connections/:id/connect - Establish SSH connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { NodeSSH } from 'node-ssh';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';
import { gatherSSHSystemInfo } from '@/lib/ssh-system-info';
import { upsertRuntimeBackendTargetFromConnection } from '@/lib/runtime-backend';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/ssh-connections/:id/connect
export async function POST(request: NextRequest, { params }: RouteParams) {
  let authUserId: string | null = null;

  try {
    const auth = await getAuth();
    authUserId = auth.userId;
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const { id } = await params;

    // Get connection from database
    const connection = await prisma.sshConnection.findFirst({
      where: { id, userId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'SSH connection not found' },
        { status: 404 }
      );
    }

    // Decrypt credentials
    let privateKey: string | undefined;
    let password: string | undefined;

    if (connection.authType === 'key' && connection.encryptedPrivateKey) {
      privateKey = decrypt(connection.encryptedPrivateKey);
    } else if (connection.authType === 'password' && connection.encryptedPassword) {
      password = decrypt(connection.encryptedPassword);
    }

    // Build connection config
    const connectConfig: any = {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      readyTimeout: 20000,
    };

    if (privateKey) {
      connectConfig.privateKey = privateKey;
    } else if (password) {
      connectConfig.password = password;
    } else {
      return NextResponse.json(
        { error: 'No valid credentials found' },
        { status: 400 }
      );
    }

    // Attempt connection
    const ssh = new NodeSSH();
    await ssh.connect(connectConfig);

    // Gather system info using the same probe path as the rest of the platform.
    const systemInfo = await gatherSSHSystemInfo(ssh);

    // Close test connection
    ssh.dispose();

    // Update connection status in database
    const updated = await prisma.sshConnection.update({
      where: { id },
      data: {
        status: 'connected',
        os: systemInfo.os,
        architecture: systemInfo.architecture,
        dockerInstalled: systemInfo.dockerInstalled,
        a2rInstalled: systemInfo.a2rInstalled,
        a2rVersion: systemInfo.a2rVersion ?? null,
        lastConnectedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        status: true,
        os: true,
        architecture: true,
        dockerInstalled: true,
        a2rInstalled: true,
        a2rVersion: true,
        lastConnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const backendTarget = await upsertRuntimeBackendTargetFromConnection({
      userId,
      sshConnectionId: updated.id,
      name: updated.name,
      host: updated.host,
      connectionStatus: updated.status,
      a2rInstalled: updated.a2rInstalled ?? false,
      a2rVersion: updated.a2rVersion,
      markVerified: true,
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Preserve the successful local connection even if Clerk metadata sync is unavailable.
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      host: updated.host,
      port: updated.port,
      username: updated.username,
      status: updated.status,
      os: updated.os,
      architecture: updated.architecture,
      docker_installed: updated.dockerInstalled,
      a2r_installed: updated.a2rInstalled,
      a2r_version: updated.a2rVersion,
      backend_target_id: backendTarget.id,
      last_connected: updated.lastConnectedAt?.toISOString(),
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('SSH connection failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';

    // Update status to error
    const { id } = await params;
    const updated = await prisma.sshConnection.update({
      where: { id },
      data: {
        status: 'error',
      },
      select: {
        id: true,
        userId: true,
        name: true,
        host: true,
        status: true,
        a2rInstalled: true,
        a2rVersion: true,
      },
    });

    await upsertRuntimeBackendTargetFromConnection({
      userId: updated.userId,
      sshConnectionId: updated.id,
      name: updated.name,
      host: updated.host,
      connectionStatus: updated.status,
      a2rInstalled: updated.a2rInstalled ?? false,
      a2rVersion: updated.a2rVersion,
      lastError: errorMessage,
    }).catch(() => {
      // Best effort status propagation for inventory sync.
    });
    if (authUserId) {
      await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
        // Preserve the local failure state even if Clerk metadata sync is unavailable.
      });
    }

    return NextResponse.json({
      id,
      status: 'error',
      error_message: errorMessage,
    }, { status: 200 });
  }
}
