/**
 * GET    /api/v1/workflows/:id  - Get a single workflow
 * PUT    /api/v1/workflows/:id  - Update a workflow
 * DELETE /api/v1/workflows/:id  - Delete a workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { _count: { select: { executions: true } } },
  });

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  let nodes: unknown[] = [];
  let edges: unknown[] = [];
  try { nodes = JSON.parse(workflow.nodes) as unknown[]; } catch { /* ignore */ }
  try { edges = JSON.parse(workflow.edges) as unknown[]; } catch { /* ignore */ }

  return NextResponse.json({
    id: workflow.id,
    name: workflow.title,
    version: "1.0",
    description: workflow.description ?? null,
    nodes,
    edges,
    node_count: nodes.length,
    created_at: workflow.createdAt.toISOString(),
    updated_at: workflow.updatedAt.toISOString(),
    status: "draft",
  });
}

export async function PUT(req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const data: { title?: string; description?: string; nodes?: string; edges?: string } = {};
  if (typeof body.name === "string") data.title = body.name;
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.description === "string") data.description = body.description;
  if (Array.isArray(body.nodes)) data.nodes = JSON.stringify(body.nodes);
  if (Array.isArray(body.edges)) data.edges = JSON.stringify(body.edges);

  const updated = await prisma.workflow.update({ where: { id }, data });

  let nodes: unknown[] = [];
  try { nodes = JSON.parse(updated.nodes) as unknown[]; } catch { /* ignore */ }

  return NextResponse.json({
    id: updated.id,
    name: updated.title,
    version: "1.0",
    description: updated.description ?? null,
    node_count: nodes.length,
    created_at: updated.createdAt.toISOString(),
    updated_at: updated.updatedAt.toISOString(),
    status: "draft",
  });
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params;

  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
