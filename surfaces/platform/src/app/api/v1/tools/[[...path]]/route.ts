import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GizziRuntimeError,
  requestGizziJson,
} from "@/lib/gizzi-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GizziTool = {
  id: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

function toRouteError(error: unknown): Response {
  if (error instanceof GizziRuntimeError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: "Runtime backend request failed" },
    { status: 500 },
  );
}

function normalizeTool(tool: GizziTool) {
  return {
    id: tool.id,
    name: tool.id,
    description: tool.description ?? "",
    parameters: tool.parameters ?? {},
  };
}

async function listRuntimeTools() {
  const tools = await requestGizziJson<GizziTool[]>("/v1/skill/tools");
  return tools.map(normalizeTool);
}

async function getPathSegments(
  context: { params: Promise<{ path?: string[] }> },
): Promise<string[]> {
  const params = await context.params;
  return params.path ?? [];
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    const tools = await listRuntimeTools();

    if (path.length === 0) {
      return NextResponse.json({
        tools,
        total: tools.length,
        native: tools,
        mcp: [],
      });
    }

    if (path.length === 1) {
      const tool = tools.find((item) => item.id === path[0]);
      if (!tool) {
        return NextResponse.json({ error: "Tool not found" }, { status: 404 });
      }

      return NextResponse.json(tool);
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return toRouteError(error);
  }
}

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  return NextResponse.json(
    {
      error:
        "Standalone tool execution is not exposed by the runtime backend. Execute tools through a real session prompt/tool-call flow instead.",
      code: "TOOL_EXECUTION_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
}
