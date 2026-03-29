/**
 * GET /api/v1/mirror/pair/[code]
 *
 * Look up pairing info for a code.
 * Called by the mobile PairPage on load to display session details + QR content.
 *
 * Returns: { code, session_id, session_name, expires_at, pairing_url }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { lookupPairingCode } from "@/lib/pairing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { code } = await context.params;
    const entry = lookupPairingCode(code);

    if (!entry) {
      return NextResponse.json(
        { error: "Invalid or expired pairing code" },
        { status: 404 },
      );
    }

    const origin =
      request.headers.get("origin") ||
      `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host") ?? "localhost:3000"}`;

    const pairingUrl = `${origin}/shell/pair/${entry.code}`;

    return NextResponse.json({
      code: entry.code,
      session_id: entry.sessionId,
      session_name: entry.sessionName,
      expires_at: new Date(entry.expiresAt).toISOString(),
      pairing_url: pairingUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
