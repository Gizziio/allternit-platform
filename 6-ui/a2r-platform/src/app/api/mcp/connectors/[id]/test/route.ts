/**
 * MCP Connector Test API
 * 
 * POST /api/mcp/connectors/[id]/test
 * Test connection to an MCP server
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { getMcpConnectorById } from "@/lib/db/mcp-queries";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connector = await getMcpConnectorById(params.id);
    
    if (!connector) {
      return NextResponse.json(
        { error: "Connector not found" },
        { status: 404 }
      );
    }
    
    if (connector.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Attempt connection to MCP server
    try {
      const response = await fetch(connector.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'a2r-platform', version: '1.0.0' },
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          connected: true,
          serverInfo: data.result?.serverInfo,
        });
      } else {
        return NextResponse.json({
          success: false,
          connected: false,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      console.error('[MCP Test] Connection error:', error);
      return NextResponse.json({
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  } catch (error) {
    console.error('[MCP Test] Error:', error);
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
