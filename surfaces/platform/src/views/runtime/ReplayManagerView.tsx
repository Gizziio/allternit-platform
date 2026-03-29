"use client";

import React, { useMemo, useState } from 'react';
import {
  ClockCounterClockwise,
  Play,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  MagnifyingGlass,
  Warning,
  Planet,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useReplay } from '@/hooks/useReplay';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';

export function ReplayManagerView() {
  const { manifests, isLoading, error, refetch, replayExecution } = useReplay();
  const [searchQuery, setSearchQuery] = useState('');
  const [captureFilter, setCaptureFilter] = useState<'all' | 'minimal' | 'full'>('all');
  const [replaying, setReplaying] = useState<string | null>(null);

  const filteredManifests = useMemo(() => {
    return manifests.filter((manifest) => {
      if (captureFilter !== 'all' && manifest.capture_level !== captureFilter) {
        return false;
      }

      if (
        searchQuery &&
        !manifest.run_id.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [captureFilter, manifests, searchQuery]);

  const handleReplay = async (runId: string) => {
    setReplaying(runId);
    try {
      await replayExecution(runId);
    } finally {
      setReplaying(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ArrowsClockwise className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Warning className="mb-4 h-12 w-12 text-red-500" />
        <p className="mb-4">Failed to load replay sessions</p>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 rounded-2xl bg-accent/15 px-4 py-2 text-accent transition-colors hover:bg-accent/25"
        >
          <ArrowsClockwise size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.1),transparent_30%)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <GlassSurface intensity="thick" className="rounded-3xl p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <Planet className="h-3.5 w-3.5 text-sky-300" />
                Deterministic Runtime
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Replay Manager</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Inspect captured runtime sessions and replay them against the same execution substrate the TUI records.
              </p>
            </div>

            <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by run ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-accent/50 focus:bg-black/30"
                />
              </div>
              <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1">
                {(['all', 'minimal', 'full'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setCaptureFilter(value)}
                    className={`rounded-xl px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                      captureFilter === value
                        ? 'bg-white/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard icon={ClockCounterClockwise} label="Captured Runs" value={manifests.length} />
          <StatCard
            icon={CheckCircle}
            label="Full Capture"
            value={manifests.filter((manifest) => manifest.capture_level === 'full').length}
          />
          <StatCard
            icon={Clock}
            label="Captured Outputs"
            value={manifests.reduce((total, manifest) => total + manifest.output_count, 0)}
          />
        </div>

        <GlassSurface intensity="thin" className="rounded-3xl p-4 text-sm text-muted-foreground">
          The current API exposes replay execution and capture counts, but not manifest export or delete. This panel reflects those live capabilities directly.
        </GlassSurface>

        <div className="space-y-4">
          {filteredManifests.map((manifest) => (
            <GlassSurface key={manifest.run_id} intensity="base" className="rounded-3xl p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate font-mono text-sm text-foreground">{manifest.run_id}</h3>
                    <StatusBadge
                      status={manifest.capture_level === 'full' ? 'success' : 'pending'}
                      text={`${manifest.capture_level} capture`}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em]">Outputs</div>
                      <div className="mt-1 text-lg font-medium text-foreground">{manifest.output_count}</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em]">Timestamps</div>
                      <div className="mt-1 text-lg font-medium text-foreground">{manifest.timestamp_count}</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em]">Readiness</div>
                      <div className="mt-1 text-lg font-medium text-foreground">
                        {manifest.capture_level === 'none' ? 'Metadata Only' : 'Replayable'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => handleReplay(manifest.run_id)}
                    disabled={replaying === manifest.run_id}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replaying === manifest.run_id ? (
                      <ArrowsClockwise className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    Replay Session
                  </button>
                </div>
              </div>
            </GlassSurface>
          ))}
        </div>

        {filteredManifests.length === 0 && (
          <GlassSurface intensity="thin" className="rounded-3xl p-10 text-center">
            <ClockCounterClockwise className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No replay sessions found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery || captureFilter !== 'all'
                ? 'Clear the filters to inspect the full capture catalog.'
                : 'Run tools or workflows with replay enabled to populate this view.'}
            </p>
          </GlassSurface>
        )}
      </div>
    </div>
  );
}
