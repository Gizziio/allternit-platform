import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      members: true,
      _count: { select: { boardItems: true } },
    },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const description = typeof body.description === 'string' ? body.description : undefined;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      description,
      ownerId: authUserId,
      members: {
        create: {
          userId: authUserId,
          role: 'owner',
        },
      },
    },
    include: { members: true },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
