'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Warning,
  CircleNotch,
  ArrowsClockwise,
  Rocket,
  Clock,
  XCircle,
} from '@phosphor-icons/react';
import { useModelLabStore } from '@/lib/model-lab/store';
import type { ModelJob } from '@/lib/model-lab/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function statusIcon(status: ModelJob['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={18} weight="fill" className="text-green-500" />;
    case 'failed':
      return <XCircle size={18} weight="fill" className="text-red-500" />;
    case 'running':
      return <CircleNotch size={18} className="text-[var(--accent-primary)] animate-spin" />;
    case 'cancelled':
      return <XCircle size={18} weight="fill" className="text-[var(--text-tertiary)]" />;
    default:
      return <Clock size={18} className="text-[var(--text-tertiary)]" />;
  }
}

function statusBadge(status: ModelJob['status']) {
  const variant =
    status === 'completed'
      ? 'default'
      : status === 'failed' || status === 'cancelled'
      ? 'destructive'
      : 'secondary';
  return (
    <Badge variant={variant} className="uppercase text-[10px]">
      {status}
    </Badge>
  );
}

export function JobsMonitor(): React.ReactNode {
  const {
    jobs,
    jobsLoading,
    jobsError,
    fetchJobs,
    importModel,
    engineLoading,
    setActiveTab,
  } = useModelLabStore();

  const [servingJobId, setServingJobId] = useState<string | null>(null);
  const [serveError, setServeError] = useState<string | null>(null);

  const handleServeLocally = async (job: ModelJob) => {
    if (!job.output_model_path) return;
    setServingJobId(job.id);
    setServeError(null);
    try {
      await importModel(job.output_model_path, job.model_id);
      setActiveTab('engine');
    } catch (error) {
      setServeError(error instanceof Error ? error.message : 'Serve locally failed');
    } finally {
      setServingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Training Jobs</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Track Unsloth fine-tuning and export jobs. Completed jobs can be imported into the Local Engine.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchJobs()}
          disabled={jobsLoading}
        >
          <ArrowsClockwise size={14} className={jobsLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {jobsError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to load jobs</p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">{jobsError}</p>
          </div>
        </div>
      )}

      {serveError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Serve locally failed</p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">{serveError}</p>
          </div>
        </div>
      )}

      {jobsLoading && jobs.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <CircleNotch size={32} className="animate-spin text-[var(--accent-primary)]" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]">
          <p className="text-sm text-[var(--text-tertiary)]">No jobs yet.</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Start a training run from the Train tab to see it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => {
            const canServe = job.status === 'completed' && Boolean(job.output_model_path);
            return (
              <div
                key={job.id}
                className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="shrink-0">{statusIcon(job.status)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {job.model_id}
                      </span>
                      {statusBadge(job.status)}
                      <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-bold">
                        {job.type}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      <span>ID: {job.id}</span>
                      {job.created_at && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{new Date(job.created_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                    {job.error && (
                      <p className="text-xs text-red-500 mt-1 break-words">{job.error}</p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {canServe ? (
                    <Button
                      size="sm"
                      disabled={servingJobId === job.id || engineLoading}
                      onClick={() => void handleServeLocally(job)}
                    >
                      {servingJobId === job.id ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <Rocket size={14} />
                      )}
                      {servingJobId === job.id ? 'Importing…' : 'Serve locally'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      {job.status === 'completed' ? 'No output path' : 'Not ready'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default JobsMonitor;
