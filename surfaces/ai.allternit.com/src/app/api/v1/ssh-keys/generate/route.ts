import { NextRequest, NextResponse } from 'next/server';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'crypto';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';

function fingerprintPublicKey(publicKey: string): string {
  const hash = createHash('md5').update(publicKey.trim()).digest('hex');
  return hash.match(/.{2}/g)?.join(':') ?? hash;
}

function generateKeyPair(
  type: 'rsa' | 'ed25519' | 'ecdsa',
  bits?: number,
): { publicKey: string; privateKey: string } {
  if (type === 'rsa') {
    return generateKeyPairSync('rsa', {
      modulusLength: bits && bits >= 2048 ? bits : 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  if (type === 'ecdsa') {
    return generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await resolvePlatformUserId(authUserId);
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const keyType =
      body?.type === 'rsa' || body?.type === 'ecdsa' || body?.type === 'ed25519'
        ? body.type
        : 'ed25519';
    const bits = typeof body?.bits === 'number' ? body.bits : undefined;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const pair = generateKeyPair(keyType, bits);
    const fingerprint = fingerprintPublicKey(pair.publicKey);

    const key = await prisma.sshKey.create({
      data: {
        userId,
        name,
        publicKey: pair.publicKey,
        privateKey: pair.privateKey,
        passphrase: null,
        keyType,
        bits: keyType === 'ed25519' ? 256 : bits ?? (keyType === 'rsa' ? 4096 : 256),
        fingerprint,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        id: key.id,
        name: key.name,
        public_key: pair.publicKey,
        private_key: pair.privateKey,
        fingerprint,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[SSH Keys] Generate error:', error);
    return NextResponse.json({ error: 'Failed to generate SSH key' }, { status: 500 });
  }
}
