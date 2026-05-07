import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  getRuntimeExecutionModeForAuthUserId,
  isRuntimeExecutionMode,
  setRuntimeExecutionModeForAuthUserId,
} from "@/lib/runtime-execution-mode";

export async function GET() {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = await getRuntimeExecutionModeForAuthUserId(authUserId);
  return NextResponse.json(mode);
}

export async function PUT(request: NextRequest) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isRuntimeExecutionMode(body?.mode)) {
    return NextResponse.json(
      { error: "mode must be one of: plan, safe, auto" },
      { status: 400 },
    );
  }

  const mode = await setRuntimeExecutionModeForAuthUserId(authUserId, body.mode);
  return NextResponse.json(mode);
}
