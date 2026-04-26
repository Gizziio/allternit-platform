import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

type Params = { params: Promise<{ id: string }> };

async function getWorkspaceForUser(id: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      id,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workspace = await getWorkspaceForUser(id, userId);
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const full = await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: true,
      boardItems: { orderBy: { updatedAt: 'desc' }, take: 20 },
    },
  });

  return NextResponse.json({ workspace: full });
}

export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workspace = await getWorkspaceForUser(id, userId);
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await prisma.workspace.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' && { name: body.name }),
    },
  });

  return NextResponse.json({ workspace: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workspace = await prisma.workspace.findFirst({
    where: { id, ownerId: userId },
  });
  if (!workspace) return NextResponse.json({ error: 'Not found or not owner' }, { status: 404 });

  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
