/**
 * MCP Connectors API
 * 
 * CRUD operations for MCP (Model Context Protocol) connectors
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { getMcpConnectorsByUserId, createMcpConnector, deleteMcpConnector } from "@/lib/db/mcp-queries";

// List all MCP connectors for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectors = await getMcpConnectorsByUserId(session.user.id);
    return NextResponse.json({ connectors });
  } catch (error) {
    console.error('[MCP API] List error:', error);
    return NextResponse.json(
      { error: "Failed to fetch connectors" },
      { status: 500 }
    );
  }
}

// Create new MCP connector
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    const connector = await createMcpConnector({
      userId: session.user.id,
      name: body.name,
      nameId: body.nameId || body.name.toLowerCase().replace(/\s+/g, '-'),
      url: body.url,
      type: body.type || 'http',
      oauthClientId: body.oauthClientId,
      oauthClientSecret: body.oauthClientSecret,
      enabled: body.enabled ?? true,
    });
    
    return NextResponse.json({ connector });
  } catch (error) {
    console.error('[MCP API] Create error:', error);
    return NextResponse.json(
      { error: "Failed to create connector" },
      { status: 500 }
    );
  }
}
