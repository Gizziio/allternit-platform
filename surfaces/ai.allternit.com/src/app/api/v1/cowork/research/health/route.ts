import { NextResponse } from 'next/server';
import { checkResearchHealth } from '@/lib/cowork/research-client';

export async function GET() {
  const healthy = await checkResearchHealth();
  return NextResponse.json({ research: healthy }, { status: healthy ? 200 : 503 });
}
