/**
 * POST /api/v1/workflows/:id/executions/:execId/cancel
 *
 * Cancel a running workflow execution.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; execId: string }> };

export async function POST(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id, execId } = await params;

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: execId, workflowId: id },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.status === "completed" || execution.status === "failed" || execution.status === "cancelled") {
    return NextResponse.json(
      { error: `Cannot cancel execution with status "${execution.status}"` },
      { status: 409 },
    );
  }

  const updated = await prisma.workflowExecution.update({
    where: { id: execId },
    data: { status: "cancelled", completedAt: new Date() },
  });

  return NextResponse.json({
    execution_id: updated.id,
    workflow_id: updated.workflowId,
    status: updated.status,
    completed_at: updated.completedAt?.toISOString() ?? null,
  });
}
