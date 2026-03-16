/**
 * PanelHeader Component
 * 
 * Panel header with drag handle, tabs, and action buttons.
 * Integrates with A2R design system for consistent styling.
 * 
 * @module @a2r/platform/shell/panels
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '@/design/tokens';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import type { IconName, PanelTab, PanelAction } from './Panel';

export interface PanelHeaderProps {
  /** Panel title (shown when no tabs) */
  title: string;
  /** Panel icon */
  icon?: IconName;
  /** Whether panel is collapsed */
  isCollapsed: boolean;
  /** Toggle collapse callback */
  onToggleCollapse: () => void;
  /** Tabs configuration */
  tabs?: PanelTab[];
  /** Currently active tab */
  activeTab?: string;
  /** Tab change callback */
  onTabChange?: (tabId: string) => void;
  /** Action buttons */
  actions?: PanelAction[];
  /** Drag start callback */
  onDragStart?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Show border bottom */
  bordered?: boolean;
}

/**
 * PanelHeader - Header component for workspace panels
 * 
 * Features:
 * - Drag handle for reordering
 * - Tab navigation
 * - Action buttons
 * - Collapse toggle
 * - Glass styling
 */
export function PanelHeader(props: PanelHeaderProps) {
  const { 
    title, 
    icon, 
    isCollapsed, 
    onToggleCollapse, 
    tabs, 
    activeTab, 
    onTabChange, 
    actions,
    onDragStart,
    className,
    bordered = true,
  } = props;

  return (
    <div
      className={cn(
        'h-9 flex items-center px-2 select-none',
        bordered && 'border-b border-white/10',
        'bg-black/20',
        className
      )}
    >
      {/* Drag handle */}
      <div
        className="drag-handle cursor-grab active:cursor-grabbing p-1 hover:bg-white/5 rounded transition-colors"
        onMouseDown={onDragStart}
        title="Drag to reorder"
      >
        <Icon name="grip-vertical" size="xs" className="text-muted-foreground opacity-50" />
      </div>

      {/* Title or Tabs */}
      <div className="flex-1 min-w-0 ml-2 overflow-hidden">
        {tabs && !isCollapsed ? (
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => onTabChange?.(tab.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon} size="xs" className="text-muted-foreground" />}
            <span className={cn(
              "text-xs font-medium truncate",
              isCollapsed && "writing-mode-vertical rotate-180"
            )} 
            style={isCollapsed ? { writingMode: 'vertical-rl' } : undefined}>
              {title}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 ml-2">
        {actions?.filter(a => !a.hidden).map(action => (
          <Button
            key={action.id}
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={action.onClick}
            title={action.label}
            disabled={action.disabled}
          >
            <Icon name={action.icon} size="xs" />
          </Button>
        ))}

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <Icon
            name={isCollapsed ? 'chevron-right' : 'chevron-left'}
            size="xs"
          />
        </Button>
      </div>
    </div>
  );
}

/** Individual tab button */
interface TabButtonProps {
  tab: PanelTab;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ tab, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-2 py-1 text-xs rounded-md flex items-center gap-1.5 transition-all',
        'whitespace-nowrap',
        isActive
          ? 'bg-white/10 text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      {tab.icon && <Icon name={tab.icon} size="xs" />}
      <span className="max-w-24 truncate">{tab.label}</span>
      {tab.badge !== undefined && tab.badge > 0 && (
        <span className={cn(
          "ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center",
          isActive ? "bg-white/20" : "bg-red-500/80 text-white"
        )}>
          {tab.badge > 99 ? '99+' : tab.badge}
        </span>
      )}
      
      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute bottom-0 left-1 right-1 h-0.5 bg-sand-400 rounded-full"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  );
}

// Icon component using lucide-react
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

  // Convert kebab-case to PascalCase for icon lookup
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = ((LucideIcons as unknown) as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
    pascalName
  ];

  if (!IconComponent) {
    return <LucideIcons.FileIcon size={sizeMap[size]} className={className} />;
  }

  return <IconComponent size={sizeMap[size]} className={className} />;
}

export default PanelHeader;
