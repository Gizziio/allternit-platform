"use client";

/**
 * RailsTaskList — shared CommRails WIH DAG surface (web + Fabric PWA).
 *
 * Renders per-dag node trees (frontier-first, done collapsed) with optional
 * interactive Take / Done… write-back. Fail-closed: server down → null.
 *
 * @module RailsTaskList
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowsMerge,
  Check,
  CheckCircle,
  Circle,
  CircleHalf,
  MinusCircle,
  PencilSimple,
  Plus,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GATEWAY_BASE_URL } from "@/lib/agents/api-config";
import {
  DEFAULT_RAILS_AGENT_ID,
  useCloseWih,
  useCreateDagNode,
  useDeleteDagNode,
  usePickupWih,
  useRailsDags,
  useReparentDagNode,
  useUpdateDagNode,
  type RailsDagNode,
  type RailsDagSummary,
  type RailsDagView,
  type RailsNodeStatus,
} from "@/lib/rails/use-rails-dags";
import {
  findRootNodeId,
  organizeDagNodes,
  reparentCandidates,
  dropTargetState,
  type OrganizedDag,
  type OrganizedRow,
} from "./organize";

export interface RailsTaskListProps {
  view: RailsDagView;
  agentId?: string;
  interactive?: boolean;
  compact?: boolean;
  maxDags?: number;
}

function StatusIcon({ status }: { status: RailsNodeStatus }) {
  switch (status) {
    case "DONE":
      return (
        <CheckCircle size={13} weight="fill" className="shrink-0 opacity-60 text-[var(--text-tertiary)]" />
      );
    case "RUNNING":
      return (
        <CircleHalf size={13} weight="fill" className="shrink-0 text-[var(--accent-primary)]" />
      );
    case "FAILED":
      return (
        <XCircle size={13} weight="fill" className="shrink-0 text-[var(--status-error)]" />
      );
    case "READY":
      return <Circle size={13} className="shrink-0 text-[var(--status-success)]" />;
    default:
      return (
        <MinusCircle size={13} className="shrink-0 opacity-60 text-[var(--text-tertiary)]" />
      );
  }
}

function DagRow({
  row,
  dagId,
  dagNodes,
  drag,
  expandedDone,
  onToggleDone,
  agentId,
  interactive,
  pending,
  onTake,
  onCloseDone,
  onFail,
  onRename,
  onDelete,
  onReparent,
  onDragNodeStart,
  onDragNodeEnd,
  onDropReparent,
  moveCandidates,
  currentParentId,
  compact,
}: {
  row: OrganizedRow;
  dagId: string;
  /** All nodes of this row's dag (drop-validity checks). */
  dagNodes: RailsDagNode[];
  /** In-flight drag payload when it belongs to this row's dag. */
  drag: { node_id: string } | null;
  expandedDone: Record<string, boolean>;
  onToggleDone: (key: string) => void;
  agentId: string;
  interactive: boolean;
  pending: boolean;
  onTake: (node: RailsDagNode) => void;
  onCloseDone: (node: RailsDagNode) => void;
  onFail: (node: RailsDagNode) => void;
  onRename: (node: RailsDagNode, title: string) => void;
  onDelete: (node: RailsDagNode) => void;
  onReparent: (node: RailsDagNode, parentNodeId: string | null) => void;
  onDragNodeStart: (node: RailsDagNode) => void;
  onDragNodeEnd: () => void;
  onDropReparent: (draggedNodeId: string, targetNodeId: string | null) => void;
  /** Same-dag nodes valid as a new parent (excludes self + descendants). */
  moveCandidates: RailsDagNode[];
  currentParentId: string | null;
  compact: boolean;
}) {
  const pad = { paddingLeft: row.depth * 16 };
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  if (row.kind === "done") {
    const expanded = expandedDone[row.parentKey] === true;
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleDone(row.parentKey)}
          style={pad}
          className={cn(
            "flex w-full items-center gap-1.5 rounded text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            compact ? "py-0.5" : "py-1"
          )}
        >
          <span>✔ {row.count} done</span>
          <span className={cn("transition-transform", expanded && "rotate-90")}>▸</span>
        </button>
        {expanded && (
          <ul>
            {row.nodes.map((node) => (
              <li
                key={node.node_id}
                style={{ paddingLeft: (row.depth + 1) * 16 }}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] opacity-70",
                  compact ? "py-0.5" : "py-1"
                )}
              >
                <StatusIcon status={node.status} />
                <span className="min-w-0 truncate">{node.title}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  const { node } = row;

  const dropState = drag
    ? dropTargetState(drag.node_id, node.node_id, dagNodes, dagId)
    : "invalid";
  const droppable = drag !== null && dropState !== "invalid";

  const submitEdit = () => {
    const title = editValue.trim();
    setEditing(false);
    if (title.length === 0 || title === node.title) return;
    onRename(node, title);
  };

  const cancelEdit = () => {
    setEditValue("");
    setEditing(false);
  };

  return (
    <li
      style={{
        ...pad,
        outline: dropActive ? "1px dashed var(--accent-primary)" : undefined,
      }}
      draggable={interactive && node.status !== "DONE" && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ dag_id: dagId, node_id: node.node_id })
        );
        e.dataTransfer.effectAllowed = "move";
        onDragNodeStart(node);
      }}
      onDragEnd={() => {
        setDropActive(false);
        onDragNodeEnd();
      }}
      onDragOver={(e) => {
        if (!droppable) {
          if (drag) e.dataTransfer.dropEffect = "none";
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropActive(false);
        if (!droppable || !drag) return;
        onDropReparent(drag.node_id, node.node_id);
      }}
      className={cn("relative flex items-center gap-1.5", compact ? "py-0.5" : "py-1")}
    >
      <StatusIcon status={node.status} />
      {editing ? (
        <input
          ref={editInputRef}
          value={editValue}
          disabled={pending}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={cancelEdit}
          className="min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px]",
            node.status === "DONE"
              ? "text-[var(--text-tertiary)] opacity-70"
              : "text-[var(--text-primary)]"
          )}
        >
          {node.title}
        </span>
      )}
      {interactive && node.status !== "DONE" && !editing && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setEditValue(node.title);
              setEditing(true);
            }}
            aria-label={`Edit task ${node.title}`}
            className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
          >
            <PencilSimple size={11} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMoveOpen((o) => !o)}
            aria-label={`Move task ${node.title}`}
            className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
          >
            <ArrowsMerge size={11} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(node)}
            aria-label={`Delete task ${node.title}`}
            className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--status-error)] disabled:opacity-40"
          >
            <Trash size={11} />
          </button>
        </>
      )}
      {moveOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoveOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] py-1 shadow-xl">
            {currentParentId !== null && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMoveOpen(false);
                  onReparent(node, null);
                }}
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40"
              >
                <ArrowsMerge size={11} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">Move to root</span>
              </button>
            )}
            {moveCandidates.map((c) => (
              <button
                type="button"
                key={c.node_id}
                disabled={pending}
                onClick={() => {
                  setMoveOpen(false);
                  onReparent(node, c.node_id);
                }}
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {c.node_id === currentParentId && (
                  <Check size={11} className="shrink-0 text-[var(--status-success)]" />
                )}
              </button>
            ))}
            {currentParentId === null && moveCandidates.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-[var(--text-tertiary)]">
                Nothing to move to
              </p>
            )}
          </div>
        </>
      )}
      {interactive && node.status === "READY" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onTake(node)}
          className="shrink-0 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
        >
          Take
        </button>
      )}
      {interactive &&
        node.status === "RUNNING" &&
        node.assignee === agentId &&
        node.current_wih_id && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => onCloseDone(node)}
              className="shrink-0 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
            >
              Done…
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onFail(node)}
              className="shrink-0 text-[10px] font-medium text-[var(--status-error)] hover:opacity-80 disabled:opacity-40"
            >
              Fail…
            </button>
          </>
        )}
    </li>
  );
}

