/**
 * GET /api/v1/workflows/:id/executions
 *
 * List all executions for a workflow.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const executions = await prisma.workflowExecution.findMany({
    where: { workflowId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    executions: executions.map((e) => ({
      execution_id: e.id,
      workflow_id: e.workflowId,
      status: e.status,
      start_time: e.startedAt?.toISOString() ?? e.createdAt.toISOString(),
      completed_at: e.completedAt?.toISOString() ?? null,
      error: e.error ?? null,
    })),
    total: executions.length,
  });
}
