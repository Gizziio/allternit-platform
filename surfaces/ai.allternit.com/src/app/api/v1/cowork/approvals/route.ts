import { NextRequest, NextResponse } from "next/server";
import { getApprovalGate } from "@/lib/cowork/approval-gate-instance";

export const runtime = "nodejs";
export const maxDuration = 30;

type PendingApproval = {
  actionId: string;
  sessionId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  details: string;
  timeoutMs?: number;
  requestedAt: Date;
};

/** List all pending approval requests (client polls this). */
export async function GET() {
  const gate = getApprovalGate();
  return NextResponse.json({ pending: gate.getPending() });
}

/** Respond to an approval request (user decision from UI). */
export async function POST(req: NextRequest) {
  let body: { actionId?: string; decision?: "approved" | "rejected"; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { actionId, decision } = body;
  if (!actionId || !decision) {
    return NextResponse.json({ error: "actionId and decision are required" }, { status: 400 });
  }
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });
  }

  const gate = getApprovalGate();
  const ok = gate.respond(actionId, decision, body.note);
  if (!ok) {
    return NextResponse.json({ error: "Approval not found or already resolved" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Register a new approval request (called by background service).
 * The gate resolves async — caller should poll GET to check status.
 */
export async function PUT(req: NextRequest) {
  let body: Partial<PendingApproval>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.actionId || !body.sessionId || !body.riskLevel || !body.summary || !body.details) {
    return NextResponse.json({ error: "actionId, sessionId, riskLevel, summary, and details are required" }, { status: 400 });
  }

  const gate = getApprovalGate();
  const approval: PendingApproval = {
    actionId: body.actionId,
    sessionId: body.sessionId,
    riskLevel: body.riskLevel,
    summary: body.summary,
    details: body.details,
    timeoutMs: body.timeoutMs ?? 120_000,
    requestedAt: new Date(),
  };

  // Fire request in background — do not await (would hang the HTTP response)
  gate.request(approval).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true, actionId: approval.actionId, status: "pending" }, { status: 202 });
}
