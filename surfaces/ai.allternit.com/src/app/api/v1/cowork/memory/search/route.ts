import { NextRequest, NextResponse } from "next/server";
import { memoryOrchestrator } from "@/lib/cowork/memory-orchestrator";
import { getAuth } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/v1/cowork/memory/search?query=...&userId=...&limit=... */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);
  const { userId } = await getAuth();

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await memoryOrchestrator.search({ query, userId, limit });
    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** POST /api/v1/cowork/memory/search — legacy body-based search (MCP only) */
export async function POST(req: NextRequest) {
  let body: { query?: string; userId?: string; limit?: number; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await memoryOrchestrator.search({
      query: body.query,
      userId,
      limit: body.limit ?? 10,
      tags: body.tags,
    });
    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
