import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/agents/v1/tools/activate');
}
