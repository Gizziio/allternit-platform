import { NextRequest, NextResponse } from "next/server";
import {
  listAgentDeferredTools,
  requirePlatformUserId,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const { searchParams } = new URL(request.url);
    const model = searchParams.get("model");

    if (!model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const tools = await listAgentDeferredTools(model, platformUserId);
    if (!tools) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(tools);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/tools] Failed to list deferred tools", error);
    return NextResponse.json(
      { error: "Failed to list deferred tools" },
      { status: 500 },
    );
  }
}
