/**
 * Prometheus Metrics API
 * 
 * GET /api/metrics - Returns metrics in Prometheus format
 * POST /api/metrics - Push metrics to Prometheus PushGateway
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";

const PUSHGATEWAY_URL = process.env.PROMETHEUS_PUSHGATEWAY_URL || 'http://localhost:9091';

// In-memory metrics store for development
const metricsStore = new Map<string, string>();

// GET - Return metrics in Prometheus format
export async function GET(req: NextRequest) {
  try {
    // Optional: Check auth for metrics endpoint
    // const session = await auth.api.getSession({ headers: req.headers });
    
    const metrics: string[] = [];
    
    // Add default metrics
    metrics.push('# HELP a2r_agents_total Total number of agents');
    metrics.push('# TYPE a2r_agents_total gauge');
    metrics.push(`a2r_agents_total ${metricsStore.get('agents_total') || '0'}`);
    
    metrics.push('# HELP a2r_runs_total Total number of agent runs');
    metrics.push('# TYPE a2r_runs_total counter');
    metrics.push(`a2r_runs_total ${metricsStore.get('runs_total') || '0'}`);
    
    metrics.push('# HELP a2r_up Whether the A2R platform is up');
    metrics.push('# TYPE a2r_up gauge');
    metrics.push('a2r_up 1');
    
    // Add any stored metrics
    metricsStore.forEach((value, key) => {
      if (!key.includes('_total') && !key.includes('_up')) {
        metrics.push(`${key} ${value}`);
      }
    });
    
    return new Response(metrics.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    });
  } catch (error) {
    console.error('[Metrics] Error:', error);
    return new Response('# Error generating metrics', { status: 500 });
  }
}

// POST - Push metrics to PushGateway
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { job, instance, metrics } = await req.json();
    
    if (!job || !metrics) {
      return NextResponse.json(
        { error: "Missing required fields: job, metrics" },
        { status: 400 }
      );
    }
    
    // Store metrics in memory
    const metricKey = `${job}${instance ? `:${instance}` : ''}`;
    metricsStore.set(metricKey, metrics);
    
    // Try to push to Prometheus PushGateway if configured
    try {
      const pushUrl = `${PUSHGATEWAY_URL}/metrics/job/${job}${instance ? `/instance/${instance}` : ''}`;
      
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: metrics,
      });
      
      if (!response.ok) {
        console.warn('[Metrics] PushGateway returned:', response.status);
      }
    } catch (error) {
      // PushGateway not available, store in memory only
      console.debug('[Metrics] PushGateway not available, storing in memory');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Metrics] Push error:', error);
    return NextResponse.json(
      { error: "Failed to push metrics" },
      { status: 500 }
    );
  }
}
