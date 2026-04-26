import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (status) where.status = status;

  const runtimes = await prisma.agentRuntime.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { workspace: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ runtimes });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const host = typeof body.host === 'string' ? body.host.trim() : '';

  if (!name || !host) {
    return NextResponse.json({ error: 'name and host required' }, { status: 400 });
  }

  const runtime = await prisma.agentRuntime.create({
    data: {
      name,
      host,
      status: typeof body.status === 'string' ? body.status : 'offline',
      agentClis: Array.isArray(body.agentClis) ? JSON.stringify(body.agentClis) : null,
      workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : null,
    },
  });

  return NextResponse.json({ runtime }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.host === 'string') data.host = body.host.trim();
  if (typeof body.status === 'string') data.status = body.status;
  if (typeof body.agentClis === 'string') data.agentClis = body.agentClis;
  if (body.agentClis === null) data.agentClis = null;
  if (typeof body.workspaceId === 'string') data.workspaceId = body.workspaceId;
  if (body.workspaceId === null) data.workspaceId = null;
  if (typeof body.lastHeartbeat === 'string') data.lastHeartbeat = new Date(body.lastHeartbeat);

  const runtime = await prisma.agentRuntime.update({
    where: { id },
    data,
  });

  return NextResponse.json({ runtime });
}

export async function DELETE(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.agentRuntime.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
