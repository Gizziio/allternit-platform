import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/conversations');
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/conversations');
}
