/**
 * CommRails DAG client + react-query hooks (RailsTaskList data plane).
 *
 * GET /api/commrails/dags?view=mine|ready|all (fail-closed: any error → empty
 * DTO, never throws) and WIH write-back (pickup / close). URL building copies
 * src/lib/bots/commrails-visibility.ts: GATEWAY_BASE_URL + /api/commrails.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config';
import { usePlatformUser } from '@/lib/platform-auth-client';
import { fetchVisibility, type VisibilityNeed } from '@/lib/bots/commrails-visibility';

/** Fallback agent identity when no platform user is signed in. */
export const DEFAULT_RAILS_AGENT_ID = 'web-user';

export const RAILS_DAGS_QUERY_KEY = ['rails-dags'] as const;

export type RailsDagView = 'mine' | 'ready' | 'all';

export type RailsNodeStatus = 'NEW' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED';

export interface RailsDagNode {
  node_id: string;
  parent_node_id: string | null;
  title: string;
  status: RailsNodeStatus;
  ready: boolean;
  assignee?: string | null;
  current_wih_id?: string | null;
  labels: string[];
  description: string | null;
  priority: number | null;
}

export interface RailsDagSummary {
  dag_id: string;
  root_title: string | null;
  nodes: RailsDagNode[];
  ready_count: number;
  done_count: number;
}

export interface RailsActiveWih {
  wih_id: string;
  dag_id: string;
  node_id: string;
  agent_id: string;
  status: string;
}

export interface RailsDagsDto {
  dags: RailsDagSummary[];
  active_wihs: RailsActiveWih[];
}

export const EMPTY_RAILS_DAGS: RailsDagsDto = { dags: [], active_wihs: [] };

export interface PickupWihInput {
  dag_id: string;
  node_id: string;
  agent_id: string;
  fresh?: boolean;
}

export interface CloseWihInput {
  wih_id: string;
  /** Server whitelists DONE | FAILED (case-normalized). */
  status: 'DONE' | 'FAILED';
  evidence?: string[];
  agent_id: string;
}

export interface CreateDagNodeInput {
  dag_id: string;
  title: string;
  parent_node_id: string;
}

export interface UpdateDagNodeInput {
  dag_id: string;
  node_id: string;
  title?: string;
  /** Present = replace label set (empty array clears). */
  labels?: string[];
  /** Present = set (empty string allowed). */
  description?: string;
  /** Present = set. No null-clear in v6. */
  priority?: number;
}

export interface DeleteDagNodeInput {
  dag_id: string;
  node_id: string;
}

export interface ReparentDagNodeInput {
  dag_id: string;
  node_id: string;
  /** null moves the node to the dag root. */
  parent_node_id: string | null;
}

function railsUrl(path: string): string {
  return `${GATEWAY_BASE_URL.replace(/\/+$/, '')}${path}`;
}

function mapNodeStatus(raw: unknown): RailsNodeStatus {
  if (raw === 'READY' || raw === 'RUNNING' || raw === 'DONE' || raw === 'FAILED') return raw;
  return 'NEW';
}

function parseDags(raw: unknown): RailsDagsDto {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_RAILS_DAGS };
  const rec = raw as Record<string, unknown>;
  const dagsRaw = Array.isArray(rec.dags) ? rec.dags : [];
  const wihsRaw = Array.isArray(rec.active_wihs) ? rec.active_wihs : [];
  return {
    dags: dagsRaw
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
      .map((d) => {
        const nodesRaw = Array.isArray(d.nodes) ? d.nodes : [];
        return {
          dag_id: String(d.dag_id ?? ''),
          root_title: typeof d.root_title === 'string' ? d.root_title : null,
          nodes: nodesRaw
            .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
            .map((n) => ({
              node_id: String(n.node_id ?? ''),
              parent_node_id:
                typeof n.parent_node_id === 'string' && n.parent_node_id.length > 0
                  ? n.parent_node_id
                  : null,
              title: String(n.title ?? n.node_id ?? 'node'),
              status: mapNodeStatus(n.status),
              ready: n.ready === true,
              assignee: typeof n.assignee === 'string' ? n.assignee : null,
              current_wih_id: typeof n.current_wih_id === 'string' ? n.current_wih_id : null,
              labels: Array.isArray(n.labels)
                ? n.labels.filter((l): l is string => typeof l === 'string')
                : [],
              description: typeof n.description === 'string' ? n.description : null,
              priority: typeof n.priority === 'number' ? n.priority : null,
            }))
            .filter((n) => n.node_id.length > 0),
          ready_count: typeof d.ready_count === 'number' ? d.ready_count : 0,
          done_count: typeof d.done_count === 'number' ? d.done_count : 0,
        };
      })
      .filter((d) => d.dag_id.length > 0),
    active_wihs: wihsRaw
      .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
      .map((w) => ({
        wih_id: String(w.wih_id ?? ''),
        dag_id: String(w.dag_id ?? ''),
        node_id: String(w.node_id ?? ''),
        agent_id: String(w.agent_id ?? ''),
        status: String(w.status ?? ''),
      }))
      .filter((w) => w.wih_id.length > 0),
  };
}

