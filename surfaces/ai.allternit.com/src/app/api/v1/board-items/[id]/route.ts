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

  const item = await prisma.boardItem.findFirst({
    where: { id },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  });

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.boardItem.findFirst({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description;
  if (typeof body.status === 'string') updates.status = body.status;
  if (typeof body.priority === 'number') updates.priority = body.priority;
  if (Array.isArray(body.labels)) updates.labels = JSON.stringify(body.labels);
  if (typeof body.estimatedMinutes === 'number') updates.estimatedMinutes = body.estimatedMinutes;
  if (typeof body.deadline === 'string') updates.deadline = new Date(body.deadline);
  if (Array.isArray(body.dependencies)) updates.dependencies = JSON.stringify(body.dependencies);

  const item = await prisma.boardItem.update({
    where: { id },
    data: updates,
    include: { comments: true },
  });

  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.boardItem.findFirst({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.boardItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
