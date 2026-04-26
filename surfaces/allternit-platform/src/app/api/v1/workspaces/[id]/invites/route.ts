import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import crypto from 'crypto';

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

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: { in: ['owner', 'admin'] } } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found or insufficient permissions' }, { status: 404 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const role = typeof body.role === 'string' ? body.role : 'member';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: id,
      email,
      role,
      token,
      expiresAt,
    },
  });

  return NextResponse.json({ invitation }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get('id');

  if (!inviteId) {
    return NextResponse.json({ error: 'Invitation id required' }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId, role: { in: ['owner', 'admin'] } } } },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found or insufficient permissions' }, { status: 404 });
  }

  await prisma.workspaceInvitation.deleteMany({
    where: { id: inviteId, workspaceId: id },
  });

  return NextResponse.json({ success: true });
}
