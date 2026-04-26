import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

// In production, use actual Ed25519 from @noble/ed25519 or similar
function generateMockKeypair(): { publicKey: string; privateKey: string } {
  const pub = 'pk_' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const priv = 'sk_' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { publicKey: pub, privateKey: priv };
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { agentId } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate identity keypair
    const keys = generateMockKeypair();

    await prisma.agent.update({
      where: { id: agentId },
      data: { identityKey: keys.publicKey },
    });

    return NextResponse.json({
      success: true,
      agentId,
      publicKey: keys.publicKey,
      // NOTE: private key should be stored securely (HSM, vault) in production
      // This is returned once for demonstration; in production, never return private keys
      privateKey: keys.privateKey,
    });
  } catch (error) {
    console.error('[Agent Identity] Error:', error);
    return NextResponse.json({ error: 'Failed to generate identity' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  try {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId || '', userId },
      select: { id: true, name: true, identityKey: true },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      hasIdentity: !!agent.identityKey,
      publicKey: agent.identityKey,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch identity' }, { status: 500 });
  }
}
