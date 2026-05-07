import { NextRequest, NextResponse } from 'next/server';
import { deleteArtifactSection, updateArtifactSection } from '@/lib/artifacts/server-store';
import { getAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, sectionId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const section = await updateArtifactSection(userId, id, sectionId, {
    heading: typeof body.heading === 'string' ? body.heading : undefined,
    kind: typeof body.kind === 'string' ? (body.kind as any) : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
    position: typeof body.position === 'number' ? body.position : undefined,
  });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  return NextResponse.json({ section });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, sectionId } = await context.params;
  const deleted = await deleteArtifactSection(userId, id, sectionId);
  if (!deleted) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
