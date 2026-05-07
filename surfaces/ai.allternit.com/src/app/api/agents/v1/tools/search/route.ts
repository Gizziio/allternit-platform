import { NextRequest, NextResponse } from "next/server";
import {
  requirePlatformUserId,
  searchAgentDeferredTools,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchDeferredToolsRequest = {
  model?: string;
  query?: string;
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const body = (await request.json().catch(() => ({}))) as SearchDeferredToolsRequest;

    if (!body.model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const result = await searchAgentDeferredTools(
      body.model,
      body.query ?? "",
      platformUserId,
    );

    if (!result) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/tools/search] Failed to search deferred tools", error);
    return NextResponse.json(
      { error: "Failed to search deferred tools" },
      { status: 500 },
    );
  }
}
