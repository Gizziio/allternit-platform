// ============================================================================
// A2UI Capsule Launch API - Launch capsule as A2UI session
// ============================================================================
// POST /api/a2ui/capsules/[id]/launch - Launch a capsule
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiSession, a2uiCapsule } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { MiniappManifest } from "@/capsules/browser/browser.types";

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || "http://127.0.0.1:3004";

/**
 * Safely parse JSON with error handling
 * Returns null if parsing fails, logs error for debugging
 */
function safeJSONParse<T>(json: string | null, fieldName: string, capsuleId?: string): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error(`[A2UI Capsule Launch] Failed to parse ${fieldName}${capsuleId ? ` for capsule ${capsuleId}` : ''}:`, error);
    console.error(`[A2UI Capsule Launch] Invalid JSON content:`, json.substring(0, 200));
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";
    const capsuleId = params.id;

    const body = await req.json();
    const { chat_id, context = {} } = body;

    if (!chat_id) {
      return NextResponse.json(
        { error: "Missing required field: chat_id" },
        { status: 400 }
      );
    }

    // Get the capsule
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

    // Parse manifest to get entry point
    const manifest = safeJSONParse<MiniappManifest>(capsule.manifest, 'manifest', capsuleId);
    if (manifest === null) {
      return NextResponse.json(
        { error: "Capsule manifest is corrupted" },
        { status: 500 }
      );
    }
    let payload;

    // Load payload based on entry type
    switch (manifest.entry.type) {
      case "a2ui":
        if (capsule.content) {
          try {
            payload = JSON.parse(capsule.content);
          } catch (error) {
            console.error("[A2UI Capsule Launch] Failed to parse capsule content:", error);
            return NextResponse.json(
              { error: "Invalid A2UI payload in capsule content" },
              { status: 500 }
            );
          }
        } else if (capsule.contentAddress) {
          // TODO: Load from content address (IPFS, etc.)
          return NextResponse.json(
            { error: "Content address loading not yet implemented" },
            { status: 501 }
          );
        } else {
          return NextResponse.json(
            { error: "Capsule has no content" },
            { status: 500 }
          );
        }
        break;

      case "html":
        // Wrap HTML in A2UI WebView component
        payload = {
          version: "1.0",
          surfaces: [
            {
              id: "main",
              title: capsule.name,
              components: [
                {
                  type: "Container",
                  props: {
                    direction: "column",
                    padding: 0,
                  },
                  children: [
                    {
                      type: "WebView",
                      props: {
                        src: capsule.contentAddress || `data:text/html,${encodeURIComponent(capsule.content || "")}`,
                        style: { flex: 1 },
                      },
                    },
                  ],
                },
              ],
            },
          ],
          dataModel: context,
        };
        break;

      case "component":
        // For React components, we'd need to dynamically load them
        // For now, return an error
        return NextResponse.json(
          { error: "Component-type capsules not yet supported" },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: `Unknown entry type: ${manifest.entry.type}` },
          { status: 400 }
        );
    }

    // Create A2UI session
    const sessionId = nanoid();
    const now = new Date();

    const [newSession] = await db
      .insert(a2uiSession)
      .values({
        id: sessionId,
        chatId: chat_id,
        userId,
        agentId: null,
        payload: JSON.stringify(payload),
        dataModel: JSON.stringify(context),
        status: "active",
        source: `capsule:${capsuleId}`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Update capsule last used
    await db
      .update(a2uiCapsule)
      .set({ lastUsedAt: now })
      .where(eq(a2uiCapsule.id, capsuleId));

    console.log(`[A2UI Capsules] Launched capsule ${capsuleId} as session ${sessionId}`);

    return NextResponse.json({
      sessionId: newSession.id,
      capsuleId,
      payload,
      dataModel: context,
      createdAt: newSession.createdAt,
    });
  } catch (error) {
    console.error("[A2UI Capsule Launch] POST error:", error);
    return NextResponse.json(
      { error: "Failed to launch capsule", details: String(error) },
      { status: 500 }
    );
  }
}
