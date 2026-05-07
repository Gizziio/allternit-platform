import { NextRequest, NextResponse } from 'next/server';
import { deleteArtifact, getArtifact, updateArtifact, type ArtifactStatus, type ArtifactType } from '@/lib/artifacts/server-store';
import { getAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

function isArtifactStatus(value: string): value is ArtifactStatus {
  return ['draft', 'active', 'final', 'archived'].includes(value);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const artifact = await getArtifact(userId, id);
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  return NextResponse.json({ artifact });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const artifact = await updateArtifact(userId, id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    type: typeof body.type === 'string' ? (body.type as ArtifactType) : undefined,
    status: typeof body.status === 'string' && isArtifactStatus(body.status) ? body.status : undefined,
    summary:
      body.summary === null ? null : typeof body.summary === 'string' ? body.summary : undefined,
    tags: body.tags,
  });

  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  return NextResponse.json({ artifact });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteArtifact(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
