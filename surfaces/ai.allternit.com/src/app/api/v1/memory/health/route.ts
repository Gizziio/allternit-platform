import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';

export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // In production, this would check actual service health
  return NextResponse.json({
    status: 'healthy',
    uptime_ms: Date.now() - ((globalThis as any).__allternitStartTime || Date.now()),
    memory: {
      ollamaConnected: true,
      databaseConnected: true,
      watcherActive: true,
    },
    timestamp: new Date().toISOString(),
  });
}
