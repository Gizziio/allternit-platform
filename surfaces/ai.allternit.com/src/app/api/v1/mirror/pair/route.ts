/**
 * POST /api/v1/mirror/pair
 *
 * Create a pairing code for a session.
 * Called by PairingDialog when the user wants to share a session to a mobile device.
 *
 * Body: { session_id: string; session_name?: string }
 * Returns: { pairing_code, pairing_url, session_id, expires_at }
 *
 * Also handles:
 * POST /api/v1/mirror/pair  with { pairing_code: string }
 * — Consume a code (mobile device completing the pairing handshake)
 *   Returns: { session_id }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createPairingCode, consumePairingCode } from "@/lib/pairing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    // Mobile handshake path — consuming an existing code
    if (body.pairing_code) {
      const code = String(body.pairing_code).toUpperCase();
      const entry = consumePairingCode(code);
      if (!entry) {
        return NextResponse.json(
          { error: "Invalid or expired pairing code" },
          { status: 404 },
        );
      }
      return NextResponse.json({ session_id: entry.sessionId });
    }

    // Desktop path — creating a new pairing code for a session
    const sessionId = String(body.session_id || "");
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 },
      );
    }

    const entry = createPairingCode(sessionId, body.session_name);

    // Build pairing URL from request origin
    const origin =
      request.headers.get("origin") ||
      request.headers.get("x-forwarded-proto") + "://" + request.headers.get("host") ||
      "http://localhost:3000";

    const pairingUrl = `${origin}/shell/pair/${entry.code}`;

    return NextResponse.json({
      pairing_code: entry.code,
      pairing_url: pairingUrl,
      session_id: entry.sessionId,
      expires_at: new Date(entry.expiresAt).toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
