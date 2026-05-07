import { NextResponse } from 'next/server';
import { createResearchThread, deleteResearchThread, getResearchThreadMessages } from '@/lib/cowork/research-client';

export async function POST() {
  try {
    const threadId = await createResearchThread();
    return NextResponse.json({ threadId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });

  try {
    const messages = await getResearchThreadMessages(threadId);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });

  try {
    await deleteResearchThread(threadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
