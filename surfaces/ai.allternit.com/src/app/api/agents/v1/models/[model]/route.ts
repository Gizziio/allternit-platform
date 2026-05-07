import { NextResponse } from "next/server";
import {
  getOwnedRemoteAgentModel,
  requirePlatformUserId,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ model: string }> },
): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const { model } = await params;
    const agentModel = await getOwnedRemoteAgentModel(model, platformUserId);

    if (!agentModel) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(agentModel);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/models/:model] Failed to fetch agent model", error);
    return NextResponse.json(
      { error: "Failed to fetch agent model" },
      { status: 500 },
    );
  }
}
