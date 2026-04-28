/**
 * WIH: T2-A2
 * Agent: T2-A2 (Navigation System)
 * Scope: 6-ui/allternit-platform/src/shell/navigation/command-actions.ts
 * Acceptance: 15+ default command actions for navigation, views, actions, preferences
 * Risk Tier: 2
 * Dependencies: CommandAction type, navigation utilities
 */

import { CommandAction } from './CommandPalette';
import { openInBrowser } from '@/lib/openInBrowser';

// Navigation callback type - to be provided by consuming app
export type NavigateFunction = (path: string) => void;
export type ActionCallback = () => void;

export interface CommandActionsConfig {
  navigate: NavigateFunction;
  toggleCommandPalette: ActionCallback;
  createNewChat?: ActionCallback;
  closeCurrentTab?: ActionCallback;
  toggleTheme?: ActionCallback;
  toggleFullscreen?: ActionCallback;
  toggleSidebar?: ActionCallback;
  saveCurrent?: ActionCallback;
  focusSearch?: ActionCallback;
  focusChatInput?: ActionCallback;
  reloadPage?: ActionCallback;
  openDevTools?: ActionCallback;
  goBack?: ActionCallback;
  goForward?: ActionCallback;
}

// Default section names
export const COMMAND_SECTIONS = {
  NAVIGATION: 'Navigation',
  VIEWS: 'Views',
  ACTIONS: 'Actions',
  PREFERENCES: 'Preferences',
  HELP: 'Help',
} as const;

export function createDefaultActions(config: CommandActionsConfig): CommandAction[] {
  const {
    navigate,
    toggleCommandPalette,
    createNewChat,
    closeCurrentTab,
    toggleTheme,
    toggleFullscreen,
    toggleSidebar,
    saveCurrent,
    focusSearch,
    focusChatInput,
    reloadPage,
    openDevTools,
    goBack,
    goForward,
  } = config;

  return [
    // Navigation - 5 actions
    {
      id: 'nav-home',
      name: 'Go to Home',
      shortcut: ['g', 'h'],
      keywords: 'home dashboard start index',
      perform: () => navigate('/'),
      icon: 'home',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-settings',
      name: 'Open Settings',
      shortcut: ['g', 's'],
      keywords: 'settings preferences config options',
      perform: () => navigate('/settings'),
      icon: 'settings',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-back',
      name: 'Go Back',
      shortcut: ['alt', 'left'],
      keywords: 'back previous history',
      perform: () => goBack?.(),
      icon: 'back',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-forward',
      name: 'Go Forward',
      shortcut: ['alt', 'right'],
      keywords: 'forward next history',
      perform: () => goForward?.(),
      icon: 'forward',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-chat',
      name: 'Go to Chat',
      shortcut: ['g', 'c'],
      keywords: 'chat conversation messaging',
      perform: () => navigate('/chat'),
      icon: 'chat',
      section: COMMAND_SECTIONS.NAVIGATION,
    },

    // Views - 5 actions
    {
      id: 'view-agents',
      name: 'View Agents',
      shortcut: ['g', 'a'],
      keywords: 'agents bots assistants ai',
      perform: () => navigate('/agents'),
      icon: 'agent',
      section: COMMAND_SECTIONS.VIEWS,
    },
    {
      id: 'view-workflows',
      name: 'View Workflows',
      shortcut: ['g', 'w'],
      keywords: 'workflows pipelines automation',
      perform: () => navigate('/workflows'),
      icon: 'workflow',
      section: COMMAND_SECTIONS.VIEWS,
    },
    {
      id: 'view-studio',
      name: 'Open Studio',
      shortcut: ['g', 'd'],
      keywords: 'studio designer editor development',
      perform: () => navigate('/studio'),
      icon: 'workflow',
      section: COMMAND_SECTIONS.VIEWS,
    },
    {
      id: 'view-workspace',
      name: 'Open Workspace',
      shortcut: ['g', 'e'],
      keywords: 'workspace projects files explorer',
      perform: () => navigate('/workspace'),
      icon: 'workflow',
      section: COMMAND_SECTIONS.VIEWS,
    },
    {
      id: 'view-registry',
      name: 'View Registry',
      shortcut: ['g', 'r'],
      keywords: 'registry components modules library',
      perform: () => navigate('/registry'),
      icon: 'workflow',
      section: COMMAND_SECTIONS.VIEWS,
    },

    // Actions - 5 actions
    {
      id: 'action-new-chat',
      name: 'New Chat',
      shortcut: ['n', 'c'],
      keywords: 'new chat conversation create start',
      perform: () => createNewChat?.(),
      icon: 'add',
      section: COMMAND_SECTIONS.ACTIONS,
    },
    {
      id: 'action-search',
      name: 'Search...',
      shortcut: ['mod', 'k'],
      keywords: 'search find command palette',
      perform: () => toggleCommandPalette(),
      icon: 'search',
      section: COMMAND_SECTIONS.ACTIONS,
      subtitle: 'Open command palette',
    },
    {
      id: 'action-close-tab',
      name: 'Close Tab',
      shortcut: ['mod', 'w'],
      keywords: 'close tab remove',
      perform: () => closeCurrentTab?.(),
      icon: 'close',
      section: COMMAND_SECTIONS.ACTIONS,
    },
    {
      id: 'action-save',
      name: 'Save',
      shortcut: ['mod', 's'],
      keywords: 'save file document',
      perform: () => saveCurrent?.(),
      icon: 'command',
      section: COMMAND_SECTIONS.ACTIONS,
    },
    {
      id: 'action-reload',
      name: 'Reload Page',
      shortcut: ['mod', 'r'],
      keywords: 'reload refresh page update',
      perform: () => reloadPage?.(),
      icon: 'workflow',
      section: COMMAND_SECTIONS.ACTIONS,
    },

    // Preferences - 4 actions
    {
      id: 'pref-theme',
      name: 'Toggle Theme',
      shortcut: ['mod', 'shift', 'l'],
      keywords: 'theme dark light mode appearance',
      perform: () => toggleTheme?.(),
      icon: 'sun',
      section: COMMAND_SECTIONS.PREFERENCES,
    },
    {
      id: 'pref-fullscreen',
      name: 'Toggle Fullscreen',
      shortcut: ['f11'],
      keywords: 'fullscreen maximize expand',
      perform: () => toggleFullscreen?.(),
      icon: 'maximize',
      section: COMMAND_SECTIONS.PREFERENCES,
    },
    {
      id: 'pref-sidebar',
      name: 'Toggle Sidebar',
      shortcut: ['mod', 'b'],
      keywords: 'sidebar toggle show hide',
      perform: () => toggleSidebar?.(),
      icon: 'workflow',
      section: COMMAND_SECTIONS.PREFERENCES,
    },
    {
      id: 'pref-devtools',
      name: 'Developer Tools',
      shortcut: ['mod', 'shift', 'i'],
      keywords: 'developer tools debug console inspect',
      perform: () => openDevTools?.(),
      icon: 'command',
      section: COMMAND_SECTIONS.PREFERENCES,
    },

    // Focus - 2 actions
    {
      id: 'focus-search',
      name: 'Focus Search',
      shortcut: ['mod', 'f'],
      keywords: 'focus search find',
      perform: () => focusSearch?.(),
      icon: 'search',
      section: COMMAND_SECTIONS.ACTIONS,
    },
    {
      id: 'focus-chat',
      name: 'Focus Chat Input',
      shortcut: ['mod', 'shift', 'c'],
      keywords: 'focus chat input message',
      perform: () => focusChatInput?.(),
      icon: 'chat',
      section: COMMAND_SECTIONS.ACTIONS,
    },

    // Help - 2 actions
    {
      id: 'help-shortcuts',
      name: 'Keyboard Shortcuts',
      shortcut: ['?'],
      keywords: 'keyboard shortcuts help hotkeys',
      perform: () => {
        // This will be handled by ShortcutsHelp component
        const event = new CustomEvent('allternit:show-shortcuts');
        window.dispatchEvent(event);
      },
      icon: 'keyboard',
      section: COMMAND_SECTIONS.HELP,
    },
    {
      id: 'help-documentation',
      name: 'Documentation',
      shortcut: [],
      keywords: 'documentation docs help guide',
      perform: () => openInBrowser('/docs'),
      icon: 'command',
      section: COMMAND_SECTIONS.HELP,
    },
  ];
}

