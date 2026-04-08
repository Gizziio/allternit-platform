/**
 * Policy & Governance Service
 * 
 * Full backend integration for policy management, gating, purpose binding,
 * and security monitoring.
 */

import { api } from '../../integration/api-client';
import type {
  Policy,
  CreatePolicyInput,
  UpdatePolicyInput,
  PolicyViolation,
  ApprovalRequest,
  SubmitApprovalInput,
  Purpose,
  AgentPurposeBinding,
  PurposeViolation,
  BindAgentToPurposeInput,
  SecurityEvent,
  SecurityOverview,
  ComplianceStatus,
  ListPoliciesResponse,
  ListViolationsResponse,
  ListApprovalsResponse,
  ListPurposesResponse,
  ListSecurityEventsResponse,
} from './policy.types';

// ============================================================================
// Policy CRUD Operations
// ============================================================================

/**
 * List all policies with optional filtering
 */
export async function listPolicies(options?: {
  type?: string;
  status?: string;
  severity?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListPoliciesResponse> {
  const params = new URLSearchParams();
  if (options?.type) params.append('type', options.type);
  if (options?.status) params.append('status', options.status);
  if (options?.severity) params.append('severity', options.severity);
  if (options?.search) params.append('search', options.search);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/policies${query ? `?${query}` : ''}`);
}

/**
 * Get a single policy by ID
 */
export async function getPolicy(policyId: string): Promise<Policy> {
  return api.get(`/api/v1/policies/${policyId}`);
}

/**
 * Create a new policy
 */
export async function createPolicy(input: CreatePolicyInput): Promise<Policy> {
  return api.post('/api/v1/policies', input);
}

/**
 * Update an existing policy
 */
export async function updatePolicy(
  policyId: string,
  updates: UpdatePolicyInput
): Promise<Policy> {
  return api.patch(`/api/v1/policies/${policyId}`, updates);
}

/**
 * Delete a policy
 */
export async function deletePolicy(policyId: string): Promise<void> {
  return api.delete(`/api/v1/policies/${policyId}`);
}

/**
 * Enable a policy
 */
export async function enablePolicy(policyId: string): Promise<Policy> {
  return api.post(`/api/v1/policies/${policyId}/enable`);
}

/**
 * Disable a policy
 */
export async function disablePolicy(policyId: string): Promise<Policy> {
  return api.post(`/api/v1/policies/${policyId}/disable`);
}

/**
 * Clone a policy
 */
export async function clonePolicy(
  policyId: string,
  newName?: string
): Promise<Policy> {
  return api.post(`/api/v1/policies/${policyId}/clone`, { name: newName });
}

// ============================================================================
// Policy Violations
// ============================================================================

/**
 * List policy violations with filtering
 */
export async function listViolations(options?: {
  policyId?: string;
  agentId?: string;
  status?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListViolationsResponse> {
  const params = new URLSearchParams();
  if (options?.policyId) params.append('policyId', options.policyId);
  if (options?.agentId) params.append('agentId', options.agentId);
  if (options?.status) params.append('status', options.status);
  if (options?.severity) params.append('severity', options.severity);
  if (options?.from) params.append('from', options.from);
  if (options?.to) params.append('to', options.to);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/policies/violations${query ? `?${query}` : ''}`);
}

/**
 * Get a single violation by ID
 */
export async function getViolation(violationId: string): Promise<PolicyViolation> {
  return api.get(`/api/v1/policies/violations/${violationId}`);
}

/**
 * Resolve a violation
 */
export async function resolveViolation(
  violationId: string,
  resolution: string,
  dismiss?: boolean
): Promise<PolicyViolation> {
  return api.post(`/api/v1/policies/violations/${violationId}/resolve`, {
    resolution,
    dismiss: dismiss || false,
  });
}

/**
 * Escalate a violation
 */
export async function escalateViolation(
  violationId: string,
  reason: string
): Promise<PolicyViolation> {
  return api.post(`/api/v1/policies/violations/${violationId}/escalate`, { reason });
}

// ============================================================================
// Approval Workflows
// ============================================================================

/**
 * List approval requests
 */
export async function listApprovals(options?: {
  status?: string;
  type?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListApprovalsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.type) params.append('type', options.type);
  if (options?.agentId) params.append('agentId', options.agentId);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/approvals${query ? `?${query}` : ''}`);
}

/**
 * Get pending approvals for the current user
 */
export async function getPendingApprovals(): Promise<ListApprovalsResponse> {
  return api.get('/api/v1/approvals/pending');
}

/**
 * Get a single approval request
 */
export async function getApproval(approvalId: string): Promise<ApprovalRequest> {
  return api.get(`/api/v1/approvals/${approvalId}`);
}

/**
 * Submit an approval decision
 */
export async function submitApproval(input: SubmitApprovalInput): Promise<ApprovalRequest> {
  return api.post(`/api/v1/approvals/${input.requestId}/decision`, {
    approved: input.approved,
    note: input.note,
  });
}

/**
 * Cancel an approval request
 */
export async function cancelApproval(approvalId: string): Promise<ApprovalRequest> {
  return api.post(`/api/v1/approvals/${approvalId}/cancel`);
}

/**
 * Escalate an approval request
 */
export async function escalateApproval(approvalId: string, reason: string): Promise<ApprovalRequest> {
  return api.post(`/api/v1/approvals/${approvalId}/escalate`, { reason });
}

// ============================================================================
// Purpose Binding
// ============================================================================

/**
 * List all purposes
 */
export async function listPurposes(options?: {
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListPurposesResponse> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.status) params.append('status', options.status);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/purposes${query ? `?${query}` : ''}`);
}

