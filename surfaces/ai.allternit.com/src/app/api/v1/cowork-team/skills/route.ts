import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });

  const skills = await prisma.teamSkill.findMany({
    where: { workspaceId },
    orderBy: { installedAt: 'desc' },
  });

  return NextResponse.json({ skills });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!workspaceId || !name) {
    return NextResponse.json({ error: 'workspaceId and name required' }, { status: 400 });
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, role: { in: ['owner', 'admin'] } },
  });
  if (!member) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const manifest =
    body.manifest && typeof body.manifest === 'object' && body.manifest !== null
      ? JSON.stringify(body.manifest)
      : null;

  const skill = await prisma.teamSkill.create({
    data: {
      workspaceId,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      manifest,
      sourceRepo: typeof body.sourceRepo === 'string' ? body.sourceRepo : null,
      version: typeof body.version === 'string' ? body.version : '0.0.1',
      installedBy: userId,
    },
  });

  return NextResponse.json({ skill }, { status: 201 });
}
