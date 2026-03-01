/**
 * WIH: T2-A2
 * Agent: T2-A2 (Navigation System)
 * Scope: 6-ui/a2r-platform/src/shell/navigation/CommandPalette.tsx
 * Acceptance: Command palette with kbar integration, glassmorphism UI, shortcut support
 * Risk Tier: 2
 * Dependencies: kbar, design tokens, Icon component (T1-A5)
 */

import React, { useMemo } from 'react';
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  useMatches,
  KBarResults,
  Action,
} from 'kbar';
import { cn } from '@/lib/utils';
import { tokens } from '@/design/tokens';

// Icon type from T1-A5 Icons
export type IconName = 
  | 'home' 
  | 'settings' 
  | 'chat' 
  | 'agent' 
  | 'workflow' 
  | 'add' 
  | 'search' 
  | 'sun' 
  | 'moon' 
  | 'maximize' 
  | 'minimize' 
  | 'close' 
  | 'back' 
  | 'forward' 
  | 'chevronRight' 
  | 'slash' 
  | 'arrow' 
  | 'more' 
  | 'command' 
  | 'keyboard';

interface CommandAction {
  id: string;
  name: string;
  shortcut?: string[];
  keywords?: string;
  perform: () => void;
  icon?: IconName;
  subtitle?: string;
  section?: string;
}

interface CommandPaletteProps {
  children: React.ReactNode;
  actions?: CommandAction[];
}

// Simple icon renderer - integrates with T1-A5
function CommandIcon({ name, size = 'sm' }: { name: IconName; size?: 'xs' | 'sm' | 'md' }) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  // Icon SVGs - can be replaced with actual Icon component from T1-A5
  const iconPaths: Record<IconName, React.ReactNode> = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    agent: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></>,
    workflow: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    add: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    sun: <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>,
    minimize: <><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></>,
    close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    back: <polyline points="15 18 9 12 15 6" />,
    forward: <polyline points="9 18 15 12 9 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    slash: <line x1="16" y1="4" x2="8" y2="20" />,
    arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    more: <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
    command: <><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" /></>,
    keyboard: <><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="6" y1="8" x2="6" y2="8.01" /><line x1="10" y1="8" x2="10" y2="8.01" /><line x1="14" y1="8" x2="14" y2="8.01" /><line x1="18" y1="8" x2="18" y2="8.01" /><line x1="8" y1="12" x2="8" y2="12.01" /><line x1="12" y1="12" x2="12" y2="12.01" /><line x1="16" y1="12" x2="16" y2="12.01" /><line x1="7" y1="16" x2="17" y2="16" /></>,
  };

  return (
    <svg 
      className={cn(sizeClasses[size], 'text-current')} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {iconPaths[name] || iconPaths.command}
    </svg>
  );
}

function transformAction(action: CommandAction): Action {
  return {
    id: action.id,
    name: action.name,
    shortcut: action.shortcut,
    keywords: action.keywords,
    section: action.section,
    perform: action.perform,
    icon: action.icon,
    subtitle: action.subtitle,
  };
}

export function CommandPaletteProvider({ children, actions = [] }: CommandPaletteProps) {
  const kbarActions = useMemo(() => actions.map(transformAction), [actions]);

  return (
    <KBarProvider actions={kbarActions}>
      <CommandPalettePortal />
      {children}
    </KBarProvider>
  );
}

function CommandPalettePortal() {
  return (
    <KBarPortal>
      <KBarPositioner 
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        <KBarAnimator 
          className="w-full max-w-2xl overflow-hidden rounded-lg shadow-2xl"
          style={{
            background: tokens.glass.elevated.background,
            backdropFilter: `blur(${tokens.glass.elevated.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.elevated.blur})`,
            border: tokens.glass.elevated.border,
            boxShadow: tokens.shadows.xl,
          }}
        >
          <div 
            className="border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <KBarSearch 
              className="w-full bg-transparent px-4 py-4 text-lg outline-none placeholder:text-[var(--text-tertiary)]"
              placeholder="Type a command or search..."
            />
          </div>
          <CommandResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

function CommandResults() {
  const { results } = useMatches();

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <KBarResults
        items={results}
        onRender={({ item, active }) => {
          // Handle section headers
          if (typeof item === 'string') {
            return (
              <div 
                className="px-4 py-2 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {item}
              </div>
            );
          }

          const action = item as Action & { icon?: IconName; subtitle?: string };
          
          return (
            <div
              className={cn(
                'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                active && 'bg-[var(--bg-hover)]'
              )}
            >
              {action.icon && <CommandIcon name={action.icon} size="sm" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{action.name}</div>
                {action.subtitle && (
                  <div 
                    className="text-sm truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {action.subtitle}
                  </div>
                )}
              </div>
              {action.shortcut && action.shortcut.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {action.shortcut.map((key) => (
                    <kbd
                      key={key}
                      className="px-2 py-1 text-xs rounded"
                      style={{
                        background: tokens.glass.thin.background,
                        border: tokens.glass.thin.border,
                      }}
                    >
                      {formatShortcutKey(key)}
                    </kbd>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

function formatShortcutKey(key: string): string {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
  
  if (key === 'mod') return isMac ? '⌘' : 'Ctrl';
  if (key === 'shift') return isMac ? '⇧' : 'Shift';
  if (key === 'alt') return isMac ? '⌥' : 'Alt';
  if (key === 'meta') return '⌘';
  
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Hook to get command palette state
export function useCommandPalette() {
  const { results, rootActionId } = useMatches();
  return {
    results,
    rootActionId,
  };
}

export type { CommandAction, CommandPaletteProps };
export { CommandIcon };
