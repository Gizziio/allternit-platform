import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId } } },
      ],
    },
    include: {
      members: true,
      invitations: true,
      _count: { select: { boardItems: true, skills: true } },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: { in: ['owner', 'admin'] } } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found or insufficient permissions' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.description === 'string') updates.description = body.description;

  const updated = await prisma.workspace.update({
    where: { id },
    data: updates,
    include: { members: true },
  });

  return NextResponse.json({ workspace: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: 'owner' } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found or insufficient permissions' }, { status: 404 });
  }

  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
