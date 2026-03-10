/**
 * Agents API - CRUD Operations
 * 
 * Proxies to Gateway / Registry service
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

// List all agents
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await proxyToGateway('GET', '/agents');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Agents API] List error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch agents", message },
      { status: 500 }
    );
  }
}

// Create new agent
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = await proxyToGateway('POST', '/agents', body);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Agents API] Create error:', error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
