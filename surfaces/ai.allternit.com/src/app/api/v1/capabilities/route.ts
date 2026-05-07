import { NextResponse } from "next/server";
import { AGENT_CAPABILITIES } from "@/lib/agents/agent.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    capabilities: AGENT_CAPABILITIES,
  });
}
