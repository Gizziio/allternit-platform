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
    include: { members: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ members: workspace.members });
}

export async function POST(request: NextRequest, { params }: Params) {
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

  const userId = typeof body.userId === 'string' ? body.userId : null;
  const agentId = typeof body.agentId === 'string' ? body.agentId : null;
  const role = typeof body.role === 'string' ? body.role : 'member';

  if (!userId && !agentId) {
    return NextResponse.json({ error: 'userId or agentId required' }, { status: 400 });
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: id,
      userId,
      agentId,
      role,
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
