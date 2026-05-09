import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const upstreamPath = '/api/v1/cowork/memory' + (qs ? `?${qs}` : '');
  return proxyGatewayRequest(request, upstreamPath);
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxyGatewayRequest(request, '/api/v1/cowork/memory');
}
