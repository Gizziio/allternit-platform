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
  CheckCircle,
  Circle,
  CircleHalf,
  MinusCircle,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GATEWAY_BASE_URL } from "@/lib/agents/api-config";
import {
  DEFAULT_RAILS_AGENT_ID,
  useCloseWih,
  usePickupWih,
  useRailsDags,
  type RailsDagNode,
  type RailsDagView,
  type RailsNodeStatus,
} from "@/lib/rails/use-rails-dags";
import { organizeDagNodes, type OrganizedDag, type OrganizedRow } from "./organize";

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
  expandedDone,
  onToggleDone,
  agentId,
  interactive,
  pending,
  onTake,
  onCloseDone,
  compact,
}: {
  row: OrganizedRow;
  expandedDone: Record<string, boolean>;
  onToggleDone: (key: string) => void;
  agentId: string;
  interactive: boolean;
  pending: boolean;
  onTake: (node: RailsDagNode) => void;
  onCloseDone: (node: RailsDagNode) => void;
  compact: boolean;
}) {
  const pad = { paddingLeft: row.depth * 16 };

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
  return (
    <li style={pad} className={cn("flex items-center gap-1.5", compact ? "py-0.5" : "py-1")}>
      <StatusIcon status={node.status} />
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
          <button
            type="button"
            disabled={pending}
            onClick={() => onCloseDone(node)}
            className="shrink-0 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
          >
            Done…
          </button>
        )}
    </li>
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
  const [expandedDone, setExpandedDone] = useState<Record<string, boolean>>({});
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
  const pending = pickup.isPending || close.isPending;

  return (
    <div className={cn("flex min-w-0 flex-col", compact ? "gap-1" : "gap-2")}>
      {organized.map(({ dag, rows }) => (
        <section key={dag.dag_id} className="min-w-0">
          <header className="flex items-baseline justify-between gap-2">
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
                    status: "done",
                    evidence: [input],
                    agent_id: agent,
                  });
                }}
                compact={compact}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default RailsTaskList;
