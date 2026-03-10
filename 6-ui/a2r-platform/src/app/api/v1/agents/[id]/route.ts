/**
 * Individual Agent API
 * 
 * GET /api/v1/agents/[id] - Get agent details
 * PATCH /api/v1/agents/[id] - Update agent
 * DELETE /api/v1/agents/[id] - Delete agent
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";

const DEFAULT_GATEWAY_URL = process.env.A2R_GATEWAY_URL || 'http://127.0.0.1:3210';

async function proxyToGateway(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const url = `${DEFAULT_GATEWAY_URL}/api/v1${path}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await proxyToGateway('GET', `/agents/${params.id}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Agents API] Get error:', error);
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = await proxyToGateway('PATCH', `/agents/${params.id}`, body);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Agents API] Update error:', error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await proxyToGateway('DELETE', `/agents/${params.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Agents API] Delete error:', error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
