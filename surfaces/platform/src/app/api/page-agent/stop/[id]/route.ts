/**
 * POST /api/page-agent/stop/[id]
 *
 * Stop the live page-agent task running in the Electron browser bridge.
 */

import { NextResponse } from 'next/server';
import { stopPageAgentTask } from '@/lib/page-agent/runner';

export async function POST(
  _req: Request,
  _ctx: { params: Promise<{ id: string }> },
) {
  await stopPageAgentTask();
  return NextResponse.json({ ok: true });
}
