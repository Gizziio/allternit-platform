import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  const agents = await prisma.agent.findMany({
    where: {
      userId,
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    agents: agents.map((a) => ({
      ...a,
      capabilities: a.capabilities ? (JSON.parse(a.capabilities) as string[]) : [],
    })),
  });
}
