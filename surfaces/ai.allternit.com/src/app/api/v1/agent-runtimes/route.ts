import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/v1/agent-runtimes');
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/v1/agent-runtimes');
}
