import { NextResponse } from "next/server";
import { checkMemoryHealth } from "@/lib/cowork/memory-client";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  try {
    const health = await checkMemoryHealth();
    const allHealthy = health.mcp && health.api;
    return NextResponse.json(health, { status: allHealthy ? 200 : 503 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, mcp: false, api: false }, { status: 503 });
  }
}
