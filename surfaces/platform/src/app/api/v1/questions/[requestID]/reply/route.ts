import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { GizziRuntimeError, requestGizziJson } from "@/lib/gizzi-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteError(error: unknown): Response {
  if (error instanceof GizziRuntimeError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  return NextResponse.json({ error: "Runtime backend request failed" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestID: string }> },
): Promise<Response> {
  try {
    const { requestID } = await context.params;
    const body = await request.json().catch(() => ({}));
    await requestGizziJson(`/api/v1/question/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      body: {
        answers: body.answers, // Array<{ questionIndex: number; answer: string | string[] }>
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toRouteError(error);
  }
}
