import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const skill = await prisma.teamSkill.findUnique({ where: { id } });
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: skill.workspaceId, userId },
  });
  if (!member) return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });

  return NextResponse.json({ skill });
}

export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const skill = await prisma.teamSkill.findUnique({ where: { id } });
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: skill.workspaceId, userId, role: { in: ['owner', 'admin'] } },
  });
  if (!member) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await prisma.teamSkill.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' && { name: body.name }),
      ...(typeof body.description === 'string' && { description: body.description }),
      ...(typeof body.version === 'string' && { version: body.version }),
    },
  });

  return NextResponse.json({ skill: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const skill = await prisma.teamSkill.findUnique({ where: { id } });
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: skill.workspaceId, userId, role: { in: ['owner', 'admin'] } },
  });
  if (!member) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  await prisma.teamSkill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
