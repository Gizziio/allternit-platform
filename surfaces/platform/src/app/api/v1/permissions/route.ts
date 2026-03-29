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

export async function GET(): Promise<Response> {
  try {
    const permissions = await requestGizziJson("/api/v1/permission");
    return NextResponse.json(permissions);
  } catch (error) {
    return toRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  // Bulk reply not supported — use /[requestID]/reply
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
