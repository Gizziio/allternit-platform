import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { createCoworkPersonaStore } from '@allternit/cowork-engine';

export const runtime = 'nodejs';

const store = createCoworkPersonaStore(prisma);

export async function GET(req: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await store.ensureBuiltIns(userId);
    const personas = await store.list(userId);
    return NextResponse.json({ personas });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; name?: string; description?: string; systemPrompt?: string; tools?: string[]; isDefault?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { userId } = await getAuth();
  const { name, systemPrompt } = body;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!name || !systemPrompt) {
    return NextResponse.json({ error: 'name and systemPrompt required' }, { status: 400 });
  }

  try {
    const persona = await store.create({ userId, name, description: body.description, systemPrompt, tools: body.tools, isDefault: body.isDefault });
    return NextResponse.json({ persona }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
