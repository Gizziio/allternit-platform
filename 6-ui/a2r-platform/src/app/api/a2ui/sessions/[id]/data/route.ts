// ============================================================================
// A2UI Session Data API - Update data model only
// ============================================================================
// PATCH /api/a2ui/sessions/[id]/data - Update session data model
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
    console.error(`[A2UI Session Data] Failed to parse ${fieldName}${sessionId ? ` for session ${sessionId}` : ''}:`, error);
    console.error(`[A2UI Session Data] Invalid JSON content:`, json.substring(0, 200));
    return null;
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
    const { data_model, merge = true } = body;

    if (!data_model || typeof data_model !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid data_model" },
        { status: 400 }
      );
    }

    // Get current session
    const [record] = await db
      .select()
      .from(a2uiSession)
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Merge or replace data model
    const currentDataModel = safeJSONParse<Record<string, unknown>>(record.dataModel, 'dataModel', sessionId);
    if (currentDataModel === null) {
      return NextResponse.json(
        { error: "Session data is corrupted" },
        { status: 500 }
      );
    }
    const newDataModel = merge
      ? { ...currentDataModel, ...data_model }
      : data_model;

    // Update session
    const [updated] = await db
      .update(a2uiSession)
      .set({
        dataModel: JSON.stringify(newDataModel),
        updatedAt: new Date(),
      })
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .returning();

    return NextResponse.json({
      id: updated.id,
      dataModel: newDataModel,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[A2UI Session Data] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update session data" },
      { status: 500 }
    );
  }
}
