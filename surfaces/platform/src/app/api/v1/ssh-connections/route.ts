/**
 * SSH Connections API - Main Routes
 * 
 * GET /api/v1/ssh-connections - List all connections
 * POST /api/v1/ssh-connections - Create a new connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { sshService } from '@/services/ssh/SSHService';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { hydrateRuntimeBackendPreferenceFromClerk, syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';

// GET /api/v1/ssh-connections
export async function GET() {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await hydrateRuntimeBackendPreferenceFromClerk(authUserId).catch(() => {
      // Fall back to local inventory if Clerk metadata is unavailable.
    });
    const userId = await resolvePlatformUserId(authUserId);

    const connections = await prisma.sshConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
        a2rInstalled: true,
        a2rVersion: true,
        lastConnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      status: conn.status,
      os: conn.os,
      architecture: conn.architecture,
      docker_installed: conn.dockerInstalled,
      a2r_installed: conn.a2rInstalled,
      a2r_version: conn.a2rVersion,
      last_connected: conn.lastConnectedAt?.toISOString(),
      created_at: conn.createdAt.toISOString(),
      updated_at: conn.updatedAt.toISOString(),
    })));
  } catch (error) {
    const databaseUnavailable =
      error instanceof Error &&
      error.message.includes("Can't reach database server");

    console.error('Failed to list SSH connections:', error);
    return NextResponse.json(
      {
        error: databaseUnavailable
          ? 'SSH connections are unavailable because the local database is offline.'
          : 'Failed to list SSH connections',
      },
      { status: databaseUnavailable ? 503 : 500 }
    );
  }
}

// POST /api/v1/ssh-connections
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const body = await request.json();
    const { name, host, port, username, auth_type, private_key, password } = body;

    // Validate required fields
    if (!name || !host || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: name, host, username' },
        { status: 400 }
      );
    }

    // Validate auth credentials
    if (auth_type === 'key' && !private_key) {
      return NextResponse.json(
        { error: 'Private key is required for key-based authentication' },
        { status: 400 }
      );
    }
    if (auth_type === 'password' && !password) {
      return NextResponse.json(
        { error: 'Password is required for password-based authentication' },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const encryptedPrivateKey = private_key ? encrypt(private_key) : null;
    const encryptedPassword = password ? encrypt(password) : null;

    // Create in database
    const connection = await prisma.sshConnection.create({
      data: {
        userId,
        name,
        host,
        port: port || 22,
        username,
        authType: auth_type,
        encryptedPrivateKey,
        encryptedPassword,
        status: 'disconnected',
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // A newly created connection may not yet have a backend target; ignore sync failures.
    });

    return NextResponse.json({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      status: connection.status,
      created_at: connection.createdAt.toISOString(),
      updated_at: connection.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create SSH connection:', error);
    return NextResponse.json(
      { error: 'Failed to create SSH connection' },
      { status: 500 }
    );
  }
}
