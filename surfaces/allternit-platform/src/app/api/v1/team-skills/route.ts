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

  const skills = await prisma.teamSkill.findMany({
    where: { workspaceId },
    orderBy: { installedAt: 'desc' },
  });

  return NextResponse.json({ skills });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!workspaceId || !name) {
    return NextResponse.json({ error: 'workspaceId and name required' }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: { in: ['owner', 'admin'] } } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
  }

  const skill = await prisma.teamSkill.create({
    data: {
      workspaceId,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      manifest: typeof body.manifest === 'object' ? JSON.stringify(body.manifest) : null,
      sourceRepo: typeof body.sourceRepo === 'string' ? body.sourceRepo : null,
      version: typeof body.version === 'string' ? body.version : '0.0.1',
      installedBy: authUserId,
    },
  });

  return NextResponse.json({ skill }, { status: 201 });
}
