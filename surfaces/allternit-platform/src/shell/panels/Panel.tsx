/**
 * WorkspacePanel Component
 * 
 * An individual panel with tabs, collapse support, and glass styling.
 * Integrates with react-resizable-panels and Allternit design system.
 * 
 * @module @allternit/platform/shell/panels
 */

import React, { useState, useCallback } from 'react';
import { Panel as ResizablePanel } from 'react-resizable-panels';
import { PanelHeader } from './PanelHeader';
import { usePanelState } from './usePanelState';
import { cn } from '@/lib/utils';
import { tokens } from '@/design/tokens';
import { motion, AnimatePresence } from 'framer-motion';

/** Icon names (kebab-case, resolved dynamically via phosphor-icons) */
export type IconName = 
  | 'folder' | 'search' | 'settings' | 'terminal' | 'output' | 'alert'
  | 'chat' | 'chevron-left' | 'chevron-right' | 'grip-vertical' | 'more-vertical'
  | 'x' | 'pin' | 'maximize2' | 'minimize2' | 'panel-left' | 'panel-right'
  | 'panel-bottom' | 'code' | 'file-text' | 'git-branch' | 'bug' | 'list'
  | 'layout' | 'type' | 'package' | 'user' | 'users' | 'database' | 'cloud'
  | 'server' | 'shield' | 'key' | 'lock' | 'unlock' | 'eye' | 'eye-off'
  | 'edit' | 'trash' | 'plus' | 'minus' | 'copy' | 'check' | 'refresh-cw'
  | 'play' | 'pause' | 'stop' | 'skip-forward' | 'skip-back' | 'volume-2'
  | 'mic' | 'image' | 'paperclip' | 'send' | 'download' | 'upload'
  | 'external-link' | 'link' | 'unlink' | 'bookmark' | 'star' | 'heart'
  | 'zap' | 'bolt' | 'flame' | 'sparkles' | 'command' | 'hash'
  | 'at-sign' | 'bell' | 'calendar' | 'clock' | 'timer' | 'history'
  | 'home' | 'map' | 'compass' | 'globe' | 'layers' | 'grid'
  | 'columns' | 'rows' | 'sidebar' | 'activity' | 'bar-chart' | 'pie-chart'
  | 'trending-up' | 'trending-down' | 'dollar-sign' | 'credit-card' | 'wallet'
  | 'shopping-cart' | 'tag' | 'percent' | 'award' | 'trophy' | 'medal'
  | 'target' | 'crosshair' | 'focus' | 'aperture' | 'camera' | 'video'
  | 'film' | 'music' | 'radio' | 'cast' | 'airplay' | 'monitor'
  | 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'cpu' | 'hard-drive'
  | 'disc' | 'save' | 'folder-open' | 'file-plus' | 'file-minus' | 'folder-plus'
  | 'folder-minus' | 'archive' | 'inbox' | 'mail' | 'message-square' | 'message-circle'
  | 'phone' | 'phone-call' | 'voicemail' | 'rss' | 'wifi' | 'bluetooth'
  | 'battery' | 'battery-charging' | 'plug' | 'anchor' | 'flag' | 'map-pin'
  | 'navigation' | 'locate' | 'map' | 'compass' | 'sun' | 'moon' | 'cloud'
  | 'cloud-rain' | 'cloud-snow' | 'wind' | 'droplet' | 'thermometer';

/** Tab configuration for panel */
export interface PanelTab {
  id: string;
  label: string;
  icon?: IconName;
  content: React.ReactNode;
  badge?: number;
  closable?: boolean;
}

/** Action button in panel header */
export interface PanelAction {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hidden?: boolean;
}

