import { api } from "@/lib/api-client";

export type ApprovalStatus = "pending" | "approved" | "denied" | "timed_out" | "cancelled";
export type ApprovalPriority = "low" | "normal" | "high" | "critical";

export interface ApprovalRequestSummary {
  id: string;
  run_id: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  title: string;
  action_type?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export interface ApprovalRequest extends ApprovalRequestSummary {
  step_cursor?: string | null;
  description?: string | null;
  action_params?: Record<string, unknown> | null;
  reasoning?: string | null;
  requested_by?: string | null;
  responded_by?: string | null;
  response_message?: string | null;
  timeout_seconds?: number | null;
}

export interface CreateApprovalRequest {
  run_id: string;
  step_cursor?: string;
  priority?: ApprovalPriority;
  title: string;
  description?: string;
  action_type?: string;
  action_params?: Record<string, unknown>;
  reasoning?: string;
  requested_by?: string;
  timeout_seconds?: number;
}

export interface ApprovalResponse {
  approved: boolean;
  message?: string;
  modified_params?: Record<string, unknown>;
}

export async function listApprovals(
  status?: ApprovalStatus,
  runId?: string
): Promise<ApprovalRequestSummary[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (runId) params.append("run_id", runId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api.get<ApprovalRequestSummary[]>(`/api/v1/approvals${query}`);
}

export async function getApproval(id: string): Promise<ApprovalRequest> {
  return api.get<ApprovalRequest>(`/api/v1/approvals/${encodeURIComponent(id)}`);
}

export async function createApproval(req: CreateApprovalRequest): Promise<ApprovalRequest> {
  return api.post<ApprovalRequest>("/api/v1/approvals", req);
}

export async function approveApproval(
  id: string,
  response?: ApprovalResponse
): Promise<ApprovalRequest> {
  return api.post<ApprovalRequest>(
    `/api/v1/approvals/${encodeURIComponent(id)}/approve`,
    response ?? { approved: true }
  );
}

export async function denyApproval(
  id: string,
  response?: ApprovalResponse
): Promise<ApprovalRequest> {
  return api.post<ApprovalRequest>(
    `/api/v1/approvals/${encodeURIComponent(id)}/deny`,
    response ?? { approved: false }
  );
}

export async function cancelApproval(id: string): Promise<ApprovalRequest> {
  return api.post<ApprovalRequest>(`/api/v1/approvals/${encodeURIComponent(id)}/cancel`);
}
