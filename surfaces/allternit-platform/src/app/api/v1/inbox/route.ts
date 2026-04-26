import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const items = await prisma.inboxItem.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.inboxItem.count({
      where: { userId, status: 'unread' },
    });

    return NextResponse.json({
      items: items.map(i => ({
        id: i.id,
        agentId: i.agentId,
        type: i.type,
        title: i.title,
        body: i.body,
        severity: i.severity,
        status: i.status,
        actionUrl: i.actionUrl,
        metadata: i.metadata ? JSON.parse(i.metadata) : null,
        createdAt: i.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('[Inbox] Error:', error);
    return NextResponse.json({ items: [], unreadCount: 0 });
  }
}

export async function PATCH(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { itemId, status } = body;

    await prisma.inboxItem.updateMany({
      where: { id: itemId, userId },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update inbox item' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const item = await prisma.inboxItem.create({
      data: {
        userId,
        agentId: body.agentId,
        type: body.type,
        title: body.title,
        body: body.body,
        severity: body.severity || 'info',
        status: 'unread',
        actionUrl: body.actionUrl,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return NextResponse.json({ success: true, id: item.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create inbox item' }, { status: 500 });
  }
}
