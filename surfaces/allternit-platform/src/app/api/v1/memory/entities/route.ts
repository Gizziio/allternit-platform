import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const type = searchParams.get('type');
  const query = searchParams.get('q');

  try {
    const entities = await prisma.memoryEntity.findMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
        ...(type ? { type } : {}),
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { lastUpdated: 'desc' },
      take: 200,
    });

    return NextResponse.json(entities.map(e => ({
      id: e.id,
      entityId: e.entityId,
      name: e.name,
      type: e.type,
      lastUpdated: e.lastUpdated.toISOString(),
      propertyCount: e.propertyCount,
      content: e.content,
      vectorId: e.vectorId,
    })));
  } catch (error) {
    console.error('[Memory Entities] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const entity = await prisma.memoryEntity.create({
      data: {
        userId,
        agentId: body.agentId,
        entityId: body.entityId || `ent_${Date.now()}`,
        name: body.name,
        type: body.type || 'General',
        content: body.content,
        propertyCount: body.properties?.length || 0,
        vectorId: body.vectorId,
      },
    });

    return NextResponse.json({ success: true, entity: {
      id: entity.id,
      entityId: entity.entityId,
      name: entity.name,
      type: entity.type,
      lastUpdated: entity.lastUpdated.toISOString(),
    }}, { status: 201 });
  } catch (error) {
    console.error('[Memory Entities] Create error:', error);
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
  }
}
