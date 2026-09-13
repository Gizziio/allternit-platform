/**
 * Security settings client — data retention and data residency.
 *
 * Retention (cmd/allternit-api/src/compliance_routes.rs:28,553-634):
 *   GET  /api/v1/admin/compliance/retention-policy
 *   POST /api/v1/admin/compliance/retention-policy
 *
 * Residency (cmd/allternit-api/src/data_residency_routes.rs:22-23):
 *   GET  /api/v1/admin/data-residency            -> policy (or defaults when unset)
 *   POST /api/v1/admin/data-residency            -> upsert policy
 *   GET  /api/v1/admin/data-residency/regions    -> { regions: [...] }
 *
 * Both are owner/admin gated (403 otherwise). Day fields are nullable:
 * null means "keep indefinitely".
 */

import { api } from "@/lib/api-client";

export interface RetentionPolicy {
  org_id: string;
  chat_retention_days: number | null;
  project_retention_days: number | null;
  artifact_retention_days: number | null;
  zero_data_residence: boolean;
  zdr_regions: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface RetentionPolicyInput {
  chat_retention_days: number | null;
  project_retention_days: number | null;
  artifact_retention_days: number | null;
  zero_data_residence: boolean;
  zdr_regions: string[];
}

export interface DataResidencyPolicy {
  org_id: string;
  pinned_regions: string[];
  default_region: string | null;
  enforce_region_pinning: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface DataResidencyInput {
  pinned_regions: string[];
  default_region: string | null;
  enforce_region_pinning: boolean;
}

export async function getRetentionPolicy(): Promise<RetentionPolicy> {
  return api.get<RetentionPolicy>("/api/v1/admin/compliance/retention-policy");
}

export async function setRetentionPolicy(input: RetentionPolicyInput): Promise<RetentionPolicy> {
  return api.post<RetentionPolicy>("/api/v1/admin/compliance/retention-policy", input);
}

export async function getDataResidencyPolicy(): Promise<DataResidencyPolicy> {
  return api.get<DataResidencyPolicy>("/api/v1/admin/data-residency");
}

export async function setDataResidencyPolicy(input: DataResidencyInput): Promise<DataResidencyPolicy> {
  return api.post<DataResidencyPolicy>("/api/v1/admin/data-residency", input);
}

export async function listResidencyRegions(): Promise<string[]> {
  const data = await api.get<{ regions: string[] }>("/api/v1/admin/data-residency/regions");
  return data.regions ?? [];
}
