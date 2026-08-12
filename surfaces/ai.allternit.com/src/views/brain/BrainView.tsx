"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain,
  ArrowLeft,
  ArrowsClockwise,
  Copy,
  Check,
  GitBranch,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast-provider';
import {
  fetchBrains,
  fetchBrainPages,
  createBrain,
  importBrain,
  type BrainSummary,
  type BrainPage,
} from '@/services/brain-api';
import {
  groupPagesByDirectory,
  learningFeed,
  extractBadges,
  type PageBadges,
  type LearningEntry,
} from './brain-utils';

function shortId(id: string): string {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function formatDate(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(iso).toLocaleDateString();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function BadgePills({ badges }: { badges: PageBadges }) {
  const entries: { key: string; label: string }[] = [];
  if (badges.type) entries.push({ key: 'type', label: badges.type });
  if (badges.status) entries.push({ key: 'status', label: badges.status });
  if (badges.domain) entries.push({ key: 'domain', label: badges.domain });
  if (badges.confidence) entries.push({ key: 'confidence', label: `${badges.confidence} confidence` });
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((e) => (
        <Pill key={e.key} size="sm" data-testid={`badge-${e.key}`}>
          {e.label}
        </Pill>
      ))}
    </div>
  );
}

function PageContent({ page }: { page: BrainPage }) {
  if (!page.content.trim()) return null;
  return (
    <div className="allternit-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown>
    </div>
  );
}

function PageCard({ page }: { page: BrainPage }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3">
      <Text variant="code" className="text-[12px] text-[var(--text-secondary)] break-all">
        {page.path}
      </Text>
      <BadgePills badges={extractBadges(page)} />
      <PageContent page={page} />
    </div>
  );
}

