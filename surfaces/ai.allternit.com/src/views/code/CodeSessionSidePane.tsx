"use client";

import React, { useState } from 'react';
import { FolderSimple, GitDiff, Package, Scroll, Terminal, X } from '@phosphor-icons/react';
import { CodeDiffPanel } from './CodeDiffPanel';
import { CodeFileEditor } from './CodeFileEditor';
import { ExplorerView } from './ExplorerView';
import { CodeAciPane } from './CodeAciPane';
import { CodeTranscriptPane } from './CodeTranscriptPane';
import { UnifiedTerminal } from '@/components/workspace/UnifiedTerminal';
import { ArtifactCenter } from './ArtifactCenter';

type SidePaneTab = 'artifacts' | 'files' | 'terminal' | 'diff' | 'aci' | 'transcript';

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
  onClose?: () => void;
}

/**
 * Focused right-hand pane opened by the floating session launcher.
 * Each target owns its content and local controls; navigation is not duplicated here.
 */
export function CodeSessionSidePane({ activeTab: controlledTab, onTabChange, sessionId, workingDir, terminalContext, onClose }: CodeSessionSidePaneProps): React.ReactNode {
  const [internalTab, setInternalTab] = useState<SidePaneTab>('terminal');
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
  const paneMeta = activeTab === 'terminal'
    ? { label: 'Terminal', icon: Terminal }
    : activeTab === 'diff'
      ? { label: `Working tree${workingDir ? ` · ${workingDir.split('/').pop()}` : ''}`, icon: GitDiff }
      : activeTab === 'artifacts'
        ? { label: 'Artifacts', icon: Package }
        : activeTab === 'transcript'
          ? { label: 'Transcript', icon: Scroll }
          : { label: 'Files', icon: FolderSimple };
  const PaneIcon = paneMeta.icon;

  if (activeTab === 'aci') {
    return <CodeAciPane onClose={() => onClose?.()} />;
  }

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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 40,
          padding: '0 7px 0 11px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        <PaneIcon size={16} weight="duotone" style={{ color: 'var(--accent-code)' }} />
        <span style={{ fontSize: 12, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paneMeta.label}</span>
        {onClose ? (
          <button
            type="button"
            aria-label="Close workspace panel"
            data-testid="code-side-pane-close"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              marginLeft: 'auto',
              borderRadius: 9,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        ) : null}
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
            <ExplorerView rootPath={workingDir} onOpenFile={openFile} />
          )}
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'diff' ? 'flex' : 'none', flexDirection: 'column' }}>
          <CodeDiffPanel workingDir={workingDir} />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
          <UnifiedTerminal sessionId={sessionId ?? 'allternit-session'} workingDir={workingDir} terminalContext={terminalContext} />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'artifacts' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ArtifactCenter />
        </div>
        <div className="code-side-fill" style={{ flex: 1, minHeight: 0, display: activeTab === 'transcript' ? 'flex' : 'none', flexDirection: 'column' }}>
          <CodeTranscriptPane sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}
