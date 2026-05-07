import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';
import { createHash } from 'crypto';

function fingerprintPublicKey(publicKey: string): string {
  const hash = createHash('md5').update(publicKey.trim()).digest('hex');
  return hash.match(/.{2}/g)?.join(':') ?? hash;
}

// GET /api/v1/ssh-keys - List all SSH keys
export async function GET() {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const keys = await prisma.sshKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json(keys);
  } catch (error) {
    console.error('[SSH Keys] List error:', error);
    return NextResponse.json({ error: 'Failed to list SSH keys' }, { status: 500 });
  }
}

// POST /api/v1/ssh-keys - Create a new SSH key
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const body = await request.json();
    const { name, publicKey, privateKey, passphrase, keyType = 'ed25519', bits = 256 } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const key = await prisma.sshKey.create({
      data: {
        userId,
        name,
        publicKey: publicKey ?? '',
        privateKey: privateKey ?? null,
        passphrase: passphrase ?? null,
        keyType,
        bits: typeof bits === 'number' ? bits : 256,
        fingerprint: publicKey ? fingerprintPublicKey(publicKey) : '',
      },
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

    return NextResponse.json(key, { status: 201 });
  } catch (error) {
    console.error('[SSH Keys] Create error:', error);
    return NextResponse.json({ error: 'Failed to create SSH key' }, { status: 500 });
  }
}
