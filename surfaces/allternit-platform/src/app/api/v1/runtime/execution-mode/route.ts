import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getRuntimeExecutionModeForAuthUserId,
  isRuntimeExecutionMode,
  setRuntimeExecutionModeForAuthUserId,
} from "@/lib/runtime-execution-mode";
import { getAuth } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const authState = await getAuth();
  return NextResponse.json(
    await getRuntimeExecutionModeForAuthUserId(authState.userId ?? "local-user"),
  );
}

export async function PUT(request: NextRequest): Promise<Response> {
  const authState = await getAuth();
  const body = await request.json().catch(() => ({}));
  const mode = String(body.mode || "");

  if (!isRuntimeExecutionMode(mode)) {
    return NextResponse.json({ error: "Invalid execution mode" }, { status: 400 });
  }

  return NextResponse.json(
    await setRuntimeExecutionModeForAuthUserId(
      authState.userId ?? "local-user",
      mode,
    ),
  );
}
