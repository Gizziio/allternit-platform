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

function parsePercent(value: string): number {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let ssh: NodeSSH | null = null;

  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const connection = await loadConnection(id, authUserId);
    if (!connection) {
      return NextResponse.json({ error: 'SSH connection not found' }, { status: 404 });
    }

    ssh = await connectToSsh(connection);

    const [cpuResult, memoryResult, diskResult] = await Promise.all([
      ssh.execCommand(
        "LC_ALL=C top -bn1 | awk '/Cpu\\(s\\)|%Cpu/ {for (i = 1; i <= NF; i++) if ($i ~ /id,?/) {print 100 - $(i-1); exit}}'",
        { execOptions: { pty: true } },
      ),
      ssh.execCommand(
        "free | awk '/Mem:/ {printf(\"%.2f\", $3/$2 * 100)}'",
        { execOptions: { pty: true } },
      ),
      ssh.execCommand(
        "df -P / | awk 'NR==2 {gsub(/%/,\"\", $5); print $5}'",
        { execOptions: { pty: true } },
      ),
    ]);

    await prisma.sshConnection.update({
      where: { id: connection.id },
      data: {
        status: 'connected',
        lastConnectedAt: new Date(),
      },
    });

    return NextResponse.json({
      cpu: parsePercent(cpuResult.stdout),
      memory: parsePercent(memoryResult.stdout),
      disk: parsePercent(diskResult.stdout),
    });
  } catch (error) {
    console.error('[SSH Metrics] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch VPS metrics' },
      { status: 500 },
    );
  } finally {
    ssh?.dispose();
  }
}
