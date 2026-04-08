/**
 * Five-Column Layout
 * 
 * Main workspace layout with five columns:
 * DAG Status | Inbox | Terminals | Skills | Mail
 */

import React, { useState } from 'react';
import { TerminalGrid } from './TerminalGrid';
import { useDrawerStore } from '../../drawers/drawer.store';

interface ColumnProps {
  title: string;
  children: React.ReactNode;
  width: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

function Column({ title, children, width, isCollapsed, onToggle }: ColumnProps) {
  if (isCollapsed) {
    return (
      <div
        onClick={onToggle}
        style={{
          width: 32,
          height: '100%',
          background: '#111827',
          borderRight: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: 11,
            fontWeight: 600,
            color: '#9ca3af',
            transform: 'rotate(180deg)',
          }}
        >
          {title}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        height: '100%',
        background: '#111827',
        borderRight: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 40,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #374151',
          background: '#161b22',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6' }}>
          {title}
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 16,
            padding: '4px 8px',
          }}
        >
          ←
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

interface FiveColumnLayoutProps {
  dagStatusColumn: React.ReactNode;
  inboxColumn: React.ReactNode;
  skillsColumn: React.ReactNode;
  mailColumn: React.ReactNode;
  sessionId?: string;
}

export function FiveColumnLayout({
  dagStatusColumn,
  inboxColumn,
  skillsColumn,
  mailColumn,
  sessionId,
}: FiveColumnLayoutProps) {
  const [columns, setColumns] = useState({
    dag: { width: 250, collapsed: false },
    inbox: { width: 280, collapsed: false },
    terminals: { width: 400, collapsed: false },
    skills: { width: 220, collapsed: false },
    mail: { width: 250, collapsed: false },
  });

  const toggleColumn = (key: keyof typeof columns) => {
    setColumns((prev) => ({
      ...prev,
      [key]: { ...prev[key], collapsed: !prev[key].collapsed },
    }));
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: '#0b0f19',
        overflow: 'hidden',
      }}
    >
      {/* Column 1: DAG Status */}
      <Column
        title="DAG Status"
        width={columns.dag.width}
        isCollapsed={columns.dag.collapsed}
        onToggle={() => toggleColumn('dag')}
      >
        {dagStatusColumn || (
          <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>
            DAG execution status will appear here
          </div>
        )}
      </Column>

      {/* Column 2: Inbox */}
      <Column
        title="Inbox"
        width={columns.inbox.width}
        isCollapsed={columns.inbox.collapsed}
        onToggle={() => toggleColumn('inbox')}
      >
        {inboxColumn || (
          <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>
            Agent requests and approvals
          </div>
        )}
      </Column>

      {/* Column 3: Terminals (Flexible width) */}
      <div
        style={{
          flex: 1,
          height: '100%',
          background: '#111827',
          borderRight: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 300,
        }}
      >
        <div
          style={{
            height: 40,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #374151',
            background: '#161b22',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6' }}>
            Terminals
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TerminalGrid sessionId={sessionId} />
        </div>
      </div>

      {/* Column 4: Skills */}
      <Column
        title="Skills"
        width={columns.skills.width}
        isCollapsed={columns.skills.collapsed}
        onToggle={() => toggleColumn('skills')}
      >
        {skillsColumn || (
          <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>
            Portable skills management
          </div>
        )}
      </Column>

      {/* Column 5: Mail */}
      <Column
        title="Mail"
        width={columns.mail.width}
        isCollapsed={columns.mail.collapsed}
        onToggle={() => toggleColumn('mail')}
      >
        {mailColumn || (
          <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>
            Allternit Mail integration
          </div>
        )}
      </Column>
    </div>
  );
}

// Simpler version for integration with existing Shell
export function WorkspaceLayout({ sessionId }: { sessionId?: string }) {
  const { drawers } = useDrawerStore();
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TerminalGrid sessionId={sessionId} />
    </div>
  );
}
