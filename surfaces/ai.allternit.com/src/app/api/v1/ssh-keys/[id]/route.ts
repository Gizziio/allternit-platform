import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';
import { createHash } from 'crypto';

function fingerprintPublicKey(publicKey: string): string {
  const hash = createHash('md5').update(publicKey.trim()).digest('hex');
  return hash.match(/.{2}/g)?.join(':') ?? hash;
}

async function getUserId() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) return null;
  return resolvePlatformUserId(authUserId);
}

// GET /api/v1/ssh-keys/:id - Get a single SSH key
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const key = await prisma.sshKey.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        fingerprint: true,
        publicKey: true,
        keyType: true,
        bits: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!key) {
      return NextResponse.json({ error: 'SSH key not found' }, { status: 404 });
    }

    return NextResponse.json(key);
  } catch (error) {
    console.error('[SSH Keys] Get error:', error);
    return NextResponse.json({ error: 'Failed to get SSH key' }, { status: 500 });
  }
}

// PUT /api/v1/ssh-keys/:id - Update an SSH key
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const body = await request.json();
    const { name, publicKey } = body;

    const existing = await prisma.sshKey.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'SSH key not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (publicKey !== undefined) {
      updateData.publicKey = publicKey;
      updateData.fingerprint = fingerprintPublicKey(publicKey);
    }

    const key = await prisma.sshKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        fingerprint: true,
        publicKey: true,
        keyType: true,
        bits: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(key);
  } catch (error) {
    console.error('[SSH Keys] Update error:', error);
    return NextResponse.json({ error: 'Failed to update SSH key' }, { status: 500 });
  }
}

// DELETE /api/v1/ssh-keys/:id - Delete an SSH key
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const existing = await prisma.sshKey.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'SSH key not found' }, { status: 404 });
    }

    await prisma.sshKey.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SSH Keys] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete SSH key' }, { status: 500 });
  }
}
