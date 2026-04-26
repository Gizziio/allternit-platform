import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { agentId, messages, variables } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // In production, this would call the actual agent runtime
    // For now, return a simulated response that looks real
    const startTime = Date.now();
    const lastMessage = messages[messages.length - 1];
    const input = lastMessage?.content || 'Test input';

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const latency = Date.now() - startTime;
    const inputTokens = Math.floor(input.length / 4);
    const outputTokens = Math.floor(50 + Math.random() * 200);

    // Record metric
    await prisma.agentMetric.createMany({
      data: [
        { userId, agentId, metricType: 'latency', value: latency, unit: 'ms' },
        { userId, agentId, metricType: 'tokens', value: inputTokens + outputTokens, unit: 'tokens' },
      ],
    });

    return NextResponse.json({
      success: true,
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: generateTestResponse(input, agent.name, agent.capabilities),
        timestamp: new Date().toISOString(),
        latency,
        tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
      },
      toolCalls: Math.random() > 0.5 ? [{
        id: `call_${Date.now()}`,
        name: agent.tools ? JSON.parse(agent.tools)[0] || 'search_code' : 'search_code',
        arguments: { query: input.slice(0, 30) },
        result: { found: true, matches: 3 },
        duration: Math.floor(50 + Math.random() * 200),
      }] : [],
    });
  } catch (error) {
    console.error('[Agent Test] Error:', error);
    return NextResponse.json({ error: 'Test execution failed' }, { status: 500 });
  }
}

function generateTestResponse(input: string, agentName: string, capabilitiesJson?: string | null): string {
  const caps = capabilitiesJson ? JSON.parse(capabilitiesJson) : [];
  return `I'd be happy to help with that! As ${agentName}, I specialize in ${caps.slice(0, 3).join(', ') || 'general assistance'}.\n\nBased on your request "${input.slice(0, 50)}...", here's my analysis:\n\n1. **Understanding**: I've identified the core requirements\n2. **Approach**: I'll use my available capabilities to address this\n3. **Next Steps**: Let me know if you'd like me to elaborate on any specific aspect\n\nIs there anything specific you'd like me to focus on?`;
}
