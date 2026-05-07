import { NextRequest, NextResponse } from "next/server";
import { requirePlatformUserId } from "../_lib";
import { resumeSdkRun, type PendingHitl } from "@/lib/agents/sdk-agent-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResumeRequest = {
  runId: string;
  outcome: {
    type: "permission";
    approved: boolean;
    reason?: string;
  } | {
    type: "question";
    answers: string[];
  };
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    await requirePlatformUserId();
    const body = (await request.json().catch(() => ({}))) as ResumeRequest;

    if (!body.runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }
    if (!body.outcome) {
      return NextResponse.json({ error: "outcome is required" }, { status: 400 });
    }

    const result = await resumeSdkRun(body.runId, body.outcome);

    const response: {
      content: string;
      session_id: string;
      tool_calls: unknown[];
      hitl_events: unknown[];
      pending_hitl?: PendingHitl;
    } = {
      content: result.content,
      session_id: result.sessionId,
      tool_calls: result.toolCalls,
      hitl_events: result.hitlEvents,
    };

    if (result.pendingHitl) {
      response.pending_hitl = result.pendingHitl;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/resume] Failed to resume run", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resume run" },
      { status: 500 },
    );
  }
}