async function fetchDags(view: RailsDagView): Promise<RailsDagsDto> {
  try {
    const res = await fetch(railsUrl(`/api/commrails/dags?view=${view}`), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ...EMPTY_RAILS_DAGS };
    return parseDags(await res.json());
  } catch {
    return { ...EMPTY_RAILS_DAGS };
  }
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(railsUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`commrails ${path} ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

async function patchJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(railsUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`commrails ${path} ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

async function deleteJson(path: string): Promise<unknown> {
  const res = await fetch(railsUrl(path), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`commrails ${path} ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? {} : res.json().catch(() => ({}));
}

export function useRailsDags(view: RailsDagView) {
  return useQuery({
    queryKey: [...RAILS_DAGS_QUERY_KEY, view],
    queryFn: () => fetchDags(view),
    refetchInterval: 5000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function usePickupWih() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PickupWihInput) =>
      postJson('/api/commrails/wihs/pickup', input) as Promise<{
        wih_id: string;
        context_pack_path?: string;
      }>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

export function useCloseWih() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseWihInput) =>
      postJson(`/api/commrails/wihs/${encodeURIComponent(input.wih_id)}/close`, input) as Promise<{
        closed: boolean;
      }>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

export function useCreateDagNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDagNodeInput) =>
      postJson(
        `/api/commrails/dags/${encodeURIComponent(input.dag_id)}/nodes`,
        { title: input.title, parent_node_id: input.parent_node_id }
      ) as Promise<{ node_id: string }>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

export function useUpdateDagNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDagNodeInput) => {
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.labels !== undefined) body.labels = input.labels;
      if (input.description !== undefined) body.description = input.description;
      if (input.priority !== undefined) body.priority = input.priority;
      return patchJson(
        `/api/commrails/dags/${encodeURIComponent(input.dag_id)}/nodes/${encodeURIComponent(input.node_id)}`,
        body
      ) as Promise<Record<string, unknown>>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

export function useDeleteDagNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteDagNodeInput) =>
      deleteJson(
        `/api/commrails/dags/${encodeURIComponent(input.dag_id)}/nodes/${encodeURIComponent(input.node_id)}`
      ) as Promise<Record<string, unknown>>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

export function useReparentDagNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReparentDagNodeInput) =>
      patchJson(
        `/api/commrails/dags/${encodeURIComponent(input.dag_id)}/nodes/${encodeURIComponent(input.node_id)}`,
        { parent_node_id: input.parent_node_id }
      ) as Promise<Record<string, unknown>>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAILS_DAGS_QUERY_KEY }),
  });
}

const NEEDS_YOU_QUERY_KEY = ['rails-needs-you'] as const;

/**
 * Count of agents waiting on the user (CommRails visibility needsYou array).
 * Fail-closed: fetchVisibility already returns an empty DTO on error → 0.
 */
export function useRailsNeedsYouCount(): number {
  const { data } = useQuery({
    queryKey: NEEDS_YOU_QUERY_KEY,
    queryFn: () => fetchVisibility(),
    refetchInterval: 10_000,
    retry: false,
  });
  return data?.needsYou.length ?? 0;
}

/**
 * needsYou entries (agents waiting on the user) from the visibility DTO.
 * Fail-closed: fetchVisibility already returns an empty DTO on error → [].
 * Shares NEEDS_YOU_QUERY_KEY with useRailsNeedsYouCount (single fetch).
 */
export function useRailsNeedsYouEntries(): VisibilityNeed[] {
  const { data } = useQuery({
    queryKey: NEEDS_YOU_QUERY_KEY,
    queryFn: () => fetchVisibility(),
    refetchInterval: 10_000,
    retry: false,
  });
  return data?.needsYou ?? [];
}

/**
 * Current session/user identity for Rails WIH ownership. Uses the platform
 * auth user (present in both the web app and the Fabric PWA); falls back to
 * the 'web-user' constant when signed out.
 */
export function useRailsAgentId(): string {
  const { user } = usePlatformUser();
  return user?.id ?? DEFAULT_RAILS_AGENT_ID;
}
