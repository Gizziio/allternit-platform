import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await prisma.coworkSession.findUnique({ where: { id } });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { status?: string; title?: string; checkpoint?: any; metadata?: any; completedAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.title !== undefined) data.title = body.title;
    if (body.checkpoint !== undefined) data.checkpoint = JSON.stringify(body.checkpoint);
    if (body.metadata !== undefined) data.metadata = JSON.stringify(body.metadata);
    if (body.completedAt !== undefined) data.completedAt = new Date(body.completedAt);

    const session = await prisma.coworkSession.update({ where: { id }, data });
    return NextResponse.json({ session });
  } catch (err) {
    // Gizzi session IDs (ses_xxx) will not match Prisma CUIDs — return 200 so
    // BrowserAgentWorkspace takeover state (which is client-side) isn't blocked.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Record to update not found') || message.includes('not found')) {
      return NextResponse.json({ ok: true, deferred: true });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.coworkSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
