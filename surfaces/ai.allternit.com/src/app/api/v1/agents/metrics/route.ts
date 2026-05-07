import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const metricType = searchParams.get('type');
  const days = parseInt(searchParams.get('days') || '7');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const metrics = await prisma.agentMetric.findMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
        ...(metricType ? { metricType } : {}),
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Aggregate by agent
    const byAgent: Record<string, { 
      agentId: string; 
      totalRuns: number; 
      avgLatency: number; 
      totalTokens: number; 
      totalCost: number;
      successRate: number;
    }> = {};

    for (const m of metrics) {
      if (!byAgent[m.agentId]) {
        byAgent[m.agentId] = { agentId: m.agentId, totalRuns: 0, avgLatency: 0, totalTokens: 0, totalCost: 0, successRate: 100 };
      }
      if (m.metricType === 'latency') {
        byAgent[m.agentId].avgLatency = (byAgent[m.agentId].avgLatency * byAgent[m.agentId].totalRuns + m.value) / (byAgent[m.agentId].totalRuns + 1);
        byAgent[m.agentId].totalRuns++;
      }
      if (m.metricType === 'tokens') {
        byAgent[m.agentId].totalTokens += m.value;
      }
      if (m.metricType === 'cost') {
        byAgent[m.agentId].totalCost += m.value;
      }
    }

    return NextResponse.json({
      metrics: metrics.map(m => ({
        id: m.id,
        agentId: m.agentId,
        runId: m.runId,
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        timestamp: m.timestamp.toISOString(),
      })),
      summary: Object.values(byAgent),
    });
  } catch (error) {
    console.error('[Agent Metrics] Error:', error);
    return NextResponse.json({ metrics: [], summary: [] });
  }
}
