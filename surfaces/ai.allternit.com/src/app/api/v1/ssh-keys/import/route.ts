import { NextRequest, NextResponse } from 'next/server';
import { createHash, createPrivateKey, createPublicKey } from 'crypto';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';

function fingerprintPublicKey(publicKey: string): string {
  const hash = createHash('md5').update(publicKey.trim()).digest('hex');
  return hash.match(/.{2}/g)?.join(':') ?? hash;
}

function inferKeyMetadata(privateKeyPem: string, passphrase?: string): {
  publicKey: string;
  keyType: 'rsa' | 'ed25519' | 'ecdsa';
  bits: number;
} {
  const privateKey = createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    passphrase,
  });
  const publicKey = createPublicKey(privateKey).export({
    type: 'spki',
    format: 'pem',
  }) as string;

  switch (privateKey.asymmetricKeyType) {
    case 'rsa': {
      const details = privateKey.asymmetricKeyDetails;
      return {
        publicKey,
        keyType: 'rsa',
        bits: details?.modulusLength ?? 4096,
      };
    }
    case 'ec':
      return { publicKey, keyType: 'ecdsa', bits: 256 };
    default:
      return { publicKey, keyType: 'ed25519', bits: 256 };
  }
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
    const privateKey = typeof body?.private_key === 'string' ? body.private_key.trim() : '';
    const passphrase = typeof body?.passphrase === 'string' ? body.passphrase : undefined;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!privateKey) {
      return NextResponse.json({ error: 'private_key is required' }, { status: 400 });
    }

    const metadata = inferKeyMetadata(privateKey, passphrase);
    const fingerprint = fingerprintPublicKey(metadata.publicKey);

    const key = await prisma.sshKey.create({
      data: {
        userId,
        name,
        publicKey: metadata.publicKey,
        privateKey,
        passphrase: passphrase ?? null,
        keyType: metadata.keyType,
        bits: metadata.bits,
        fingerprint,
      },
      select: {
        id: true,
        name: true,
        fingerprint: true,
        publicKey: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        id: key.id,
        name: key.name,
        fingerprint: key.fingerprint,
        publicKey: key.publicKey,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[SSH Keys] Import error:', error);
    return NextResponse.json({ error: 'Failed to import SSH key' }, { status: 500 });
  }
}
