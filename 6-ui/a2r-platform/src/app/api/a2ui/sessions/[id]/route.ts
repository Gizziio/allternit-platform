// ============================================================================
// A2UI Session API - Individual Session Operations
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiSession } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const sessionId = params.id;

    const [record] = await db
      .select()
      .from(a2uiSession)
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: record.id,
      chatId: record.chatId,
      messageId: record.messageId,
      agentId: record.agentId,
      payload: JSON.parse(record.payload),
      dataModel: JSON.parse(record.dataModel),
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error("[A2UI Session] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const sessionId = params.id;

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.payload !== undefined) updates.payload = JSON.stringify(body.payload);
    if (body.data_model !== undefined) updates.dataModel = JSON.stringify(body.data_model);
    if (body.status !== undefined) updates.status = body.status;

    const [updated] = await db
      .update(a2uiSession)
      .set(updates)
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      chatId: updated.chatId,
      payload: JSON.parse(updated.payload),
      dataModel: JSON.parse(updated.dataModel),
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[A2UI Session] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const sessionId = params.id;

    const [deleted] = await db
      .delete(a2uiSession)
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[A2UI Session] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
