"use client";

import React from 'react';
import { GitCommit, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  children: TreeNode[];
  parentId?: string;
  isActive?: boolean;
}

interface ConversationTreeProps {
  rootNode: TreeNode;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

const THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  userAccent: '#3b82f6',
  bg: '#2B2520',
  nodeBg: 'rgba(255,255,255,0.03)',
  activeNodeBg: 'rgba(212,149,106,0.1)',
  border: 'rgba(255,255,255,0.08)',
  activeBorder: 'rgba(212,149,106,0.3)',
  line: 'rgba(255,255,255,0.1)',
};

/**
 * Visual tree visualization of conversation branches
 */
export function ConversationTree({
  rootNode,
  onNodeClick,
  className,
}: ConversationTreeProps) {
  const renderNode = (node: TreeNode, depth: number = 0, isLast: boolean = true) => {
    const hasChildren = node.children.length > 0;
    const isBranchPoint = node.children.length > 1;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Node */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Connection line */}
          {depth > 0 && (
            <div
              style={{
                width: 24,
                height: 24,
                marginTop: 12,
                borderLeft: `2px solid ${isLast ? 'transparent' : THEME.line}`,
                borderBottom: `2px solid ${THEME.line}`,
                borderBottomLeftRadius: 8,
              }}
            />
          )}

          {/* Node content */}
          <button
            onClick={() => onNodeClick?.(node.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 14px',
              marginLeft: depth > 0 ? 0 : 0,
              marginTop: 8,
              borderRadius: 10,
              border: `1px solid ${node.isActive ? THEME.activeBorder : THEME.border}`,
              background: node.isActive ? THEME.activeNodeBg : THEME.nodeBg,
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: 280,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!node.isActive) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }
            }}
            onMouseLeave={(e) => {
              if (!node.isActive) {
                e.currentTarget.style.background = THEME.nodeBg;
              }
            }}
          >
            {/* Role icon */}
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background:
                  node.role === 'user'
                    ? 'rgba(59,130,246,0.15)'
                    : 'rgba(212,149,106,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {node.role === 'user' ? (
                <User size={12} style={{ color: THEME.userAccent }} />
              ) : (
                <MessageSquare size={12} style={{ color: THEME.accent }} />
              )}
            </div>

            {/* Content preview */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  color: node.isActive ? THEME.textPrimary : THEME.textSecondary,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                }}
              >
                {node.content.slice(0, 60)}
                {node.content.length > 60 ? '...' : ''}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: THEME.textMuted,
                  margin: '4px 0 0',
                }}
              >
                {new Date(node.timestamp).toLocaleTimeString()}
              </p>
            </div>

            {/* Branch indicator */}
            {isBranchPoint && (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: 'rgba(212,149,106,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GitCommit size={10} style={{ color: THEME.accent }} />
              </div>
            )}
          </button>
        </div>

        {/* Children */}
        {hasChildren && (
          <div
            style={{
              marginLeft: depth > 0 ? 24 : 0,
              paddingLeft: depth > 0 ? 0 : 0,
              borderLeft: `2px solid ${THEME.line}`,
            }}
          >
            {node.children.map((child, index) =>
              renderNode(child, depth + 1, index === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        padding: 16,
        background: THEME.bg,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        maxHeight: 500,
        overflow: 'auto',
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: THEME.textSecondary,
          margin: '0 0 12px',
        }}
      >
        Conversation Tree
      </h3>
      {renderNode(rootNode)}
    </div>
  );
}

export type { TreeNode };
