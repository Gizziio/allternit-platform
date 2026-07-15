"use client";

import React, { useState } from 'react';
import { FolderSimple, Globe, Terminal, GitBranch, FileCode } from '@phosphor-icons/react';
import { CodePreviewPane } from './CodePreviewPane';
import { CodeDiffPanel } from './CodeDiffPanel';
import { CodeFileEditor } from './CodeFileEditor';
import { ExplorerView } from './ExplorerView';
import GitView from './GitView';
import { UnifiedTerminal } from '@/components/workspace/UnifiedTerminal';

type SidePaneTab = 'files' | 'preview' | 'terminal' | 'git' | 'diff';

const TABS: { id: SidePaneTab; label: string; icon: typeof FolderSimple }[] = [
  { id: 'files', label: 'Files', icon: FolderSimple },
  { id: 'diff', label: 'Diff', icon: FileCode },
  { id: 'preview', label: 'Preview', icon: Globe },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'git', label: 'Git', icon: GitBranch },
];

interface TerminalContext {
  repoName?: string;
  branch?: string;
  shortSha?: string;
}

interface CodeSessionSidePaneProps {
  activeTab?: SidePaneTab;
  onTabChange?: (tab: SidePaneTab) => void;
  sessionId?: string;
  workingDir?: string;
  terminalContext?: TerminalContext;
}

/**
 * Right-hand pane for an active code session: turns code mode into a real
 * coding session (like Claude Code / Codex desktop) instead of a bare chat
 * thread — workspace files, live preview, terminal, and git one click away.
 * Tabs are keep-alive so the terminal session and preview survive switching.
 */
export function CodeSessionSidePane({ activeTab: controlledTab, onTabChange, sessionId, workingDir, terminalContext }: CodeSessionSidePaneProps): React.ReactNode {
  const [internalTab, setInternalTab] = useState<SidePaneTab>('files');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: SidePaneTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const openFile = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab('files');
  };
  const closeFile = () => setSelectedFilePath(null);

  return (
    <div
      data-testid="code-session-side-pane"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        role="tablist"
        aria-label="Code session panels"
        style={{
          display: 'flex',
          gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`code-side-tab-${id}`}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 28,
                padding: '0 10px',
                borderRadius: 9,
                border: 'none',
                background: active ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon size={13} weight={active ? 'fill' : 'regular'} />
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* GlassSurface-based panels render at content height by default;
            force direct children to fill the pane so the file tree / git /
            terminal stretch the full session height. */}
        <style>{`.code-side-fill > * { flex: 1 1 auto; min-height: 0; }`}</style>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'files' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedFilePath ? (
            <CodeFileEditor filePath={selectedFilePath} onClose={closeFile} />
          ) : (
            <ExplorerView onOpenFile={openFile} />
          )}
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'diff' ? 'flex' : 'none', flexDirection: 'column' }}>
          <CodeDiffPanel />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column' }}>
          <CodePreviewPane />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column', background: '#0d1117' }}>
          <UnifiedTerminal sessionId={sessionId ?? 'allternit-session'} workingDir={workingDir} terminalContext={terminalContext} />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'git' ? 'flex' : 'none', flexDirection: 'column', overflow: 'auto' }}>
          <GitView />
        </div>
      </div>
    </div>
  );
}
