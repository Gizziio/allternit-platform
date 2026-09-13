/**
 * Pure display organizers for RailsTaskList. No React, no fetch — testable.
 */

import type {
  RailsDagNode,
  RailsDagSummary,
  RailsDagsDto,
  RailsNodeStatus,
} from '@/lib/rails/use-rails-dags';

export const RAILS_MAX_DEPTH = 3;

/** Frontier-first: READY → RUNNING → FAILED → NEW → DONE. */
const STATUS_ORDER: Record<RailsNodeStatus, number> = {
  READY: 0,
  RUNNING: 1,
  FAILED: 2,
  NEW: 3,
  DONE: 4,
};

export interface OrganizedNodeRow {
  kind: 'node';
  node: RailsDagNode;
  depth: number;
}

export interface OrganizedDoneRow {
  kind: 'done';
  /** Stable key for expand state: the parent node_id, or '__roots__'. */
  parentKey: string;
  depth: number;
  count: number;
  nodes: RailsDagNode[];
}

export type OrganizedRow = OrganizedNodeRow | OrganizedDoneRow;

export interface OrganizedDag {
  dag: RailsDagSummary;
  rows: OrganizedRow[];
}

export interface OrganizeOptions {
  agentId?: string;
  maxDags?: number;
}

function byFrontier(a: RailsDagNode, b: RailsDagNode): number {
  const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (d !== 0) return d;
  return a.title.localeCompare(b.title);
}

function organizeOneDag(dag: RailsDagSummary): OrganizedDag {
  const byId = new Map(dag.nodes.map((n) => [n.node_id, n]));
  const children = new Map<string, RailsDagNode[]>();
  const roots: RailsDagNode[] = [];

  for (const node of dag.nodes) {
    const pid = node.parent_node_id;
    if (pid && byId.has(pid)) {
      const list = children.get(pid);
      if (list) list.push(node);
      else children.set(pid, [node]);
    } else {
      // Parentless, or parent filtered out of this view — treat as a root.
      roots.push(node);
    }
  }
  roots.sort(byFrontier);
  for (const list of children.values()) list.sort(byFrontier);

  const rows: OrganizedRow[] = [];

  const emit = (node: RailsDagNode, depth: number) => {
    rows.push({ kind: 'node', node, depth });
    const childDepth = Math.min(depth + 1, RAILS_MAX_DEPTH);
    const doneNodes: RailsDagNode[] = [];
    for (const child of children.get(node.node_id) ?? []) {
      if (child.status === 'DONE') {
        doneNodes.push(child);
      } else {
        emit(child, childDepth);
      }
    }
    if (doneNodes.length > 0) {
      rows.push({
        kind: 'done',
        parentKey: node.node_id,
        depth: childDepth,
        count: doneNodes.length,
        nodes: doneNodes,
      });
    }
  };

  const doneRoots: RailsDagNode[] = [];
  for (const root of roots) {
    if (root.status === 'DONE') doneRoots.push(root);
    else emit(root, 1);
  }
  if (doneRoots.length > 0) {
    rows.push({
      kind: 'done',
      parentKey: '__roots__',
      depth: 1,
      count: doneRoots.length,
      nodes: doneRoots,
    });
  }

  return { dag, rows };
}

/**
 * Nearest-first client-side cap: dags with RUNNING nodes assigned to agentId
 * first, then most ready_count. Stable beyond that.
 */
export function selectDags(
  dags: RailsDagSummary[],
  maxDags: number,
  agentId?: string,
): RailsDagSummary[] {
  const nearness = (d: RailsDagSummary): number =>
    agentId && d.nodes.some((n) => n.status === 'RUNNING' && n.assignee === agentId) ? 1 : 0;
  return [...dags]
    .sort((a, b) => nearness(b) - nearness(a) || b.ready_count - a.ready_count)
    .slice(0, maxDags);
}

export function organizeDagNodes(dto: RailsDagsDto, opts: OrganizeOptions = {}): OrganizedDag[] {
  const dags =
    opts.maxDags !== undefined
      ? selectDags(dto.dags, opts.maxDags, opts.agentId)
      : [...dto.dags];
  return dags.map(organizeOneDag);
}
