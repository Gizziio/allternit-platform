import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';
import { createCoworkPersonaStore } from '@allternit/cowork-engine';

export const runtime = 'nodejs';
export const maxDuration = 180;

const MAX_CONCURRENT = 4;

interface AgentResult {
  personaId: string;
  personaName: string;
  output: string;
  status: 'completed' | 'error';
  error?: string;
  durationMs: number;
}

async function runAgentForPersona(params: {
  personaId: string;
  personaName: string;
  systemPrompt: string;
  task: string;
  model: string;
}): Promise<AgentResult> {
  const start = Date.now();
  try {
    const { text } = await generateText({
      model: gateway(params.model),
      system: params.systemPrompt,
      prompt: params.task,
      maxOutputTokens: 2048,
    });
    return {
      personaId: params.personaId,
      personaName: params.personaName,
      output: text,
      status: 'completed',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      personaId: params.personaId,
      personaName: params.personaName,
      output: '',
      status: 'error',
      error: String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function runBatch(tasks: Array<() => Promise<AgentResult>>): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
    const batch = tasks.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map((t) => t()));
    results.push(...batchResults);
  }
  return results;
}

export async function POST(req: NextRequest) {
  let body: { task?: string; personaIds?: string[]; userId?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { userId } = await getAuth();
  const { task, personaIds, model = 'anthropic/claude-haiku-4-5-20251001' } = body;
  if (!task) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = createCoworkPersonaStore(prisma);
  const allPersonas = await store.list(userId);

  const targeted = personaIds?.length
    ? allPersonas.filter((p) => personaIds.includes(p.id))
    : allPersonas.slice(0, MAX_CONCURRENT);

  if (targeted.length === 0) {
    return NextResponse.json({ error: 'No personas available. Create at least one persona first.' }, { status: 400 });
  }

  const runTasks = targeted.map((persona) => () =>
    runAgentForPersona({
      personaId: persona.id,
      personaName: persona.name,
      systemPrompt: persona.systemPrompt,
      task,
      model,
    }),
  );

  const results = await runBatch(runTasks);

  return NextResponse.json({
    task,
    results,
    summary: {
      total: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      errors: results.filter((r) => r.status === 'error').length,
    },
  });
}
