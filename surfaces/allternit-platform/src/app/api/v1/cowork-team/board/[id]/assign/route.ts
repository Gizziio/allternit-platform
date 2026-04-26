import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const assigneeType = body.assigneeType === 'agent' ? 'agent' : 'human';
  const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId : null;

  if (!assigneeId) return NextResponse.json({ error: 'assigneeId required' }, { status: 400 });

  const { id } = await params;
  const item = await prisma.boardItem.update({
    where: { id },
    data: { assigneeType, assigneeId },
  });

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const item = await prisma.boardItem.update({
    where: { id },
    data: { assigneeType: null, assigneeId: null },
  });

  return NextResponse.json({ item });
}
