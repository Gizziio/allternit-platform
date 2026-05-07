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

  const comments = await prisma.boardComment.findMany({
    where: { itemId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  const authorType = body.authorType === 'agent' ? 'agent' : 'human';
  const authorId = typeof body.authorId === 'string' ? body.authorId : authUserId;

  if (!bodyText) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const existing = await prisma.boardItem.findFirst({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const comment = await prisma.boardComment.create({
    data: {
      itemId: id,
      authorType,
      authorId,
      body: bodyText,
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
