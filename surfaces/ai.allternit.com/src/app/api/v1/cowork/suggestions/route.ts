import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);

  try {
    const where = userId ? { userId } : {};
    const suggestions = await prisma.coworkSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: { content?: string; source?: string; userId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  try {
    const suggestion = await prisma.coworkSuggestion.create({
      data: {
        content: body.content,
        source: body.source ?? 'system',
        userId: body.userId ?? null,
      },
    });
    return NextResponse.json({ suggestion }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: true, queued: true }, { status: 202 });
  }
}
