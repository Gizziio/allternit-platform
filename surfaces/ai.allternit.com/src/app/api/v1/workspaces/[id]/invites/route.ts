import { NextRequest } from 'next/server';
import { proxyGatewayRequest } from '@/lib/runtime-gateway-proxy';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/workspaces/${encodeURIComponent(id)}/invites`);
}

export async function POST(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  return proxyGatewayRequest(request, `/api/workspaces/${encodeURIComponent(id)}/invites`);
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get('id');
  if (!inviteId) {
    return new Response(
      JSON.stringify({ error: 'Invitation id required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return proxyGatewayRequest(request, `/api/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`);
}
