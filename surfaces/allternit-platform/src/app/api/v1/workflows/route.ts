/**
 * GET  /api/v1/workflows  - List all workflows
 * POST /api/v1/workflows  - Create a workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const workflows = await prisma.workflow.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      userId: true,
      nodes: true,
      edges: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { executions: true } },
    },
  });

  const items = workflows.map((w) => {
    let nodes: unknown[] = [];
    try { nodes = JSON.parse(w.nodes) as unknown[]; } catch { /* ignore */ }
    return {
      id: w.id,
      name: w.title,
      version: "1.0",
      description: w.description ?? null,
      node_count: nodes.length,
      created_at: w.createdAt.toISOString(),
      updated_at: w.updatedAt.toISOString(),
      status: "draft",
    };
  });

  return NextResponse.json({ workflows: items, total: items.length });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.name === "string" ? body.name : (typeof body.title === "string" ? body.title : "Untitled Workflow");
  const description = typeof body.description === "string" ? body.description : undefined;
  const nodes = JSON.stringify(Array.isArray(body.nodes) ? body.nodes : []);
  const edges = JSON.stringify(Array.isArray(body.edges) ? body.edges : []);

  const workflow = await prisma.workflow.create({
    data: { title, description, nodes, edges },
  });

  return NextResponse.json({
    id: workflow.id,
    name: workflow.title,
    version: "1.0",
    description: workflow.description ?? null,
    node_count: 0,
    created_at: workflow.createdAt.toISOString(),
    updated_at: workflow.updatedAt.toISOString(),
    status: "draft",
  }, { status: 201 });
}
