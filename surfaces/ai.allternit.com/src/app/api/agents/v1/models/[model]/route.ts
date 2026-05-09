import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
): Promise<Response> {
  const { model } = await params;
  return proxyGatewayRequest(request, `/api/agents/v1/models/${encodeURIComponent(model)}`);
}
