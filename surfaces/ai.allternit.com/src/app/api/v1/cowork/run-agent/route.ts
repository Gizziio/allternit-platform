import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { spec?: { id?: string; role?: string; prompt?: string; tools?: string[]; model?: string }; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { spec, sessionId } = body;
  if (!spec?.prompt || !spec?.id) {
    return NextResponse.json({ error: 'spec.id and spec.prompt are required' }, { status: 400 });
  }

  const modelId = spec.model ? `anthropic/${spec.model}` : 'anthropic/claude-sonnet-4.6';

  try {
    const { text } = await generateText({
      model: gateway(modelId),
      system: spec.role
        ? `You are a ${spec.role} agent. Complete the assigned task thoroughly and concisely.`
        : 'You are a capable assistant. Complete the assigned task thoroughly and concisely.',
      prompt: spec.prompt,
      maxOutputTokens: 4096,
    });

    return NextResponse.json({
      agentId: spec.id,
      sessionId: sessionId ?? '',
      output: text,
      status: 'completed',
    });
  } catch (err) {
    return NextResponse.json({
      agentId: spec.id,
      sessionId: sessionId ?? '',
      output: '',
      status: 'error',
      error: String(err),
    }, { status: 200 });
  }
}
