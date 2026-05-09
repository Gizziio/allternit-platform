import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; execId: string }> }
): Promise<Response> {
  const { id, execId } = await params;
  return proxyGatewayRequest(request, `/api/v1/workflows/${encodeURIComponent(id)}/executions/${encodeURIComponent(execId)}`);
}
