//! bb-compatible sync layer.
//!
//! Bridges the local Drizzle cache (`Project`, `Chat`, `UserPreference`)
//! with the Rust API `/api/v1/bb/*` routes.

import type { project, chat } from "@/lib/db/schema-sqlite";

export type BBProjectRow = typeof project.$inferSelect;
export type BBChatRow = typeof chat.$inferSelect;

export interface BBProjectCreateInput {
  name: string;
  kind?: "standard" | "personal";
  gitRemoteUrl?: string;
}

export interface BBThreadCreateInput {
  projectId: string;
  environmentId?: string;
  providerId?: string;
  title?: string;
  input: Array<{ role: string; content: string }>;
}

export interface BBApiProject {
  id: string;
  user_id: string;
  kind: string;
  name: string;
  git_remote_url: string | null;
  sort_key: string;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface BBApiThread {
  id: string;
  project_id: string;
  environment_id: string | null;
  provider_id: string;
  model_override: string | null;
  reasoning_level_override: string | null;
  title: string | null;
  title_fallback: string | null;
  section_id: string | null;
  status: string;
  parent_thread_id: string | null;
  source_thread_id: string | null;
  origin_kind: string | null;
  origin_plugin_id: string | null;
  visibility: string;
  archived_at: number | null;
  pinned_at: number | null;
  pin_sort_key: string | null;
  deleted_at: number | null;
  last_read_at: number | null;
  latest_attention_at: number;
  created_at: number;
  updated_at: number;
}

const API_BASE = "/api/v1/bb";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`bb API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export function listBBProjects(): Promise<{ items: BBApiProject[] }> {
  return api("/projects");
}

export function createBBProject(input: BBProjectCreateInput): Promise<BBApiProject> {
  return api("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBBProject(
  id: string,
  input: { name?: string; gitRemoteUrl?: string | null },
): Promise<BBApiProject> {
  return api(`/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name,
      git_remote_url: input.gitRemoteUrl,
    }),
  });
}

export function deleteBBProject(id: string): Promise<void> {
  return api(`/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listBBThreads(projectId: string): Promise<{ items: BBApiThread[] }> {
  return api(`/threads?projectId=${encodeURIComponent(projectId)}`);
}

export function createBBThread(input: BBThreadCreateInput): Promise<BBApiThread> {
  return api("/threads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendBBMessage(
  threadId: string,
  input: Array<{ role: string; content: string }>,
): Promise<{ ok: boolean; delivery: string }> {
  return api(`/threads/${encodeURIComponent(threadId)}/send`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export function listBBEvents(threadId: string): Promise<{ items: unknown[] }> {
  return api(`/threads/${encodeURIComponent(threadId)}/events`);
}
