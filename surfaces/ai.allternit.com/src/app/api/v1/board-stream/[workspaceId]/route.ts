import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  const { workspaceId } = await params;
  return proxyGatewayRequest(request, `/api/v1/board-stream/${encodeURIComponent(workspaceId)}`);
}
