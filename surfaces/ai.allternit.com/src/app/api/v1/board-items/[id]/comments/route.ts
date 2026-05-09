import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/v1/board-items/${encodeURIComponent(id)}/comments`);
}

export async function POST(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/v1/board-items/${encodeURIComponent(id)}/comments`);
}
