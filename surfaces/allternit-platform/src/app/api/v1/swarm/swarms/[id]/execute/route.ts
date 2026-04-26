/**
 * POST /api/v1/swarm/swarms/[id]/execute — start execution of a swarm.
 *
 * Kicks off the SwarmRunner pipeline in the background.
 * Returns immediately with an execution_id the client can poll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSwarm, runSwarm, saveExecution, type SwarmExecution } from '@/lib/swarm/swarm-runner';

const abortControllers = new Map<string, AbortController>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: swarmId } = await params;

  const swarm = getSwarm(swarmId);
  if (!swarm) {
    return NextResponse.json({ message: 'Swarm not found' }, { status: 404 });
  }

  const executionId = randomUUID();
  const abortController = new AbortController();
  abortControllers.set(executionId, abortController);

  const execution: SwarmExecution = {
    id: executionId,
    swarmId,
    status: 'starting',
    progress: 0,
    roleOutputs: [],
    startedAt: Date.now(),
  };
  saveExecution(execution);

  // Fire-and-forget — client polls /executions/:id for progress
  runSwarm(swarmId, executionId, abortController.signal).catch(() => {
    abortControllers.delete(executionId);
  }).finally(() => {
    abortControllers.delete(executionId);
  });

  return NextResponse.json({ execution_id: executionId });
}
