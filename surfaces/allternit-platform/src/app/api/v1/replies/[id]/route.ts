/**
 * GET /v1/replies/:id
 *
 * Retrieve a Reply by ID.
 * Returns the current state of a reply if it has been persisted.
 *
 * NOTE: Full reply persistence (Phase 8) is not yet implemented.
 * This endpoint returns 404 for all IDs until the persistence layer ships.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return NextResponse.json(
    {
      error: "not_found",
      message: `Reply '${id}' not found. Full reply persistence is not yet implemented — replies are currently streamed and held in client state only.`,
      hint: "Use POST /v1/replies with stream=true to stream a new reply.",
    },
    { status: 404 },
  );
}
