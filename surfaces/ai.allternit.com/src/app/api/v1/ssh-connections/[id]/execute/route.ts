import { NextRequest, NextResponse } from 'next/server';
import type { NodeSSH } from 'node-ssh';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function loadConnection(id: string, authUserId: string) {
  const userId = await resolvePlatformUserId(authUserId);
  return prisma.sshConnection.findFirst({
    where: { id, userId },
  });
}

async function connectToSsh(connection: NonNullable<Awaited<ReturnType<typeof loadConnection>>>) {
  let privateKey: string | undefined;
  let password: string | undefined;

  if (connection.authType === 'key' && connection.encryptedPrivateKey) {
    privateKey = decrypt(connection.encryptedPrivateKey);
  } else if (connection.authType === 'password' && connection.encryptedPassword) {
    password = decrypt(connection.encryptedPassword);
  }

  if (!privateKey && !password) {
    throw new Error('No valid SSH credentials found');
  }

  const { NodeSSH } = await import('node-ssh');
  const ssh = new NodeSSH();
  await ssh.connect({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    privateKey,
    password,
    readyTimeout: 20000,
  });
  return ssh;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  let ssh: NodeSSH | null = null;

  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const command = typeof body?.command === 'string' ? body.command.trim() : '';
    if (!command) {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }

    const connection = await loadConnection(id, authUserId);
    if (!connection) {
      return NextResponse.json({ error: 'SSH connection not found' }, { status: 404 });
    }

    ssh = await connectToSsh(connection);
    const result = await ssh.execCommand(command, {
      execOptions: { pty: true },
    });

    await prisma.sshConnection.update({
      where: { id: connection.id },
      data: {
        status: 'connected',
        lastConnectedAt: new Date(),
      },
    });

    return NextResponse.json({
      exitCode: result.code ?? 0,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    console.error('[SSH Execute] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute SSH command' },
      { status: 500 },
    );
  } finally {
    ssh?.dispose();
  }
}
