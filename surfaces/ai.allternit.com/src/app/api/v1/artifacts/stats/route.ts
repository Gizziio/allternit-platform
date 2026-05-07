import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { getArtifactStatsByWorkspace } from '@/lib/artifacts/server-store';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const stats = await getArtifactStatsByWorkspace(userId);
  return NextResponse.json({ stats });
}
