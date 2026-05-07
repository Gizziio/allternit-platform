/**
 * POST /api/v1/workflows/:id/execute
 *
 * Creates a WorkflowExecution with status="running" and fires off async execution
 * using the real @allternit/workflow-engine DAG executor.
 * Returns { execution_id, workflow_id, status, start_time } immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createWorkflowEngine } from "@allternit/workflow-engine";
import type { WorkflowNode, Connection } from "@allternit/workflow-engine";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

interface StoredEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

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

    let nodes: WorkflowNode[] = [];
    let edges: StoredEdge[] = [];

    try { nodes = JSON.parse(workflow.nodes) as WorkflowNode[]; } catch { /* ignore */ }
    try { edges = JSON.parse(workflow.edges) as StoredEdge[]; } catch { /* ignore */ }

    // Map ReactFlow-style edges to engine Connection format
    const connections: Connection[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourcePort: e.sourceHandle,
      targetPort: e.targetHandle,
      condition: e.condition,
    }));

    const engine = createWorkflowEngine();
    engine.registerWorkflow({
      id: workflowId,
      name: workflow.title,
      version: "1.0.0",
      description: workflow.description ?? undefined,
      nodes,
      connections,
    });

    const result = await engine.execute(workflowId);

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: result.status,
        completedAt: new Date(),
        result: JSON.stringify({
          outputs: result.outputs,
          nodes_processed: result.nodeExecutions?.length ?? 0,
          execution_path: result.context?.state.executionPath ?? [],
          failed_nodes: result.context?.state.failedNodes ?? [],
        }),
        ...(result.error ? { error: result.error.message } : {}),
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
