import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [memories, insights, connections, vectors] = await Promise.all([
      prisma.memoryEvent.count({ where: { userId } }),
      prisma.memoryEntity.count({ where: { userId } }),
      prisma.memoryEdge.count({ where: { userId } }),
      prisma.memoryEntity.count({ where: { userId, vectorId: { not: null } } }),
    ]);

    return NextResponse.json({
      memories: { total: memories },
      insights,
      connections,
      vectors,
    });
  } catch (error) {
    console.error('[Memory Stats] Error:', error);
    return NextResponse.json({
      memories: { total: 0 },
      insights: 0,
      connections: 0,
      vectors: 0,
    });
  }
}
