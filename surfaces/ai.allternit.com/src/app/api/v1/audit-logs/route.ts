import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.taskAuditLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.taskAuditLog.count({ where: { taskId } }),
  ]);

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const taskId = typeof body.taskId === 'string' ? body.taskId : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!taskId || !action) {
    return NextResponse.json({ error: 'taskId and action required' }, { status: 400 });
  }

  const log = await prisma.taskAuditLog.create({
    data: {
      taskId,
      action,
      actorType: body.actorType === 'agent' || body.actorType === 'system' ? body.actorType : 'human',
      actorId: typeof body.actorId === 'string' ? body.actorId : authUserId,
      payload: typeof body.payload === 'object' ? JSON.stringify(body.payload) : null,
    },
  });

  return NextResponse.json({ log }, { status: 201 });
}
