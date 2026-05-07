import { NextResponse } from "next/server";
import {
  getStoredRemoteAgentResponse,
  requirePlatformUserId,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const { id } = await params;
    const stored = await getStoredRemoteAgentResponse(id, platformUserId);

    if (!stored) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: stored.responseId,
      object: "response",
      created_at: stored.createdAt,
      status: "completed",
      model: stored.model ?? "unknown",
      output_text: stored.outputText,
      output: [
        {
          id: `msg_${stored.responseId}`,
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: stored.outputText,
              annotations: [],
              logprobs: [],
            },
          ],
        },
      ],
      artifacts: stored.artifacts,
      allternit: {
        conversation_id: stored.conversationId,
        agent_profile: stored.agentProfile,
        artifacts: stored.artifacts,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/responses/:id] Failed to fetch stored response", error);
    return NextResponse.json(
      { error: "Failed to fetch stored response" },
      { status: 500 },
    );
  }
}
