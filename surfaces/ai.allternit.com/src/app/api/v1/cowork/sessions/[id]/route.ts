import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/v1/cowork/sessions/${encodeURIComponent(id)}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/v1/cowork/sessions/${encodeURIComponent(id)}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/v1/cowork/sessions/${encodeURIComponent(id)}`);
}
