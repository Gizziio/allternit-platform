/**
 * POST /api/v1/workflows/:id/execute
 *
 * Creates a WorkflowExecution with status="running" and fires off async execution.
 * Returns { execution_id, workflow_id, status, start_time } immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function runWorkflowAsync(workflowId: string, executionId: string): Promise<void> {
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: "failed", error: "Workflow not found", completedAt: new Date() },
      });
      return;
    }

    let nodes: unknown[] = [];
    try { nodes = JSON.parse(workflow.nodes) as unknown[]; } catch { /* ignore */ }

    // Process nodes in order — stub: each node completes immediately
    for (const node of nodes) {
      void node; // no-op — real implementation would call node action here
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: JSON.stringify({ nodes_processed: nodes.length }),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: "failed", error: message, completedAt: new Date() },
    }).catch(() => {/* ignore secondary errors */});
  }
}

export async function POST(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const startedAt = new Date();
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: id,
      status: "running",
      startedAt,
    },
  });

  // Fire-and-forget async execution
  void runWorkflowAsync(id, execution.id);

  return NextResponse.json({
    execution_id: execution.id,
    workflow_id: id,
    status: execution.status,
    start_time: startedAt.toISOString(),
  }, { status: 202 });
}
