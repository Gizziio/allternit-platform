import { NextRequest, NextResponse } from 'next/server';
import { memoryOrchestrator } from '@/lib/cowork/memory-orchestrator';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { createCoworkMemoryStore } from '@allternit/cowork-engine';

export const runtime = 'nodejs';

const store = createCoworkMemoryStore(prisma);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { userId } = await getAuth();
  const projectId = searchParams.get('projectId') ?? undefined;
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);
  const format = searchParams.get('format');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (format === 'context') {
      const context = await memoryOrchestrator.buildContext({ userId, projectId: projectId ?? null, sessionId: sessionId ?? null, maxEntries: limit });
      return NextResponse.json({ context });
    }

    const entries = await store.list({ userId, projectId, sessionId, limit });
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; projectId?: string; sessionId?: string; content?: string; type?: string; tags?: string[]; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const entry = await memoryOrchestrator.remember({
      userId,
      projectId: body.projectId ?? null,
      sessionId: body.sessionId ?? null,
      content: body.content,
      type: (body.type as any) ?? 'context',
      tags: body.tags ?? [],
      source: body.source ?? null,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
