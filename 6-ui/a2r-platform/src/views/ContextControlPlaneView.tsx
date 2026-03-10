/**
 * ContextControlPlaneView
 *
 * UI for Context Control Plane - Git Context Controller (GCC).
 * Manage branches, commits, and context state with real-time synchronization.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  GitBranch, GitCommit, Database, ChevronRight, Plus, Tag,
  Clock, User, FileText, BookOpen, ChevronDown
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
  commitCount: number;
  lastActivity: string;
  icon?: React.ReactNode;
}

interface Commit {
  id: string;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: number;
  status: 'committed' | 'staged' | 'working';
}

interface CommitDetail {
  hash: string;
  fullHash: string;
  author: string;
  date: string;
  message: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
}

const BRANCHES: Branch[] = [
  { id: 'main', name: 'main', isActive: true, commitCount: 142, lastActivity: '2m ago' },
  { id: 'feature/new-models', name: 'feature/new-models', isActive: false, commitCount: 8, lastActivity: '45m ago' },
  { id: 'fix/cowork-render', name: 'fix/cowork-render', isActive: false, commitCount: 5, lastActivity: '3h ago' },
  { id: 'experiment/canvas', name: 'experiment/canvas', isActive: false, commitCount: 12, lastActivity: '1d ago' },
];

const COMMITS: Commit[] = [
  {
    id: 'c1',
    hash: 'a4f8c2e',
    message: 'Refactor: Split canvas protocol types into separate files',
    author: 'Alice Chen',
    timestamp: '2m ago',
    filesChanged: 7,
    status: 'committed',
  },
  {
    id: 'c2',
    hash: 'b9d1e5f',
    message: 'feat: Add hot-reload support to CanvasProtocolView',
    author: 'Bob Smith',
    timestamp: '18m ago',
    filesChanged: 3,
    status: 'committed',
  },
  {
    id: 'c3',
    hash: 'c3e7a2d',
    message: 'fix: Resolve memory leak in HooksSystemView',
    author: 'Charlie Davis',
    timestamp: '45m ago',
    filesChanged: 2,
    status: 'committed',
  },
  {
    id: 'c4',
    hash: 'd6f4b8c',
    message: 'docs: Update README with new view architecture',
    author: 'Alice Chen',
    timestamp: '1h ago',
    filesChanged: 1,
    status: 'committed',
  },
  {
    id: 'c5',
    hash: 'e2c9d1a',
    message: 'test: Add integration tests for FormSurfacesView',
    author: 'Bob Smith',
    timestamp: '2h ago',
    filesChanged: 4,
    status: 'staged',
  },
  {
    id: 'c6',
    hash: 'f1a5e8b',
    message: 'chore: Upgrade dependencies',
    author: 'Charlie Davis',
    timestamp: '3h ago',
    filesChanged: 6,
    status: 'working',
  },
];

const SELECTED_COMMIT_DETAIL: CommitDetail = {
  hash: 'a4f8c2e',
  fullHash: 'a4f8c2e9b3d1e5f2c8a4b9d7e1f3a5c2b8d9e1f',
  author: 'Alice Chen',
  date: '2026-02-26 14:22:15',
  message: 'Refactor: Split canvas protocol types into separate files\n\nExtract canvas-related TypeScript interfaces and types to improve modularity and maintainability.',
  files: [
    { path: 'src/views/CanvasProtocolView.tsx', additions: 45, deletions: 12 },
    { path: 'src/types/canvas.ts', additions: 89, deletions: 0 },
    { path: 'src/types/index.ts', additions: 2, deletions: 0 },
    { path: 'tests/canvas.test.tsx', additions: 34, deletions: 8 },
  ],
};

function BranchItem({ branch }: { branch: Branch }) {
  return (
    <div className={`px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors ${
      branch.isActive ? 'bg-[var(--bg-secondary)] border-l-2 border-l-[var(--accent-primary)]' : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {branch.isActive && (
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          )}
          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
            {branch.name}
          </span>
          {branch.isActive && (
            <span className="ml-auto text-xs text-[var(--accent-primary)] font-semibold px-2 py-0.5 rounded-full bg-rgba(212, 176, 140, 0.1)">
              HEAD
            </span>
          )}
        </div>
        <div className="text-right ml-3">
          <div className="text-xs font-medium text-[var(--text-secondary)]">
            {branch.commitCount} commits
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {branch.lastActivity}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommitRow({ commit }: { commit: Commit }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    committed: { bg: 'rgba(52, 199, 89, 0.08)', text: '#34c759' },
    staged: { bg: 'rgba(255, 159, 10, 0.08)', text: '#ff9f0a' },
    working: { bg: 'rgba(142, 142, 147, 0.08)', text: '#8e8e93' },
  };

  const status = statusColors[commit.status];

  return (
    <div className="px-4 py-4 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold text-[var(--accent-primary)]">
              {commit.hash}
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-md capitalize"
              style={{ backgroundColor: status?.bg, color: status?.text }}
            >
              {commit.status}
            </span>
          </div>
          <p className="text-sm text-[var(--text-primary)] mb-2">
            {commit.message}
          </p>
          <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {commit.timestamp}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {commit.filesChanged} files
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

export function ContextControlPlaneView() {
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Context Control Plane
              </h1>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Git Context Controller (GCC)
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors">
              <Plus className="w-4 h-4" />
              New Branch
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition-opacity">
              <GitCommit className="w-4 h-4" />
              Commit
            </button>
          </div>
        </div>
      </div>

      {/* Main content: 3-column layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Branch sidebar */}
        <div className="w-64 border-r border-[var(--border-subtle)] overflow-auto flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Branches
            </h2>
          </div>

          <div className="flex-1">
            {BRANCHES.map((branch) => (
              <div
                key={branch.id}
                onClick={() => setSelectedBranch(branch.id)}
                className={`cursor-pointer ${selectedBranch === branch.id ? 'bg-[var(--bg-secondary)]' : ''}`}
              >
                <BranchItem branch={branch} />
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <button className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[var(--accent-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-primary)] transition-colors">
              <Plus className="w-3 h-3 inline mr-2" />
              Add Branch
            </button>
          </div>
        </div>

        {/* Center: Commit history */}
        <div className="flex-1 border-r border-[var(--border-subtle)] overflow-auto flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              <GitCommit className="w-4 h-4" />
              Commit History — {BRANCHES.find((b) => b.id === selectedBranch)?.name}
            </h2>
          </div>

          <div className="flex-1 overflow-auto">
            {COMMITS.map((commit) => (
              <CommitRow key={commit.id} commit={commit} />
            ))}
          </div>
        </div>

        {/* Right: Commit details panel */}
        <div className="w-80 border-l border-[var(--border-subtle)] overflow-auto flex flex-col bg-[var(--bg-secondary)]">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Details
            </h2>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-5">
            {/* Hash */}
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                Commit
              </div>
              <div className="font-mono text-xs text-[var(--text-tertiary)] bg-[var(--bg-primary)] p-2 rounded-lg truncate">
                {SELECTED_COMMIT_DETAIL.fullHash}
              </div>
            </div>

            {/* Author & Date */}
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                Author
              </div>
              <div className="text-sm text-[var(--text-primary)]">
                {SELECTED_COMMIT_DETAIL.author}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">
                {SELECTED_COMMIT_DETAIL.date}
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                Message
              </div>
              <div className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {SELECTED_COMMIT_DETAIL.message}
              </div>
            </div>

            {/* Changed files */}
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                Files Changed ({SELECTED_COMMIT_DETAIL.files.length})
              </div>
              <div className="space-y-2">
                {SELECTED_COMMIT_DETAIL.files.map((file, idx) => (
                  <div key={idx} className="text-xs bg-[var(--bg-primary)] p-2.5 rounded-lg">
                    <div className="text-[var(--text-primary)] font-mono mb-1 truncate">
                      {file.path}
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                      <span className="text-green-500">+{file.additions}</span>
                      <span className="text-red-500">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}

export default ContextControlPlaneView;
