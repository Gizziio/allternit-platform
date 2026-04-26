import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const items = await prisma.boardItem.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!workspaceId || !title) {
    return NextResponse.json({ error: 'workspaceId and title required' }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
  }

  const item = await prisma.boardItem.create({
    data: {
      workspaceId,
      title,
      description: typeof body.description === 'string' ? body.description : null,
      status: typeof body.status === 'string' ? body.status : 'backlog',
      priority: typeof body.priority === 'number' ? body.priority : 0,
      labels: Array.isArray(body.labels) ? JSON.stringify(body.labels) : null,
      estimatedMinutes: typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : null,
      deadline: typeof body.deadline === 'string' ? new Date(body.deadline) : null,
      dependencies: Array.isArray(body.dependencies) ? JSON.stringify(body.dependencies) : null,
      reporterId: authUserId,
    },
    include: { comments: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
