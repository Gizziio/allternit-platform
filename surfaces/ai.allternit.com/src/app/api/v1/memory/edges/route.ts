import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  try {
    const edges = await prisma.memoryEdge.findMany({
      where: {
        userId,
        ...(source ? { source } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json(edges.map(e => ({
      id: e.id,
      source: e.source,
      relationship: e.relationship,
      target: e.target,
      confidence: e.confidence,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('[Memory Edges] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch edges' }, { status: 500 });
  }
}
