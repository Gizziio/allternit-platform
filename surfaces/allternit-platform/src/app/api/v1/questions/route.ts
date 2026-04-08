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

export async function GET(): Promise<Response> {
  try {
    const questions = await requestGizziJson("/api/v1/question");
    return NextResponse.json(questions);
  } catch (error) {
    return toRouteError(error);
  }
}
