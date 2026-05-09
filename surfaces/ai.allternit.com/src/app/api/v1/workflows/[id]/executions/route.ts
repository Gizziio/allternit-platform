import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  const { search } = new URL(request.url);
  return proxyGatewayRequest(request, `/api/v1/workflows/${encodeURIComponent(id)}/executions${search}`);
}
