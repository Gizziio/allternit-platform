import React from 'react';
import { useSidecarStore } from '../stores/sidecar-store';
import { ChangeSetReview } from '../components/changeset-review/ChangeSetReview';
import {
  FileCode,
  Eye,
  GitDiff,
  Cpu,
  ChatCenteredText,
  X,
} from '@phosphor-icons/react';

export function ArtifactSidecar() {
  const { isOpen, activePanel, width, setOpen, setActivePanel } = useSidecarStore();

  if (!isOpen) return null;

  return (
    <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid var(--border-subtle)',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabButton active={activePanel === 'artifact'} onClick={() => setActivePanel('artifact')} icon={FileCode} title="Artifact" />
          <TabButton active={activePanel === 'preview'} onClick={() => setActivePanel('preview')} icon={Eye} title="Preview" />
          <TabButton active={activePanel === 'changeset'} onClick={() => setActivePanel('changeset')} icon={GitDiff} title="Changes" />
          <TabButton active={activePanel === 'agent'} onClick={() => setActivePanel('agent')} icon={Cpu} title="Agent" />
          <TabButton active={activePanel === 'context'} onClick={() => setActivePanel('context')} icon={ChatCenteredText} title="Context" />
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <SidecarPanel panel={activePanel} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--bg-primary)' : 'transparent',
        color: active ? 'var(--accent-chat)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
    >
      <Icon size={18} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}

function SidecarPanel({ panel }: { panel: string }) {
  const { panels } = useSidecarStore();

  switch (panel) {
    case 'artifact': return <div style={{ padding: 16 }}>Artifact Panel Content</div>;
    case 'preview': return <div style={{ padding: 16 }}>Preview Panel Content</div>;
    case 'changeset':
      return <ChangeSetReview changeSetId={panels.changeset.activeChangeSetId || "cs-legacy-patchgate"} />;
    case 'agent': return <div style={{ padding: 16 }}>Agent Panel Content</div>;
    case 'context': return <div style={{ padding: 16 }}>Context Panel Content</div>;
    default: return null;
  }
}
