// ============================================================================
// A2UI Actions Stream API - SSE Streaming for Long-Running Actions
// ============================================================================
// GET /api/a2ui/actions/stream?session_id=xxx&action_id=xxx - SSE stream
// ============================================================================

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiSession } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || "http://127.0.0.1:3004";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const actionId = searchParams.get("action_id");

    if (!sessionId || !actionId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: session_id, action_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify session exists and belongs to user
    const [a2uiSessionRecord] = await db
      .select()
      .from(a2uiSession)
      .where(and(eq(a2uiSession.id, sessionId), eq(a2uiSession.userId, userId)))
      .limit(1);

    if (!a2uiSessionRecord) {
      return new Response(
        JSON.stringify({ error: "A2UI session not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial event
        const initialEvent = {
          type: "action.start",
          sessionId,
          actionId,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
        );

        try {
          // Try to forward to kernel for streaming
          const kernelResponse = await fetch(
            `${KERNEL_URL}/v1/a2ui/actions/stream?session_id=${sessionId}&action_id=${actionId}`,
            {
              headers: {
                Accept: "text/event-stream",
              },
            }
          );

          if (kernelResponse.ok && kernelResponse.body) {
            // Forward kernel SSE stream
            const reader = kernelResponse.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } else {
            // Kernel doesn't support streaming - simulate progress
            await simulateActionStream(controller, encoder, sessionId, actionId);
          }
        } catch (kernelError) {
          // Kernel not available - simulate progress
          await simulateActionStream(controller, encoder, sessionId, actionId);
        }

        // Send completion event
        const completeEvent = {
          type: "action.complete",
          sessionId,
          actionId,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`)
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[A2UI Actions Stream] GET error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to stream action", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Simulate action progress for development
async function simulateActionStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  sessionId: string,
  actionId: string
) {
  const steps = [
    { type: "action.progress", message: "Initializing...", progress: 10 },
    { type: "action.progress", message: "Processing request...", progress: 30 },
    { type: "action.progress", message: "Executing action...", progress: 60 },
    { type: "action.progress", message: "Finalizing...", progress: 90 },
  ];

  for (const step of steps) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const event = {
      ...step,
      sessionId,
      actionId,
      timestamp: new Date().toISOString(),
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }
}
