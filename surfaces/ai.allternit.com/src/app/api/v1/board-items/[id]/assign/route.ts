import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const assigneeType = body.assigneeType === 'agent' ? 'agent' : 'human';
  const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId : null;

  const existing = await prisma.boardItem.findFirst({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const item = await prisma.boardItem.update({
    where: { id },
    data: {
      assigneeType,
      assigneeId,
    },
    include: { comments: true },
  });

  return NextResponse.json({ item });
}
