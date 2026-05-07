import { NextRequest, NextResponse } from 'next/server';
import {
  createArtifact,
  listArtifacts,
  type ArtifactStatus,
  type ArtifactType,
} from '@/lib/artifacts/server-store';
import { getAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

function isArtifactStatus(value: string): value is ArtifactStatus {
  return ['draft', 'active', 'final', 'archived'].includes(value);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const statusParam = searchParams.get('status');
  const typeParam = searchParams.get('type');
  const q = searchParams.get('q');

  const artifacts = await listArtifacts(userId, {
    workspaceId,
    status: statusParam && isArtifactStatus(statusParam) ? statusParam : null,
    type: (typeParam as ArtifactType | null) || null,
    q,
  });

  return NextResponse.json({ artifacts });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!workspaceId || !title) {
    return NextResponse.json({ error: 'workspaceId and title are required' }, { status: 400 });
  }

  const artifact = await createArtifact(userId, {
    workspaceId,
    title,
    type: typeof body.type === 'string' ? (body.type as ArtifactType) : undefined,
    status: typeof body.status === 'string' && isArtifactStatus(body.status) ? body.status : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    tags: body.tags,
    sections: Array.isArray(body.sections)
      ? body.sections.map((section) => (typeof section === 'object' && section ? section : {}))
      : undefined,
  });

  return NextResponse.json({ artifact }, { status: 201 });
}
