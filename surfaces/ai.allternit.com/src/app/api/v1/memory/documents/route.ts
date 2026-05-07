import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  try {
    const docs = await prisma.memoryDocument.findMany({
      where: { userId, ...(agentId ? { agentId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(docs.map(d => ({
      id: d.id,
      agentId: d.agentId,
      title: d.title,
      sourceType: d.sourceType,
      sourceUrl: d.sourceUrl,
      chunkCount: d.chunkCount,
      isIndexed: d.isIndexed,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const doc = await prisma.memoryDocument.create({
      data: {
        userId,
        agentId: body.agentId,
        title: body.title,
        content: body.content,
        sourceType: body.sourceType || 'upload',
        sourceUrl: body.sourceUrl,
        chunkCount: body.chunkCount || 0,
      },
    });

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      isIndexed: doc.isIndexed,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
