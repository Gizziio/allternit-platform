/**
 * coworkTeamBridge.ts
 *
 * Three responsibilities:
 *  1. PRD → board items: parsePRDToItems() calls the AI parse-prd route and
 *     bulk-creates items into useBoardStore with resolved dependencies.
 *  2. Task expansion: expandBoardItem() breaks a single item into subtasks.
 *  3. Status bridge: maps between BoardItem status and CoworkStore Task status.
 */

import type { BoardItem, CreateBoardItemInput } from '@/stores/board.store';
import type { Task } from '@/views/cowork/CoworkStore';

type CoworkBoardItem = BoardItem;
type BoardItemStatus = BoardItem['status'];

const STATUS_MAP: Record<BoardItemStatus, Task['status']> = {
  backlog: 'pending',
  todo: 'pending',
  in_progress: 'in_progress',
  in_review: 'in_progress',
  done: 'completed',
  blocked: 'pending',
};

const REVERSE_STATUS_MAP: Record<Task['status'], BoardItemStatus> = {
  pending: 'todo',
  in_progress: 'in_progress',
  completed: 'done',
  archived: 'done',
};

/**
 * Converts a cowork-team board item into a CoworkStore Task.
 * Use this when an agent picks up a board item to run a cowork session on it.
 */
export function bridgeToCoworkTask(item: CoworkBoardItem): Omit<Task, 'createdAt' | 'updatedAt'> {
  return {
    id: `board-${item.id}`,
    title: item.title,
    mode: item.assigneeType === 'agent' ? 'agent' : 'task',
    projectId: item.workspaceId,
    status: STATUS_MAP[item.status] ?? 'pending',
    workspaceId: item.workspaceId,
    assigneeType: item.assigneeType,
    assigneeId: item.assigneeId,
    priority: item.priority,
    description: item.description,
  };
}

/**
 * Maps a completed CoworkStore task status back to a board item status patch.
 * Call this when a session ends to update the board.
 */
export function bridgeCompletionToBoard(
  task: Pick<Task, 'id' | 'status'>
): { status: BoardItemStatus } {
  return {
    status: REVERSE_STATUS_MAP[task.status] ?? 'in_progress',
  };
}

/**
 * Returns the board item ID from a bridged task ID.
 * Bridged tasks have id prefix "board-".
 */
export function getBoardItemIdFromTask(taskId: string): string | null {
  if (taskId.startsWith('board-')) return taskId.slice(6);
  return null;
}

/**
 * Returns true if this task was bridged from a board item.
 */
export function isBridgedTask(taskId: string): boolean {
  return taskId.startsWith('board-');
}

// ─── PRD Parsing ──────────────────────────────────────────────────────────────

type ParsedItemRaw = CreateBoardItemInput & {
  tempId: string;
  dependencyTempIds: string[];
};

export interface ParsePRDResult {
  summary: string;
  items: ParsedItemRaw[];
}

/**
 * Calls the server-side AI parser and returns structured items with temp IDs.
 * Does NOT write to the store — call bulkCreateFromPRD for that.
 */
export async function parsePRD(
  description: string,
  opts?: { existingTitles?: string[]; maxTasks?: number; modelId?: string },
): Promise<ParsePRDResult> {
  const res = await fetch('/api/v1/cowork-team/parse-prd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Creates all parsed items in the board store and wires up dependency IDs.
 * Returns the created BoardItems in creation order.
 *
 * @param workspaceId  Target workspace
 * @param items        Raw items from parsePRD()
 * @param createItem   useBoardStore().createItem — pass from caller to avoid hook rules
 * @param updateItem   useBoardStore().updateItem
 */
export async function bulkCreateFromPRD(
  workspaceId: string,
  items: ParsedItemRaw[],
  createItem: (workspaceId: string, input: CreateBoardItemInput) => Promise<BoardItem | null>,
  updateItem: (id: string, updates: Partial<BoardItem>) => Promise<void>,
): Promise<BoardItem[]> {
  const tempIdToRealId = new Map<string, string>();
  const created: BoardItem[] = [];

  // Sort by dependency depth so parents are always created before children
  const sorted = topoSort(items);

  for (const item of sorted) {
    const { tempId, dependencyTempIds, ...input } = item;
    const board = await createItem(workspaceId, input);
    if (!board) continue;
    tempIdToRealId.set(tempId, board.id);
    created.push(board);
  }

  // Second pass: wire resolved dependencies
  for (const item of sorted) {
    const realId = tempIdToRealId.get(item.tempId);
    if (!realId) continue;
    const resolvedDeps = item.dependencyTempIds
      .map((tid) => tempIdToRealId.get(tid))
      .filter((id): id is string => id !== undefined);
    if (resolvedDeps.length > 0) {
      await updateItem(realId, { dependencies: resolvedDeps });
    }
  }

  return created;
}

/**
 * Topological sort of parsed items so dependencies are created first.
 * Falls back to stable order on cycles (shouldn't happen with well-behaved AI output).
 */
function topoSort(items: ParsedItemRaw[]): ParsedItemRaw[] {
  const byTempId = new Map(items.map((i) => [i.tempId, i]));
  const visited = new Set<string>();
  const result: ParsedItemRaw[] = [];

  function visit(tempId: string) {
    if (visited.has(tempId)) return;
    visited.add(tempId);
    const item = byTempId.get(tempId);
    if (!item) return;
    for (const dep of item.dependencyTempIds) visit(dep);
    result.push(item);
  }

  for (const item of items) visit(item.tempId);
  return result;
}

// ─── Task Expansion ───────────────────────────────────────────────────────────

/**
 * Asks the AI to break a single board item into subtasks.
 * Returns parsed items (no dependencies across subtasks — they're all children of parent).
 */
export async function expandBoardItem(
  item: Pick<BoardItem, 'id' | 'title' | 'description'>,
  opts?: { maxTasks?: number; modelId?: string },
): Promise<ParsePRDResult> {
  const description =
    `Break down this task into subtasks:\n\nTitle: ${item.title}` +
    (item.description ? `\nDescription: ${item.description}` : '');
  return parsePRD(description, { maxTasks: opts?.maxTasks ?? 8, modelId: opts?.modelId });
}
