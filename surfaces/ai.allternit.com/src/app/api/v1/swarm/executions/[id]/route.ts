/**
 * GET /api/v1/swarm/executions/[id] — poll execution state.
 *
 * Returns the current SwarmExecution snapshot including role outputs.
 * Clients should poll every 1-2s while status is 'running'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecution } from '@/lib/swarm/swarm-runner';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const execution = getExecution(id);

  if (!execution) {
    return NextResponse.json({ message: 'Execution not found' }, { status: 404 });
  }

  return NextResponse.json(execution);
}