/**
 * Get a single purpose
 */
export async function getPurpose(purposeId: string): Promise<Purpose> {
  return api.get(`/api/v1/purposes/${purposeId}`);
}

/**
 * Create a new purpose
 */
export async function createPurpose(
  name: string,
  description: string,
  category: string,
  allowedTools: string[],
  allowedResources: string[]
): Promise<Purpose> {
  return api.post('/api/v1/purposes', {
    name,
    description,
    category,
    allowedTools,
    allowedResources,
  });
}

/**
 * Update a purpose
 */
export async function updatePurpose(
  purposeId: string,
  updates: Partial<Purpose>
): Promise<Purpose> {
  return api.patch(`/api/v1/purposes/${purposeId}`, updates);
}

/**
 * Delete a purpose
 */
export async function deletePurpose(purposeId: string): Promise<void> {
  return api.delete(`/api/v1/purposes/${purposeId}`);
}

/**
 * List agent-purpose bindings
 */
export async function listAgentPurposeBindings(options?: {
  agentId?: string;
  purposeId?: string;
  status?: string;
}): Promise<{ bindings: AgentPurposeBinding[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.agentId) params.append('agentId', options.agentId);
  if (options?.purposeId) params.append('purposeId', options.purposeId);
  if (options?.status) params.append('status', options.status);

  const query = params.toString();
  return api.get(`/api/v1/purposes/bindings${query ? `?${query}` : ''}`);
}

/**
 * Bind an agent to a purpose
 */
export async function bindAgentToPurpose(
  input: BindAgentToPurposeInput
): Promise<AgentPurposeBinding> {
  return api.post('/api/v1/purposes/bind', input);
}

/**
 * Unbind an agent from a purpose
 */
export async function unbindAgentFromPurpose(
  agentId: string,
  purposeId: string
): Promise<void> {
  return api.post('/api/v1/purposes/unbind', { agentId, purposeId });
}

/**
 * List purpose violations
 */
export async function listPurposeViolations(options?: {
  agentId?: string;
  purposeId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ violations: PurposeViolation[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.agentId) params.append('agentId', options.agentId);
  if (options?.purposeId) params.append('purposeId', options.purposeId);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/purposes/violations${query ? `?${query}` : ''}`);
}

// ============================================================================
// Security Dashboard
// ============================================================================

/**
 * Get security overview
 */
export async function getSecurityOverview(): Promise<SecurityOverview> {
  return api.get('/api/v1/security/overview');
}

/**
 * List security events
 */
export async function listSecurityEvents(options?: {
  type?: string;
  severity?: string;
  from?: string;
  to?: string;
  acknowledged?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<ListSecurityEventsResponse> {
  const params = new URLSearchParams();
  if (options?.type) params.append('type', options.type);
  if (options?.severity) params.append('severity', options.severity);
  if (options?.from) params.append('from', options.from);
  if (options?.to) params.append('to', options.to);
  if (options?.acknowledged !== undefined) params.append('acknowledged', String(options.acknowledged));
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  return api.get(`/api/v1/security/events${query ? `?${query}` : ''}`);
}

/**
 * Get a single security event
 */
export async function getSecurityEvent(eventId: string): Promise<SecurityEvent> {
  return api.get(`/api/v1/security/events/${eventId}`);
}

/**
 * Acknowledge a security event
 */
export async function acknowledgeSecurityEvent(eventId: string): Promise<SecurityEvent> {
  return api.post(`/api/v1/security/events/${eventId}/acknowledge`);
}

/**
 * Resolve a security event
 */
export async function resolveSecurityEvent(
  eventId: string,
  resolution: string
): Promise<SecurityEvent> {
  return api.post(`/api/v1/security/events/${eventId}/resolve`, { resolution });
}

/**
 * Get compliance status
 */
export async function getComplianceStatus(): Promise<ComplianceStatus> {
  return api.get('/api/v1/security/compliance');
}

/**
 * Run compliance assessment
 */
export async function runComplianceAssessment(): Promise<ComplianceStatus> {
  return api.post('/api/v1/security/compliance/assess');
}

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function usePolicies(options?: Parameters<typeof listPolicies>[0]) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listPolicies(options);
      setPolicies(response.policies);
      setTotal(response.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, error, total, refetch: fetchPolicies };
}

export function useViolations(options?: Parameters<typeof listViolations>[0]) {
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchViolations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listViolations(options);
      setViolations(response.violations);
      setTotal(response.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  return { violations, loading, error, total, refetch: fetchViolations };
}

export function useApprovals(options?: Parameters<typeof listApprovals>[0]) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listApprovals(options);
      setApprovals(response.requests);
      setTotal(response.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return { approvals, loading, error, total, refetch: fetchApprovals };
}

export function useSecurityOverview() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSecurityOverview();
      setOverview(response);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { overview, loading, error, refetch: fetchOverview };
}
