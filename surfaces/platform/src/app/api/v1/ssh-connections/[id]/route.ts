/**
 * SSH Connections API - Single Connection Routes
 * 
 * GET /api/v1/ssh-connections/:id - Get connection details
 * PUT /api/v1/ssh-connections/:id - Update connection
 * DELETE /api/v1/ssh-connections/:id - Delete connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { hydrateRuntimeBackendPreferenceFromClerk, syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/ssh-connections/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await hydrateRuntimeBackendPreferenceFromClerk(authUserId).catch(() => {
      // Fall back to local inventory if Clerk metadata is unavailable.
    });
    const userId = await resolvePlatformUserId(authUserId);

    const { id } = await params;

    const connection = await prisma.sshConnection.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
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

    if (!connection) {
      return NextResponse.json(
        { error: 'SSH connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      status: connection.status,
      os: connection.os,
      architecture: connection.architecture,
      docker_installed: connection.dockerInstalled,
      allternit_installed: connection.allternitInstalled,
      allternit_version: connection.allternitVersion,
      last_connected: connection.lastConnectedAt?.toISOString(),
      created_at: connection.createdAt.toISOString(),
      updated_at: connection.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to get SSH connection:', error);
    return NextResponse.json(
      { error: 'Failed to get SSH connection' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/ssh-connections/:id
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const { id } = await params;
    const body = await request.json();

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

    // Build update data
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.host !== undefined) updateData.host = body.host;
    if (body.port !== undefined) updateData.port = body.port;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.auth_type !== undefined) updateData.authType = body.auth_type;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.os !== undefined) updateData.os = body.os;
    if (body.architecture !== undefined) updateData.architecture = body.architecture;
    if (body.docker_installed !== undefined) updateData.dockerInstalled = body.docker_installed;
    if (body.allternit_installed !== undefined) updateData.allternitInstalled = body.allternit_installed;
    if (body.allternit_version !== undefined) updateData.allternitVersion = body.allternit_version;
    if (body.last_connected !== undefined) updateData.lastConnectedAt = new Date(body.last_connected);

    // Handle credential updates
    if (body.private_key !== undefined && body.auth_type === 'key') {
      updateData.encryptedPrivateKey = encrypt(body.private_key);
      updateData.encryptedPassword = null;
    } else if (body.password !== undefined && body.auth_type === 'password') {
      updateData.encryptedPassword = encrypt(body.password);
      updateData.encryptedPrivateKey = null;
    }

    updateData.updatedAt = new Date();

    const connection = await prisma.sshConnection.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
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

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Preserve the local update even if Clerk metadata sync is unavailable.
    });

    return NextResponse.json({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      status: connection.status,
      os: connection.os,
      architecture: connection.architecture,
      docker_installed: connection.dockerInstalled,
      allternit_installed: connection.allternitInstalled,
      allternit_version: connection.allternitVersion,
      last_connected: connection.lastConnectedAt?.toISOString(),
      created_at: connection.createdAt.toISOString(),
      updated_at: connection.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to update SSH connection:', error);
    return NextResponse.json(
      { error: 'Failed to update SSH connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/ssh-connections/:id
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await prisma.sshConnection.delete({
      where: { id },
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Preserve the local deletion even if Clerk metadata sync is unavailable.
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete SSH connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete SSH connection' },
      { status: 500 }
    );
  }
}
