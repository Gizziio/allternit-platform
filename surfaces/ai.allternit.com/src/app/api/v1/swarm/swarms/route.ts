/**
 * POST /api/v1/swarm/swarms — create a new swarm configuration.
 *
 * Body matches CreateSwarmInput from swarm.api.ts.
 * Stores config in the SwarmRunner's in-process store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { saveSwarm, type SwarmConfig } from '@/lib/swarm/swarm-runner';
import type { CreateSwarmInput } from '@/lib/swarm/swarm.api';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: CreateSwarmInput = await req.json();

    const id = randomUUID();
    const config: SwarmConfig = {
      id,
      name: body.name,
      goal: body.description,
      roles: (body.agents ?? []).map(a => ({
        roleId: a.agent_id,
        roleLabel: a.role_label ?? a.role,
        roleDescription: a.role_description ?? '',
        providerId: a.provider_id ?? 'claude',
        modelId: a.model_id ?? 'claude-sonnet-4-6',
        execMode: (a.exec_mode ?? 'api') as 'api' | 'cli' | 'local' | 'oauth',
      })),
      maxIterations: body.max_rounds ?? 3,
      escalateOnFailure: body.escalate_on_failure ?? false,
      strategy: body.strategy,
    };

    saveSwarm(config);

    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to create swarm' },
      { status: 400 },
    );
  }
}
