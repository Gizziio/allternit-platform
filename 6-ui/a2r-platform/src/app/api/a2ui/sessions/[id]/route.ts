// ============================================================================
// A2UI Session API - Individual Session Operations
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiSession } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";

/**
 * Safely parse JSON with error handling
 * Returns null if parsing fails, logs error for debugging
 */
function safeJSONParse<T>(json: string | null, fieldName: string, sessionId?: string): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error(`[A2UI Session] Failed to parse ${fieldName}${sessionId ? ` for session ${sessionId}` : ''}:`, error);
    console.error(`[A2UI Session] Invalid JSON content:`, json.substring(0, 200));
    return null;
  }
}

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

    const payload = safeJSONParse<Record<string, unknown>>(record.payload, 'payload', record.id);
    const dataModel = safeJSONParse<Record<string, unknown>>(record.dataModel, 'dataModel', record.id);

    if (payload === null || dataModel === null) {
      return NextResponse.json(
        { error: "Session data is corrupted", sessionId: record.id },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: record.id,
      chatId: record.chatId,
      messageId: record.messageId,
      agentId: record.agentId,
      payload,
      dataModel,
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

    const payload = safeJSONParse<Record<string, unknown>>(updated.payload, 'payload', updated.id);
    const dataModel = safeJSONParse<Record<string, unknown>>(updated.dataModel, 'dataModel', updated.id);

    if (payload === null || dataModel === null) {
      return NextResponse.json(
        { error: "Updated session data is corrupted", sessionId: updated.id },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updated.id,
      chatId: updated.chatId,
      payload,
      dataModel,
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
