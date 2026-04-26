/**
 * GET /api/v1/workflows/:id/executions/:execId
 *
 * Get the status of a single workflow execution.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; execId: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id, execId } = await params;

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: execId, workflowId: id },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  return NextResponse.json({
    execution_id: execution.id,
    workflow_id: execution.workflowId,
    status: execution.status,
    start_time: execution.startedAt?.toISOString() ?? execution.createdAt.toISOString(),
    completed_at: execution.completedAt?.toISOString() ?? null,
    error: execution.error ?? null,
  });
}
