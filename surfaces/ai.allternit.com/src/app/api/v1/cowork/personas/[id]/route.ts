import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCoworkPersonaStore } from '@allternit/cowork-engine';

export const runtime = 'nodejs';

const store = createCoworkPersonaStore(prisma);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const persona = await store.get(id);
    if (!persona) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ persona });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { name?: string; description?: string; systemPrompt?: string; tools?: string[]; isDefault?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const persona = await store.update(id, body);
    return NextResponse.json({ persona });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await store.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
