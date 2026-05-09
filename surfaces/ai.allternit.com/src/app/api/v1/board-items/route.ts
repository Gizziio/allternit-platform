import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || searchParams.get('workspace_id');
  
  if (!workspaceId) {
    return new Response(
      JSON.stringify({ error: 'workspaceId required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  const upstreamPath = `/api/v1/board-items?workspace_id=${encodeURIComponent(workspaceId)}`;
  return proxyGatewayRequest(request, upstreamPath);
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/v1/board-items');
}
