import { NextRequest, NextResponse } from 'next/server';
import { addArtifactSection, getArtifact } from '@/lib/artifacts/server-store';
import { getAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const artifact = await getArtifact(userId, id);
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  return NextResponse.json({ sections: artifact.sections });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const heading = typeof body.heading === 'string' ? body.heading.trim() : '';
  if (!heading) return NextResponse.json({ error: 'heading is required' }, { status: 400 });

  const section = await addArtifactSection(userId, id, {
    heading,
    kind: typeof body.kind === 'string' ? (body.kind as any) : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
    position: typeof body.position === 'number' ? body.position : undefined,
  });
  if (!section) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  return NextResponse.json({ section }, { status: 201 });
}
