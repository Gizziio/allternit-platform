"use client";

import React, { useMemo, useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import {
  GitBranch,
  Play,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  Clock,
  CircleNotch,
  StackSimple,
  Sparkle,
  Pulse as Activity,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { StatusBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import Link from 'next/link';

export function WorkflowListView() {
  const { workflows, isLoading, executeWorkflow, deleteWorkflow } = useWorkflow();
  const [executing, setExecuting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWorkflows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return workflows.filter((workflow) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        workflow.name.toLowerCase().includes(normalizedQuery) ||
        workflow.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [searchQuery, workflows]);

  const activeCount = workflows.filter((workflow) => workflow.status === 'active').length;
  const draftCount = workflows.filter((workflow) => workflow.status === 'draft').length;
  const nodeCount = workflows.reduce((total, workflow) => total + (workflow.node_count || 0), 0);

  const handleDelete = async (id: string) => {
    await deleteWorkflow(id);
  };

  const handleExecute = async (id: string) => {
    setExecuting(id);
    try {
      await executeWorkflow(id);
    } finally {
      setExecuting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(67,217,173,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_32%)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <GlassSurface intensity="thick" className="rounded-3xl p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkle className="h-3.5 w-3.5 text-accent" />
                Workflow Control Plane
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Workflows</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Execute the same orchestration substrate the TUI uses, with runtime-backed status and launch controls.
              </p>
            </div>

            <div className="relative w-full max-w-md">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workflows, descriptions, and intent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-accent/50 focus:bg-black/30"
              />
            </div>
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard icon={GitBranch} label="Registered" value={workflows.length} />
          <StatCard icon={Activity} label="Active" value={activeCount} trend={activeCount > 0 ? 'up' : 'neutral'} />
          <StatCard icon={StackSimple} label="Total Nodes" value={nodeCount} />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredWorkflows.map((workflow) => {
            const workflowId = workflow.id || workflow.workflow_id;
            const workflowStatus = workflow.status || 'draft';
            const lastExecuted = workflow.last_executed || workflow.last_executed_at;

            return (
              <GlassSurface
                key={workflowId}
                intensity="base"
                className="group rounded-3xl border border-white/5 p-5 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-3">
                      <GitBranch className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-medium text-foreground">{workflow.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        v{workflow.version}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                    <Link href={`/workflows/${workflowId}/designer`}>
                      <button
                        className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                        aria-label={`Edit ${workflow.name}`}
                      >
                        <PencilSimple size={16} />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(workflowId)}
                      className="rounded-xl p-2 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Delete ${workflow.name}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>

                <p className="mt-4 min-h-[3rem] text-sm leading-6 text-muted-foreground">
                  {workflow.description || 'No description provided for this workflow.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={workflowStatus === 'active' ? 'success' : workflowStatus === 'draft' ? 'warning' : 'pending'}
                    text={workflowStatus}
                  />
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">
                    {(workflow.node_count || 0).toString()} nodes
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">
                    {(workflow.execution_count || 0).toString()} runs
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {lastExecuted ? new Date(lastExecuted).toLocaleDateString() : 'Never executed'}
                  </span>
                  <button
                    onClick={() => handleExecute(workflowId)}
                    disabled={executing === workflowId}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {executing === workflowId ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    Execute
                  </button>
                </div>
              </GlassSurface>
            );
          })}
        </div>

        {filteredWorkflows.length === 0 && (
          <GlassSurface intensity="thin" className="rounded-3xl p-10 text-center">
            <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No workflows found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery
                ? 'Try a broader search term or clear the filter.'
                : 'Create a workflow to start driving DAG execution from the GUI.'}
            </p>
            {!searchQuery && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-muted-foreground">
                <Sparkle className="h-4 w-4 text-accent" />
                Workflow designer wiring is now aligned with the live `/api/v1/workflows` surface.
              </div>
            )}
          </GlassSurface>
        )}

        {workflows.length > 0 && (
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {draftCount} draft workflows ready for refinement
          </div>
        )}
      </div>
    </div>
  );
}
