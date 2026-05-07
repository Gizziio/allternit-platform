import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { listArtifacts } from '@/lib/artifacts/server-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q?.trim()) return NextResponse.json({ artifacts: [] });
  const workspaceId = searchParams.get('workspaceId');
  const artifacts = await listArtifacts(userId, { q, workspaceId });
  return NextResponse.json({ artifacts });
}
