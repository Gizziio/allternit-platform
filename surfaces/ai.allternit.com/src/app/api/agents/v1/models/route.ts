import { NextResponse } from "next/server";
import {
  listOwnedRemoteAgentModels,
  requirePlatformUserId,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const data = await listOwnedRemoteAgentModels(platformUserId);

    return NextResponse.json({
      object: "list",
      data,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/models] Failed to list agent models", error);
    return NextResponse.json(
      { error: "Failed to list agent models" },
      { status: 500 },
    );
  }
}
