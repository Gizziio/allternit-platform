// ============================================================================
// A2UI Capsules API - Capsule Registry Management
// ============================================================================
// GET /api/a2ui/capsules - List available capsules
// POST /api/a2ui/capsules - Install/register a capsule
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiCapsule } from "@/lib/db/schema-sqlite";
import { eq, and, like, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { MiniappManifest } from "@/capsules/browser/browser.types";

/**
 * Safely parse JSON with error handling
 * Returns null if parsing fails, logs error for debugging
 */
function safeJSONParse<T>(json: string | null, fieldName: string, capsuleId?: string): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error(`[A2UI Capsules] Failed to parse ${fieldName}${capsuleId ? ` for capsule ${capsuleId}` : ''}:`, error);
    console.error(`[A2UI Capsules] Invalid JSON content:`, json.substring(0, 200));
    return null;
  }
}

// ============================================================================
// GET /api/a2ui/capsules
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const status = searchParams.get("status");
    const favorite = searchParams.get("favorite");

    // Build query conditions
    const conditions = [eq(a2uiCapsule.userId, userId)];
    
    if (status) {
      conditions.push(eq(a2uiCapsule.status, status));
    }
    
    if (favorite === "true") {
      conditions.push(eq(a2uiCapsule.favorite, true));
    }

    // Search by name
    const queryBuilder = db
      .select()
      .from(a2uiCapsule)
      .where(and(...conditions))
      .orderBy(desc(a2uiCapsule.lastUsedAt), desc(a2uiCapsule.installedAt));

    const capsules = await queryBuilder;

    // Filter by search query if provided
    let results = capsules;
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = capsules.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerQuery) ||
          c.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return NextResponse.json({
      capsules: results.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        version: c.version,
        author: c.author,
        status: c.status,
        favorite: c.favorite,
        installedAt: c.installedAt,
        lastUsedAt: c.lastUsedAt,
      })),
    });
  } catch (error) {
    console.error("[A2UI Capsules] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch capsules" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/a2ui/capsules
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";

    const body = await req.json();
    const {
      name,
      description,
      version = "1.0.0",
      author,
      manifest,
      content,
      contentAddress,
    } = body;

    if (!name || !manifest) {
      return NextResponse.json(
        { error: "Missing required fields: name, manifest" },
        { status: 400 }
      );
    }

    // Validate manifest structure
    if (!manifest.entry || !manifest.entry.type) {
      return NextResponse.json(
        { error: "Invalid manifest: missing entry.type" },
        { status: 400 }
      );
    }

    const capsuleId = nanoid();
    const now = new Date();

    const [capsule] = await db
      .insert(a2uiCapsule)
      .values({
        id: capsuleId,
        userId,
        name,
        description,
        version,
        author,
        manifest: JSON.stringify(manifest),
        content,
        contentAddress,
        status: "active",
        installedAt: now,
        favorite: false,
      })
      .returning();

    console.log(`[A2UI Capsules] Installed capsule ${capsuleId}: ${name}`);

    const parsedManifest = safeJSONParse<MiniappManifest>(capsule.manifest, 'manifest', capsule.id);
    if (parsedManifest === null) {
      return NextResponse.json(
        { error: "Capsule manifest is corrupted" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: capsule.id,
      name: capsule.name,
      description: capsule.description,
      version: capsule.version,
      author: capsule.author,
      status: capsule.status,
      manifest: parsedManifest,
      installedAt: capsule.installedAt,
    });
  } catch (error) {
    console.error("[A2UI Capsules] POST error:", error);
    return NextResponse.json(
      { error: "Failed to install capsule" },
      { status: 500 }
    );
  }
}
