import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: { select: { userId: true, agentId: true, role: true } },
      _count: { select: { boardItems: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';

  const workspace = await prisma.workspace.create({
    data: { name, slug, ownerId: userId },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