function LearningCard({ entry }: { entry: LearningEntry }) {
  const { page, isStale, provenanceRefs, badges } = entry;
  return (
    <div
      data-testid="learning-card"
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3',
        isStale && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Text variant="code" className="text-[12px] text-[var(--text-secondary)] break-all">
          {page.path}
        </Text>
        {isStale && (
          <Pill size="sm" variant="outline" data-testid="stale-pill">
            stale
          </Pill>
        )}
      </div>
      <BadgePills badges={badges} />
      <PageContent page={page} />
      {provenanceRefs.length > 0 && (
        <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border-subtle)]">
          <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            Provenance
          </Text>
          {provenanceRefs.map((ref) => (
            <Text
              key={ref}
              variant="code"
              className="text-[11px] text-[var(--text-tertiary)] break-all"
              data-testid="provenance-ref"
            >
              {ref}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}

function BrainDetail({ brain, onBack }: { brain: BrainSummary; onBack: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['brain-pages', brain.brain_id],
    queryFn: ({ signal }) => fetchBrainPages(brain.brain_id, signal),
  });

  const groups = data ? groupPagesByDirectory(data.pages) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft size={14} />
          All second brains
        </Button>
        <Text variant="code" className="text-[13px] text-[var(--text-secondary)]">
          {shortId(brain.brain_id)}
        </Text>
        {data?.branch && (
          <Pill size="sm" icon={<GitBranch size={11} />}>
            {data.branch}
          </Pill>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width="100%" height={120} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--text-secondary)]">
          <p className="text-sm">Failed to load second brain pages.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowsClockwise size={14} />
            Retry
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="text-[var(--text-tertiary)] mb-4">
            <Brain size={48} />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-1">
            No pages yet
          </h3>
          <p className="text-[13px] text-[var(--text-secondary)] m-0 max-w-xs leading-relaxed">
            This second brain has no markdown pages yet. Commit pages to its git repo and they will appear here.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.directory} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <Text
                variant="label"
                className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-primary)]"
              >
                {group.directory === 'learnings' ? 'Learning Feed' : group.directory}
              </Text>
              <Text variant="caption" className="text-[11px] text-[var(--text-tertiary)]">
                {group.pages.length} {group.pages.length === 1 ? 'page' : 'pages'}
              </Text>
            </div>
            {group.directory === 'learnings' ? (
              <div className="flex flex-col gap-3" data-testid="learning-feed">
                {learningFeed(group.pages).map((entry) => (
                  <LearningCard key={entry.page.path} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {group.pages.map((page) => (
                  <PageCard key={page.path} page={page} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function BrainCard({ brain, onSelect }: { brain: BrainSummary; onSelect: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(brain.clone_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
      className={cn(
        'text-left flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4',
        'transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md cursor-pointer'
      )}
    >
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-[var(--text-tertiary)] shrink-0" />
        <Text variant="code" className="text-[14px] font-semibold text-[var(--text-primary)]">
          {shortId(brain.brain_id)}
        </Text>
      </div>
      <Text variant="caption" className="text-[12px] text-[var(--text-tertiary)]">
        Created {formatDate(brain.created_at)}
      </Text>
      <div className="flex items-center gap-2">
        <Text
          variant="code"
          className="flex-1 min-w-0 text-[11px] text-[var(--text-secondary)] truncate"
          title={brain.clone_url}
        >
          {brain.clone_url}
        </Text>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label={copied ? 'Clone URL copied' : 'Copy clone URL'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function BrainEmptyState({
  onCreate,
  onImport,
  isCreating,
  isImporting,
}: {
  onCreate: () => void;
  onImport: (cloneUrl: string) => void;
  isCreating: boolean;
  isImporting: boolean;
}) {
  const [mode, setMode] = useState<'choose' | 'import'>('choose');
  const [cloneUrl, setCloneUrl] = useState('');

  if (mode === 'import') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="text-[var(--text-tertiary)] mb-4">
          <Brain size={48} />
        </div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-1">
          Import an existing second brain
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] m-0 max-w-xs leading-relaxed mb-5">
          Paste the git clone URL of a brain you already have hosted. It will be cloned to this machine and linked.
        </p>
        <div className="w-full max-w-sm flex flex-col gap-3">
          <Input
            placeholder="https://host.example/your-brain.git"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            disabled={isImporting}
          />
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setMode('choose');
                setCloneUrl('');
              }}
              disabled={isImporting}
            >
              Back
            </Button>
            <Button
              onClick={() => onImport(cloneUrl)}
              disabled={isImporting || !cloneUrl.trim()}
            >
              {isImporting ? 'Importing…' : 'Import repo'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="text-[var(--text-tertiary)] mb-4">
        <Brain size={48} />
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-1">
        No second brain yet
      </h3>
      <p className="text-[13px] text-[var(--text-secondary)] m-0 max-w-xs leading-relaxed mb-5">
        Create a new second brain or import an existing git repo. Your brain is a local-first collection of identity, decisions, runbooks, and ideas.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onCreate} disabled={isCreating}>
          {isCreating ? 'Creating…' : 'Create second brain'}
        </Button>
        <Button variant="outline" onClick={() => setMode('import')} disabled={isCreating}>
          Import existing repo
        </Button>
      </div>
    </div>
  );
}

export function BrainView() {
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: brains, isLoading, isError, refetch } = useQuery({
    queryKey: ['brains'],
    queryFn: ({ signal }) => fetchBrains(signal),
  });

  const createBrainMutation = useMutation({
    mutationFn: createBrain,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['brains'] });
    },
    onError: (error: Error) => {
      addToast({
        title: 'Failed to create second brain',
        description: error.message,
        type: 'error',
      });
    },
  });

  const importBrainMutation = useMutation({
    mutationFn: importBrain,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['brains'] });
      addToast({
        title: 'Second brain imported',
        description: 'The repo was cloned and linked successfully.',
        type: 'success',
      });
    },
    onError: (error: Error) => {
      addToast({
        title: 'Failed to import second brain',
        description: error.message,
        type: 'error',
      });
    },
  });

  const selectedBrain = brains?.find((b) => b.brain_id === selectedBrainId) ?? null;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Second Brain
          </h1>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={120} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--text-secondary)]">
              <p className="text-sm">Failed to load second brains.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <ArrowsClockwise size={14} />
                Retry
              </Button>
            </div>
          ) : selectedBrain ? (
            <BrainDetail brain={selectedBrain} onBack={() => setSelectedBrainId(null)} />
          ) : !brains || brains.length === 0 ? (
            <BrainEmptyState
              onCreate={() => createBrainMutation.mutate()}
              onImport={(url) => importBrainMutation.mutate(url)}
              isCreating={createBrainMutation.isPending}
              isImporting={importBrainMutation.isPending}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {brains.map((brain) => (
                <BrainCard
                  key={brain.brain_id}
                  brain={brain}
                  onSelect={() => setSelectedBrainId(brain.brain_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BrainView;
