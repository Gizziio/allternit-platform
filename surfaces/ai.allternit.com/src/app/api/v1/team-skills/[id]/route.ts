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
  const skill = await prisma.teamSkill.findFirst({ where: { id } });

  if (!skill) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ skill });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const skill = await prisma.teamSkill.findFirst({ where: { id } });
  if (!skill) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: skill.workspaceId,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: { in: ['owner', 'admin'] } } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  await prisma.teamSkill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
