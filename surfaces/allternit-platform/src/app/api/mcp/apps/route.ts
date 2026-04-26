import { NextRequest, NextResponse } from "next/server";

import {
  canAppAccessTool,
  type McpAppBridgeRequest,
} from "@/lib/ai/mcp/apps";
import { getOrCreateMcpClient } from "@/lib/ai/mcp/mcp-client";
import { getMcpConnectorById } from "@/lib/db/mcp-queries";
import { getAuth } from "@/lib/server-auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isConnectorAccessibleByUser(
  connectorUserId: string | null,
  userId: string,
): boolean {
  if (userId === "local-user") {
    return true;
  }

  return connectorUserId === userId;
}

export async function POST(request: NextRequest): Promise<Response> {
  const { userId } = await getAuth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: McpAppBridgeRequest;
  try {
    body = (await request.json()) as McpAppBridgeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.connectorId || typeof body.connectorId !== "string") {
    return NextResponse.json(
      { error: "connectorId is required" },
      { status: 400 },
    );
  }

  const connector = await getMcpConnectorById(body.connectorId);
  if (!connector || !isConnectorAccessibleByUser(connector.userId, userId)) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  const mcpClient = getOrCreateMcpClient({
    id: connector.id,
    name: connector.name,
    url: connector.url,
    type: connector.type,
  });

  try {
    await mcpClient.connect();

    switch (body.action) {
      case "tools/list": {
        const result = await mcpClient.listTools(body.params);
        return NextResponse.json({
          ...result,
          tools: result.tools.filter(canAppAccessTool),
        });
      }

      case "tools/call": {
        const name = body.params?.name;
        const args = isRecord(body.params?.arguments)
          ? body.params.arguments
          : {};

        if (typeof name !== "string" || name.length === 0) {
          return NextResponse.json(
            { error: "Tool name is required" },
            { status: 400 },
          );
        }

        const definitions = await mcpClient.listTools();
        const tool = definitions.tools.find((entry: any) => entry.name === name);

        if (!tool) {
          return NextResponse.json(
            { error: `Tool "${name}" not found` },
            { status: 404 },
          );
        }

        if (!canAppAccessTool(tool)) {
          return NextResponse.json(
            { error: `Tool "${name}" is not available to the app` },
            { status: 403 },
          );
        }

        const result = await mcpClient.callTool(name, args, definitions);
        return NextResponse.json(result);
      }

      case "resources/list":
        return NextResponse.json(await mcpClient.listResources(body.params));

      case "resources/read": {
        const uri = body.params?.uri;
        if (typeof uri !== "string" || uri.length === 0) {
          return NextResponse.json(
            { error: "Resource URI is required" },
            { status: 400 },
          );
        }

        return NextResponse.json(await mcpClient.readResource(uri));
      }

      case "resources/templates/list":
        return NextResponse.json(await mcpClient.listResourceTemplates());

      case "prompts/list":
        return NextResponse.json(await mcpClient.listPrompts(body.params));

      default:
        return NextResponse.json(
          { error: "Unsupported MCP Apps action" },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
