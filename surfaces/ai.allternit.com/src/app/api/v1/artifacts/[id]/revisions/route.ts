import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { listArtifactRevisions } from '@/lib/artifacts/server-store';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const revisions = await listArtifactRevisions(userId, id);
  return NextResponse.json({ revisions });
}
