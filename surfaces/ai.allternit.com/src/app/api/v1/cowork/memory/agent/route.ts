import { NextRequest, NextResponse } from "next/server";
import { addAgentMemory, searchAgentMemory } from "@/lib/cowork/memory-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: {
    action?: "add" | "search";
    messages?: Array<{ role: string; content: string }>;
    query?: string;
    agent_id?: string;
    limit?: number;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;

  try {
    if (action === "add") {
      if (!body.messages?.length) {
        return NextResponse.json({ error: "messages is required for add" }, { status: 400 });
      }
      const result = await addAgentMemory({
        messages: body.messages,
        agent_id: body.agent_id,
        metadata: body.metadata,
      });
      return NextResponse.json(result);
    }

    if (action === "search") {
      if (!body.query || typeof body.query !== "string") {
        return NextResponse.json({ error: "query is required for search" }, { status: 400 });
      }
      const result = await searchAgentMemory({
        query: body.query,
        agent_id: body.agent_id,
        limit: body.limit,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "action must be add or search" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
