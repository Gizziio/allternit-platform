/**
 * Cowork Session Control API
 * 
 * POST /api/cowork/[sessionId]/control
 * Send control actions (pause, resume, step, approve, reject, takeover)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";

const DEFAULT_GATEWAY_URL = process.env.A2R_GATEWAY_URL || 'http://127.0.0.1:3210';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;
    const action = await req.json();
    
    // Forward control action to Gateway
    try {
      const response = await fetch(`${DEFAULT_GATEWAY_URL}/api/v1/cowork/${sessionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      
      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('[Cowork Control] Gateway error:', error);
      // Return success in mock mode for development
      return NextResponse.json({ 
        success: true, 
        mock: true,
        message: `Action '${action.type}' accepted (mock mode)`
      });
    }
  } catch (error) {
    console.error('[Cowork Control] Error:', error);
    return NextResponse.json(
      { error: "Failed to send control action" },
      { status: 500 }
    );
  }
}
