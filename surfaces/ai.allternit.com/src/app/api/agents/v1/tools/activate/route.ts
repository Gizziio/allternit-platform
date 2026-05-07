import { NextRequest, NextResponse } from "next/server";
import {
  activateDeferredToolsForSession,
  requirePlatformUserId,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivateDeferredToolsRequest = {
  model?: string;
  session_id?: string;
  tool_ids?: string[];
  tool_id?: string;
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const body = (await request.json().catch(() => ({}))) as ActivateDeferredToolsRequest;

    if (!body.model || !body.session_id) {
      return NextResponse.json(
        { error: "model and session_id are required" },
        { status: 400 },
      );
    }

    const toolIds = Array.isArray(body.tool_ids)
      ? body.tool_ids
      : body.tool_id
        ? [body.tool_id]
        : [];

    if (toolIds.length === 0) {
      return NextResponse.json(
        { error: "At least one tool_id is required" },
        { status: 400 },
      );
    }

    const activated = await activateDeferredToolsForSession(
      body.model,
      body.session_id,
      toolIds,
      platformUserId,
    );

    if (!activated) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...activated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/tools/activate] Failed to activate deferred tools", error);
    return NextResponse.json(
      { error: "Failed to activate deferred tools" },
      { status: 500 },
    );
  }
}
