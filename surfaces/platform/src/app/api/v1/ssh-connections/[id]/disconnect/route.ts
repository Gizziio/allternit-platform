/**
 * SSH Connections API - Disconnect from SSH Server
 * 
 * POST /api/v1/ssh-connections/:id/disconnect - Close SSH connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';
import { upsertRuntimeBackendTargetFromConnection } from '@/lib/runtime-backend';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/ssh-connections/:id/disconnect
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const { id } = await params;

    // Check ownership
    const existing = await prisma.sshConnection.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'SSH connection not found' },
        { status: 404 }
      );
    }

    // Update status to disconnected
    const updated = await prisma.sshConnection.update({
      where: { id },
      data: {
        status: 'disconnected',
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
        allternitInstalled: true,
        allternitVersion: true,
        lastConnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await upsertRuntimeBackendTargetFromConnection({
      userId,
      sshConnectionId: updated.id,
      name: updated.name,
      host: updated.host,
      connectionStatus: updated.status,
      allternitInstalled: updated.allternitInstalled ?? false,
      allternitVersion: updated.allternitVersion,
      lastError: null,
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Preserve the local disconnect even if Clerk metadata sync is unavailable.
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
      a2r_installed: updated.allternitInstalled,
      a2r_version: updated.allternitVersion,
      last_connected: updated.lastConnectedAt?.toISOString(),
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to disconnect:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
