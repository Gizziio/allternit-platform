import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: id },
    orderBy: { joinedAt: 'asc' },
  });

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workspace = await prisma.workspace.findFirst({
    where: { id, ownerId: userId },
  });
  if (!workspace) return NextResponse.json({ error: 'Not found or not owner' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const role = ['owner', 'admin', 'member', 'agent'].includes(body.role as string)
    ? (body.role as string)
    : 'member';

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: id,
      userId: typeof body.userId === 'string' ? body.userId : null,
      agentId: typeof body.agentId === 'string' ? body.agentId : null,
      role,
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
