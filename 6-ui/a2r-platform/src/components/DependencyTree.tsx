/**
 * DependencyTree Component
 * 
 * Visual tree view of plugin dependencies with:
 * - Collapsible/expandable nodes
 * - Color coding (green=installed, yellow=optional, red=missing)
 * - Version information on hover
 * - Recursive tree display
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package,
  AlertTriangle,
} from 'lucide-react';
import type { DependencyTreeNode, DependencyResolutionResult } from '../plugins/dependencies';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgElevated: '#1c1917',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
};

// ============================================================================
// Types
// ============================================================================

export interface DependencyTreeProps {
  /** The dependency tree to render */
  tree: DependencyTreeNode | null;
  /** Result of dependency resolution */
  resolution?: DependencyResolutionResult;
  /** Whether to show optional dependencies */
  showOptional?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Maximum depth to render (null for unlimited) */
  maxDepth?: number | null;
  /** Called when a node is clicked */
  onNodeClick?: (pluginId: string) => void;
  /** Called when a node's expand state changes */
  onToggle?: (pluginId: string, expanded: boolean) => void;
  /** Additional class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

interface TreeNodeProps {
  node: DependencyTreeNode;
  depth: number;
  showOptional: boolean;
  maxDepth: number | null;
  expandedNodes: Set<string>;
  onToggle: (pluginId: string) => void;
  onNodeClick?: (pluginId: string) => void;
  hoveredNode: string | null;
  onHover: (pluginId: string | null) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: DependencyTreeNode['status']): string {
  switch (status) {
    case 'installed':
      return THEME.success;
    case 'missing':
      return THEME.danger;
    case 'conflict':
      return THEME.warning;
    case 'optional':
      return THEME.info;
    default:
      return THEME.textTertiary;
  }
}

function getStatusIcon(status: DependencyTreeNode['status']): React.ReactNode {
  const size = 14;
  const color = getStatusColor(status);
  
  switch (status) {
    case 'installed':
      return <CheckCircle2 size={size} color={color} />;
    case 'missing':
      return <AlertCircle size={size} color={color} />;
    case 'conflict':
      return <AlertTriangle size={size} color={color} />;
    case 'optional':
      return <HelpCircle size={size} color={color} />;
    default:
      return <Package size={size} color={color} />;
  }
}

function getStatusLabel(status: DependencyTreeNode['status']): string {
  switch (status) {
    case 'installed':
      return 'Installed';
    case 'missing':
      return 'Missing';
    case 'conflict':
      return 'Version Conflict';
    case 'optional':
      return 'Optional';
    default:
      return 'Unknown';
  }
}

function formatVersionRange(range: string): string {
  if (range === '*') return 'any';
  return range;
}

// ============================================================================
// Tree Node Component
// ============================================================================

function TreeNode({
  node,
  depth,
  showOptional,
  maxDepth,
  expandedNodes,
  onToggle,
  onNodeClick,
  hoveredNode,
  onHover,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.pluginId);
  const isHovered = hoveredNode === node.pluginId;
  const shouldShowChildren = hasChildren && isExpanded && (maxDepth === null || depth < maxDepth);
  
  // Filter children if not showing optional
  const visibleChildren = useMemo(() => {
    if (showOptional) return node.children;
    return node.children.filter(child => child.status !== 'optional');
  }, [node.children, showOptional]);
  
  const handleClick = useCallback(() => {
    if (hasChildren) {
      onToggle(node.pluginId);
    }
    onNodeClick?.(node.pluginId);
  }, [hasChildren, node.pluginId, onToggle, onNodeClick]);
  
  const handleMouseEnter = useCallback(() => {
    onHover(node.pluginId);
  }, [node.pluginId, onHover]);
  
  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);
  
  const statusColor = getStatusColor(node.status);
  const indentWidth = 20;
  
  return (
    <div>
      {/* Node Row */}
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: `6px 12px 6px ${12 + depth * indentWidth}px`,
          backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: hasChildren || onNodeClick ? 'pointer' : 'default',
          width: '100%',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
      >
        {/* Expand/Collapse Icon */}
        <div style={{ width: 16, flexShrink: 0 }}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} color={THEME.textSecondary} />
            ) : (
              <ChevronRight size={14} color={THEME.textSecondary} />
            )
          ) : (
            <div style={{ width: 14 }} />
          )}
        </div>
        
        {/* Status Icon */}
        <div style={{ flexShrink: 0 }}>
          {getStatusIcon(node.status)}
        </div>
        
        {/* Plugin Name */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: THEME.textPrimary,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={node.pluginId}
        >
          {node.pluginId}
        </span>
        
        {/* Version Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: node.status === 'installed' 
              ? 'rgba(34, 197, 94, 0.1)' 
              : node.status === 'missing'
                ? 'rgba(239, 68, 68, 0.1)'
                : node.status === 'conflict'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(59, 130, 246, 0.1)',
            flexShrink: 0,
          }}
          title={`Required: ${formatVersionRange(node.versionRange)} | Installed: ${node.version}`}
        >
          <span
            style={{
              fontSize: 11,
              color: statusColor,
              fontWeight: 500,
            }}
          >
            {node.version}
          </span>
          <span
            style={{
              fontSize: 10,
              color: THEME.textTertiary,
            }}
          >
            ({formatVersionRange(node.versionRange)})
          </span>
        </div>
      </button>
      
      {/* Tooltip on hover */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: 12 + (depth + 1) * indentWidth,
            zIndex: 100,
            padding: '8px 12px',
            backgroundColor: THEME.bgElevated,
            border: `1px solid ${THEME.border}`,
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            marginTop: -4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textPrimary, marginBottom: 4 }}>
            {node.pluginId}
          </div>
          <div style={{ fontSize: 11, color: THEME.textSecondary, marginBottom: 2 }}>
            Status: <span style={{ color: statusColor }}>{getStatusLabel(node.status)}</span>
          </div>
          <div style={{ fontSize: 11, color: THEME.textSecondary, marginBottom: 2 }}>
            Required: {formatVersionRange(node.versionRange)}
          </div>
          <div style={{ fontSize: 11, color: THEME.textSecondary, marginBottom: 2 }}>
            Installed: {node.version}
          </div>
          {node.optional && (
            <div style={{ fontSize: 11, color: THEME.info, marginTop: 4 }}>
              Optional dependency
            </div>
          )}
          {node.children.length > 0 && (
            <div style={{ fontSize: 11, color: THEME.textTertiary, marginTop: 4 }}>
              {node.children.length} sub-dependency{node.children.length !== 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>
      )}
      
      {/* Children */}
      {shouldShowChildren && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.pluginId}
              node={child}
              depth={depth + 1}
              showOptional={showOptional}
              maxDepth={maxDepth}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              hoveredNode={hoveredNode}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Summary Component
// ============================================================================

interface DependencySummaryProps {
  resolution: DependencyResolutionResult;
}

function DependencySummary({ resolution }: DependencySummaryProps) {
  const stats = useMemo(() => {
    let total = 0;
    let installed = 0;
    let missing = 0;
    let conflicts = 0;
    let optional = 0;
    
    function countNode(node: DependencyTreeNode | null) {
      if (!node) return;
      
      if (node.pluginId !== (resolution.tree?.pluginId)) {
        total++;
        switch (node.status) {
          case 'installed':
            installed++;
            break;
          case 'missing':
            missing++;
            break;
          case 'conflict':
            conflicts++;
            break;
          case 'optional':
            optional++;
            break;
        }
      }
      
      for (const child of node.children) {
        countNode(child);
      }
    }
    
    countNode(resolution.tree);
    
    return { total, installed, missing, conflicts, optional };
  }, [resolution]);
  
  if (stats.total === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 6,
          border: `1px solid rgba(34, 197, 94, 0.2)`,
        }}
      >
        <span style={{ fontSize: 12, color: THEME.success }}>
          No dependencies required
        </span>
      </div>
    );
  }
  
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 12px',
        backgroundColor: THEME.bgElevated,
        borderRadius: 6,
        border: `1px solid ${THEME.border}`,
      }}
    >
      <span style={{ fontSize: 12, color: THEME.textSecondary }}>
        {stats.total} total
      </span>
      {stats.installed > 0 && (
        <span style={{ fontSize: 12, color: THEME.success }}>
          {stats.installed} installed
        </span>
      )}
      {stats.missing > 0 && (
        <span style={{ fontSize: 12, color: THEME.danger }}>
          {stats.missing} missing
        </span>
      )}
      {stats.conflicts > 0 && (
        <span style={{ fontSize: 12, color: THEME.warning }}>
          {stats.conflicts} conflicts
        </span>
      )}
      {stats.optional > 0 && (
        <span style={{ fontSize: 12, color: THEME.info }}>
          {stats.optional} optional
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DependencyTree({
  tree,
  resolution,
  showOptional = true,
  defaultExpanded = true,
  maxDepth = null,
  onNodeClick,
  onToggle,
  className,
  style,
}: DependencyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (defaultExpanded && tree) {
      // Expand all nodes by default
      function addAll(node: DependencyTreeNode) {
        set.add(node.pluginId);
        for (const child of node.children) {
          addAll(child);
        }
      }
      addAll(tree);
    } else if (tree) {
      // Only expand root
      set.add(tree.pluginId);
    }
    return set;
  });
  
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  const handleToggle = useCallback((pluginId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
    onToggle?.(pluginId, !expandedNodes.has(pluginId));
  }, [expandedNodes, onToggle]);
  
  const handleHover = useCallback((pluginId: string | null) => {
    setHoveredNode(pluginId);
  }, []);
  
  if (!tree) {
    return (
      <div
        className={className}
        style={{
          padding: 16,
          textAlign: 'center',
          color: THEME.textTertiary,
          fontSize: 13,
          ...style,
        }}
      >
        No dependency information available
      </div>
    );
  }
  
  return (
    <div
      className={className}
      style={{
        backgroundColor: THEME.bg,
        border: `1px solid ${THEME.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header with Summary */}
      {resolution && (
        <div
          style={{
            padding: 12,
            borderBottom: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bgElevated,
          }}
        >
          <DependencySummary resolution={resolution} />
        </div>
      )}
      
      {/* Tree Content */}
      <div style={{ padding: '8px 0', position: 'relative' }}>
        <TreeNode
          node={tree}
          depth={0}
          showOptional={showOptional}
          maxDepth={maxDepth}
          expandedNodes={expandedNodes}
          onToggle={handleToggle}
          onNodeClick={onNodeClick}
          hoveredNode={hoveredNode}
          onHover={handleHover}
        />
      </div>
      
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: '8px 12px',
          borderTop: `1px solid ${THEME.border}`,
          backgroundColor: THEME.bgElevated,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} color={THEME.success} />
          <span style={{ fontSize: 11, color: THEME.textSecondary }}>Installed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} color={THEME.danger} />
          <span style={{ fontSize: 11, color: THEME.textSecondary }}>Missing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} color={THEME.warning} />
          <span style={{ fontSize: 11, color: THEME.textSecondary }}>Conflict</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <HelpCircle size={12} color={THEME.info} />
          <span style={{ fontSize: 11, color: THEME.textSecondary }}>Optional</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

export interface CompactDependencyTreeProps {
  resolution: DependencyResolutionResult;
  showOptional?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function CompactDependencyTree({
  resolution,
  showOptional = false,
  className,
  style,
}: CompactDependencyTreeProps) {
  const stats = useMemo(() => {
    const counts = {
      installed: 0,
      missing: 0,
      conflict: 0,
      optional: 0,
    };
    
    function countNode(node: DependencyTreeNode | null) {
      if (!node) return;
      if (node.pluginId === resolution.tree?.pluginId) {
        for (const child of node.children) {
          countNode(child);
        }
        return;
      }
      
      if (node.status === 'optional' && !showOptional) return;
      
      counts[node.status]++;
      
      for (const child of node.children) {
        countNode(child);
      }
    }
    
    countNode(resolution.tree);
    return counts;
  }, [resolution, showOptional]);
  
  const total = stats.installed + stats.missing + stats.conflict + stats.optional;
  
  if (total === 0) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 6,
          ...style,
        }}
      >
        <CheckCircle2 size={14} color={THEME.success} />
        <span style={{ fontSize: 12, color: THEME.success }}>No dependencies</span>
      </div>
    );
  }
  
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        backgroundColor: THEME.bgElevated,
        borderRadius: 6,
        border: `1px solid ${THEME.border}`,
        ...style,
      }}
    >
      {stats.installed > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} color={THEME.success} />
          <span style={{ fontSize: 11, color: THEME.success }}>{stats.installed}</span>
        </div>
      )}
      {stats.missing > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} color={THEME.danger} />
          <span style={{ fontSize: 11, color: THEME.danger }}>{stats.missing}</span>
        </div>
      )}
      {stats.conflict > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} color={THEME.warning} />
          <span style={{ fontSize: 11, color: THEME.warning }}>{stats.conflict}</span>
        </div>
      )}
      {showOptional && stats.optional > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <HelpCircle size={12} color={THEME.info} />
          <span style={{ fontSize: 11, color: THEME.info }}>{stats.optional}</span>
        </div>
      )}
      <span style={{ fontSize: 11, color: THEME.textTertiary, marginLeft: 4 }}>
        dependencies
      </span>
    </div>
  );
}

export default DependencyTree;