export interface WorkspacePanelProps {
  /** Unique panel identifier */
  id: string;
  /** Panel title (shown when no tabs) */
  title: string;
  /** Icon for the panel */
  icon?: IconName;
  /** Panel content (when no tabs) */
  children?: React.ReactNode;
  /** Default size percentage */
  defaultSize?: number;
  /** Minimum size percentage */
  minSize?: number;
  /** Maximum size percentage */
  maxSize?: number;
  /** Whether panel can be collapsed */
  collapsible?: boolean;
  /** Size when collapsed (percentage) */
  collapsedSize?: number;
  /** Tabs configuration */
  tabs?: PanelTab[];
  /** Callback when active tab changes */
  onTabChange?: (tabId: string) => void;
  /** Action buttons in header */
  actions?: PanelAction[];
  /** Additional CSS classes */
  className?: string;
  /** Glass intensity for panel surface */
  glassIntensity?: 'thin' | 'base' | 'elevated' | 'thick';
}

/**
 * WorkspacePanel - Resizable panel with tabs and collapse support
 * 
 * @example
 * ```tsx
 * <WorkspacePanel
 *   id="left-sidebar"
 *   title="Explorer"
 *   icon="folder"
 *   defaultSize={20}
 *   tabs={[
 *     { id: 'files', label: 'Files', icon: 'folder', content: <FileTree /> },
 *     { id: 'search', label: 'Search', icon: 'search', content: <Search /> },
 *   ]}
 * />
 * ```
 */
export function WorkspacePanel({
  id,
  title,
  icon,
  children,
  defaultSize = 20,
  minSize = 10,
  maxSize = 80,
  collapsible = true,
  collapsedSize = 5,
  tabs,
  onTabChange,
  actions,
  className,
  glassIntensity = 'thin',
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { getPanelSize, setPanelSize, isPanelCollapsed, setPanelCollapsed } = usePanelState();

  // Sync with persisted state on mount
  React.useEffect(() => {
    const persistedCollapsed = isPanelCollapsed(id);
    if (persistedCollapsed !== undefined) {
      setIsCollapsed(persistedCollapsed);
    }
  }, [id, isPanelCollapsed]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  }, [onTabChange]);

  const handleCollapse = useCallback(() => {
    setIsCollapsed(true);
    setPanelCollapsed(id, true);
  }, [id, setPanelCollapsed]);

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
    setPanelCollapsed(id, false);
  }, [id, setPanelCollapsed]);

  const handleToggleCollapse = useCallback(() => {
    if (isCollapsed) {
      handleExpand();
    } else {
      handleCollapse();
    }
  }, [isCollapsed, handleCollapse, handleExpand]);

  const handleResize = useCallback((size: number) => {
    setPanelSize(id, size);
    // Auto-expand if resized above collapsed threshold
    if (isCollapsed && size > collapsedSize + 5) {
      handleExpand();
    }
  }, [id, isCollapsed, collapsedSize, setPanelSize, handleExpand]);

  const glassConfig = tokens.glass[glassIntensity];
  const currentContent = tabs?.find(t => t.id === activeTab)?.content ?? children;

  return (
    <ResizablePanel
      defaultSize={getPanelSize(id) || defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={handleResize}
      className={cn('flex flex-col overflow-hidden', className)}
      style={{
        background: glassConfig.background,
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      <PanelHeader
        title={title}
        icon={icon}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        actions={actions}
      />
      
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-auto"
            style={{
              // Subtle scrollbar styling
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border-subtle) transparent',
            }}
          >
            {currentContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed state - icon bar */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center py-2 gap-1 overflow-y-auto"
          >
            {tabs?.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  handleTabChange(tab.id);
                  handleExpand();
                }}
                className={cn(
                  'p-2 rounded-lg transition-colors relative',
                  activeTab === tab.id
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted hover:text-foreground hover:bg-white/5'
                )}
                title={tab.label}
              >
                <Icon name={tab.icon || 'file'} size="sm" />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </ResizablePanel>
  );
}

// Icon component using phosphor-icons
import * as PhosphorIcons from '@phosphor-icons/react';

interface IconProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

function Icon({ name, size = 'md', className }: IconProps) {
  const sizeMap = {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
  };

  const IconComponent = ((PhosphorIcons as unknown) as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
    name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  ];

  if (!IconComponent) {
    // Fallback to a generic icon if not found
    return <PhosphorIcons.File size={sizeMap[size]} className={className} />;
  }

  return <IconComponent size={sizeMap[size]} className={className} />;
}

export default WorkspacePanel;
