// ============================================================================
// A2UI Capsule API - Individual Capsule Operations
// ============================================================================
// GET /api/a2ui/capsules/[id] - Get capsule manifest
// PATCH /api/a2ui/capsules/[id] - Update capsule
// DELETE /api/a2ui/capsules/[id] - Delete capsule
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiCapsule } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";

// ============================================================================
// GET /api/a2ui/capsules/[id]
// ============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const capsuleId = params.id;

    const [capsule] = await db
      .select()
      .from(a2uiCapsule)
      .where(and(eq(a2uiCapsule.id, capsuleId), eq(a2uiCapsule.userId, userId)))
      .limit(1);

    if (!capsule) {
      return NextResponse.json(
        { error: "Capsule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: capsule.id,
      name: capsule.name,
      description: capsule.description,
      version: capsule.version,
      author: capsule.author,
      status: capsule.status,
      favorite: capsule.favorite,
      manifest: JSON.parse(capsule.manifest),
      content: capsule.content,
      contentAddress: capsule.contentAddress,
      installedAt: capsule.installedAt,
      lastUsedAt: capsule.lastUsedAt,
    });
  } catch (error) {
    console.error("[A2UI Capsule] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch capsule" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/a2ui/capsules/[id]
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const capsuleId = params.id;

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.version !== undefined) updates.version = body.version;
    if (body.author !== undefined) updates.author = body.author;
    if (body.manifest !== undefined) updates.manifest = JSON.stringify(body.manifest);
    if (body.content !== undefined) updates.content = body.content;
    if (body.contentAddress !== undefined) updates.contentAddress = body.contentAddress;
    if (body.status !== undefined) updates.status = body.status;
    if (body.favorite !== undefined) updates.favorite = body.favorite;

    const [updated] = await db
      .update(a2uiCapsule)
      .set(updates)
      .where(and(eq(a2uiCapsule.id, capsuleId), eq(a2uiCapsule.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Capsule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      version: updated.version,
      status: updated.status,
      favorite: updated.favorite,
    });
  } catch (error) {
    console.error("[A2UI Capsule] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update capsule" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/a2ui/capsules/[id]
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const capsuleId = params.id;

    const [deleted] = await db
      .delete(a2uiCapsule)
      .where(and(eq(a2uiCapsule.id, capsuleId), eq(a2uiCapsule.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Capsule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[A2UI Capsule] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete capsule" },
      { status: 500 }
    );
  }
}
