import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const type = searchParams.get('type');

  try {
    const events = await prisma.memoryEvent.findMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json(events.map(e => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      type: e.type,
      payload: e.payload,
      agentId: e.agentId,
      source: e.source,
    })));
  } catch (error) {
    console.error('[Memory Events] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch memory events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const event = await prisma.memoryEvent.create({
      data: {
        userId,
        agentId: body.agentId,
        type: body.type,
        payload: body.payload,
        source: body.source || 'user',
      },
    });

    return NextResponse.json({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      type: event.type,
      payload: event.payload,
    }, { status: 201 });
  } catch (error) {
    console.error('[Memory Events] Create error:', error);
    return NextResponse.json({ error: 'Failed to create memory event' }, { status: 500 });
  }
}