function AddTaskRow({
  dag,
  pending,
  onAdd,
}: {
  dag: RailsDagSummary;
  pending: boolean;
  onAdd: (title: string, parentNodeId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootId = findRootNodeId(dag);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (rootId === null) return null;

  const submit = () => {
    const title = value.trim();
    if (title.length === 0) return;
    onAdd(title, rootId);
    setValue("");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setEditing(true)}
        className="mt-0.5 flex w-full items-center gap-1.5 rounded px-1 py-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
      >
        <Plus size={11} />
        Add task
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setValue("");
          setEditing(false);
        }
      }}
      onBlur={() => {
        if (value.trim().length === 0) setEditing(false);
      }}
      placeholder="Task title — Enter to add, Esc to cancel"
      className="mt-0.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
    />
  );
}

export function RailsTaskList({
  view,
  agentId,
  interactive = true,
  compact = false,
  maxDags,
}: RailsTaskListProps) {
  const agent = agentId ?? DEFAULT_RAILS_AGENT_ID;
  const { data } = useRailsDags(view);
  const pickup = usePickupWih();
  const close = useCloseWih();
  const create = useCreateDagNode();
  const update = useUpdateDagNode();
  const remove = useDeleteDagNode();
  const reparent = useReparentDagNode();
  const [expandedDone, setExpandedDone] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  /** In-flight native drag payload (same-dag validated at drop time). */
  const [drag, setDrag] = useState<{ dag_id: string; node_id: string } | null>(null);
  /** Dag section header currently highlighted as a root-drop target. */
  const [rootDropDag, setRootDropDag] = useState<string | null>(null);
  // Write-back probe: if the pickup endpoint is unsupported (405/5xx/network),
  // silently degrade to read-only. 404 means the route answered (unknown node).
  const [writeBackOk, setWriteBackOk] = useState(true);

  useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${GATEWAY_BASE_URL.replace(/\/+$/, "")}/api/commrails/wihs/pickup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              dag_id: "__rails_probe__",
              node_id: "__rails_probe__",
              agent_id: agent,
            }),
          }
        );
        if (cancelled) return;
        setWriteBackOk(res.status !== 405 && res.status < 500);
      } catch {
        if (!cancelled) setWriteBackOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interactive, agent]);

  const organized: OrganizedDag[] = useMemo(
    () =>
      data
        ? organizeDagNodes(data, {
            agentId: agent,
            maxDags: maxDags ?? (compact ? 1 : undefined),
          })
        : [],
    [data, agent, maxDags, compact]
  );

  if (organized.length === 0) return null;

  const canAct = interactive && writeBackOk;
  const pending =
    pickup.isPending ||
    close.isPending ||
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    reparent.isPending;

  const doReparent = (dag: RailsDagSummary, node: RailsDagNode, parentNodeId: string | null) => {
    setActionError(null);
    reparent.mutate(
      {
        dag_id: dag.dag_id,
        node_id: node.node_id,
        parent_node_id: parentNodeId,
      },
      {
        onError: (err) => {
          const status = (err as Error & { status?: number }).status;
          setActionError(
            status === 409
              ? `Cannot move "${node.title}": it would create a cycle`
              : `Move failed for "${node.title}"${status ? ` (${status})` : ""}`
          );
        },
      }
    );
  };

  return (
    <div className={cn("flex min-w-0 flex-col", compact ? "gap-1" : "gap-2")}>
      {organized.map(({ dag, rows }) => (
        <section key={dag.dag_id} className="min-w-0">
          <header
            style={
              rootDropDag === dag.dag_id
                ? { outline: "1px dashed var(--accent-primary)", outlineOffset: 2 }
                : undefined
            }
            onDragOver={(e) => {
              if (!drag || drag.dag_id !== dag.dag_id) {
                if (drag) e.dataTransfer.dropEffect = "none";
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setRootDropDag(dag.dag_id);
            }}
            onDragLeave={() => setRootDropDag((d) => (d === dag.dag_id ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              setRootDropDag(null);
              if (!drag || drag.dag_id !== dag.dag_id) return;
              const dragged = dag.nodes.find((n) => n.node_id === drag.node_id);
              setDrag(null);
              if (!dragged) return;
              doReparent(dag, dragged, null);
            }}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
              {dag.root_title ?? dag.dag_id}
            </span>
            <span className="shrink-0 text-[10px] whitespace-nowrap text-[var(--text-tertiary)]">
              {dag.ready_count} ready · {dag.done_count} done
            </span>
          </header>
          <ul className="min-w-0">
            {rows.map((row, i) => (
              <DagRow
                key={row.kind === "node" ? row.node.node_id : `${row.parentKey}-done-${i}`}
                row={row}
                dagId={dag.dag_id}
                dagNodes={dag.nodes}
                drag={drag && drag.dag_id === dag.dag_id ? drag : null}
                expandedDone={expandedDone}
                onToggleDone={(key) =>
                  setExpandedDone((e) => ({ ...e, [key]: !e[key] }))
                }
                agentId={agent}
                interactive={canAct}
                pending={pending}
                onTake={(node) =>
                  pickup.mutate({ dag_id: dag.dag_id, node_id: node.node_id, agent_id: agent })
                }
                onCloseDone={(node) => {
                  if (!node.current_wih_id) return;
                  const input = window.prompt(`Evidence for closing ${node.title}`);
                  if (input == null || input.trim().length === 0) return;
                  close.mutate({
                    wih_id: node.current_wih_id,
                    status: "DONE",
                    evidence: [input],
                    agent_id: agent,
                  });
                }}
                onFail={(node) => {
                  if (!node.current_wih_id) return;
                  const reason = window.prompt(`Reason for failing ${node.title}`);
                  if (reason == null) return;
                  close.mutate({
                    wih_id: node.current_wih_id,
                    status: "FAILED",
                    evidence: [reason.trim().length > 0 ? reason : "failed from web panel"],
                    agent_id: agent,
                  });
                }}
                onRename={(node, title) =>
                  update.mutate({ dag_id: dag.dag_id, node_id: node.node_id, title })
                }
                onDelete={(node) => {
                  if (!window.confirm(`Delete task "${node.title}"?`)) return;
                  setActionError(null);
                  remove.mutate(
                    { dag_id: dag.dag_id, node_id: node.node_id },
                    {
                      onError: (err) => {
                        const status = (err as Error & { status?: number }).status;
                        setActionError(
                          status === 409
                            ? `Cannot delete "${node.title}": it has active work or unfinished subtasks`
                            : `Delete failed for "${node.title}"${status ? ` (${status})` : ""}`
                        );
                      },
                    }
                  );
                }}
                onReparent={(node, parentNodeId) => doReparent(dag, node, parentNodeId)}
                onDragNodeStart={(node) => setDrag({ dag_id: dag.dag_id, node_id: node.node_id })}
                onDragNodeEnd={() => setDrag(null)}
                onDropReparent={(draggedNodeId, targetNodeId) => {
                  const dragged = dag.nodes.find((n) => n.node_id === draggedNodeId);
                  setDrag(null);
                  if (!dragged) return;
                  doReparent(dag, dragged, targetNodeId);
                }}
                moveCandidates={
                  row.kind === "node"
                    ? reparentCandidates(dag.nodes, row.node.node_id)
                    : []
                }
                currentParentId={row.kind === "node" ? row.node.parent_node_id : null}
                compact={compact}
              />
            ))}
          </ul>
          {actionError && (
            <p className="text-[10px] text-[var(--status-error)]">{actionError}</p>
          )}
          {canAct && (
            <AddTaskRow
              dag={dag}
              pending={pending}
              onAdd={(title, parentNodeId) =>
                create.mutate({ dag_id: dag.dag_id, title, parent_node_id: parentNodeId })
              }
            />
          )}
        </section>
      ))}
    </div>
  );
}

export default RailsTaskList;