// Pre-configured action sets for different contexts
export function createNavigationActions(navigate: NavigateFunction): CommandAction[] {
  return [
    {
      id: 'nav-home',
      name: 'Go to Home',
      shortcut: ['g', 'h'],
      keywords: 'home dashboard',
      perform: () => navigate('/'),
      icon: 'home',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-chat',
      name: 'Go to Chat',
      shortcut: ['g', 'c'],
      keywords: 'chat conversation',
      perform: () => navigate('/chat'),
      icon: 'chat',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-agents',
      name: 'View Agents',
      shortcut: ['g', 'a'],
      keywords: 'agents bots',
      perform: () => navigate('/agents'),
      icon: 'agent',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-workflows',
      name: 'View Workflows',
      shortcut: ['g', 'w'],
      keywords: 'workflows pipelines',
      perform: () => navigate('/workflows'),
      icon: 'workflow',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
    {
      id: 'nav-settings',
      name: 'Open Settings',
      shortcut: ['g', 's'],
      keywords: 'settings preferences',
      perform: () => navigate('/settings'),
      icon: 'settings',
      section: COMMAND_SECTIONS.NAVIGATION,
    },
  ];
}

// Utility to filter actions by section
export function filterActionsBySection(
  actions: CommandAction[],
  section: string
): CommandAction[] {
  return actions.filter((action) => action.section === section);
}

// Utility to search actions
export function searchActions(
  actions: CommandAction[],
  query: string
): CommandAction[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return actions;

  return actions.filter((action) => {
    const searchableText = [
      action.name,
      action.keywords,
      action.section,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    
    return searchableText.includes(normalizedQuery);
  });
}

// Default export for convenience
export { createDefaultActions as defaultActions };
