/**
 * MCP Test Connection API
 * 
 * Tests connection to an MCP server
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { getOrCreateMcpClient } from "@/lib/ai/mcp/mcp-client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, url, type } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const client = getOrCreateMcpClient({
      id: id || 'test',
      name: name || 'Test',
      url,
      type: type || 'http',
    });
    
    const result = await client.attemptConnection();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[MCP Test API] Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to test connection",
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
