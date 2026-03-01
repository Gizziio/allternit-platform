/**
 * Browser Actions for Electron Host
 *
 * Wires up Capsule SDK browser actions to the ElectronBrowserHost IPC API.
 * Explicit action IDs for user vs agent navigation intent.
 */

import { getElectronBrowserHost } from './electronBrowserHost';
import type { NavIntent } from './types';

// ============================================================================
// Browser Actions Interface
// ============================================================================

export interface BrowserActionsConfig {
  defaultStagePreset?: number;
  debug?: boolean;
}

// ============================================================================
// Explicit Action IDs (user vs agent)
// ============================================================================

export const BROWSER_ACTIONS = {
  // User navigation (HUMAN renderer)
  NAV_GO_USER: 'nav.go.user',
  NAV_BACK: 'nav.back',
  NAV_FORWARD: 'nav.forward',
  NAV_RELOAD: 'nav.reload',
  TAB_NEW_USER: 'tab.new.user',

  // Agent navigation (AGENT renderer)
  NAV_GO_AGENT: 'nav.go.agent',
  TAB_NEW_AGENT: 'tab.new.agent',

  // Tab management
  TAB_CLOSE: 'tab.close',

  // Stage management
  STAGE_ENTER: 'stage.enter',
  STAGE_EXIT: 'stage.exit',
  STAGE_PRESET_50: 'stage.preset.50',
  STAGE_PRESET_70: 'stage.preset.70',
  STAGE_PRESET_100: 'stage.preset.100',

  // Renderer selection
  RENDERER_STREAM: 'renderer.stream',
  RENDERER_GPU: 'renderer.gpu',
} as const;

type ActionId = string;

interface CapsuleAction {
  id: ActionId;
  label?: string;
  icon?: string;
  enabled: boolean;
  run: () => void | Promise<void>;
}

interface ActionBuilder {
  id(id: ActionId): this;
  label(label: string): this;
  icon(icon: string): this;
  enabled(enabled: boolean): this;
  run(fn: () => void | Promise<void>): this;
  build(): CapsuleAction;
}

function createActionBuilder(): ActionBuilder {
  let id: ActionId = '';
  let label: string | undefined;
  let icon: string | undefined;
  let enabled = true;
  let run: (() => void | Promise<void>) = () => {};

  return {
    id(value: ActionId): ActionBuilder {
      id = value;
      return this;
    },
    label(value: string): ActionBuilder {
      label = value;
      return this;
    },
    icon(value: string): ActionBuilder {
      icon = value;
      return this;
    },
    enabled(value: boolean): ActionBuilder {
      enabled = value;
      return this;
    },
    run(fn: () => void | Promise<void>): ActionBuilder {
      run = fn;
      return this;
    },
    build(): CapsuleAction {
      if (!id) {
        throw new Error('Action ID is required');
      }
      return { id, label, icon, enabled, run };
    },
  };
}

// ============================================================================
// Action Registration
// ============================================================================

export function registerBrowserActions(
  _capsuleId: string,
  config: BrowserActionsConfig = {}
): BrowserActionsRegistration {
  return createBrowserActionsRegistration(config);
}

export function createBrowserActionsRegistration(
  _config: BrowserActionsConfig = {}
): BrowserActionsRegistration {
  const host = getElectronBrowserHost();
  const actions: ReturnType<typeof createActionBuilder>[] = [];

  const createAction = (id: string) => {
    const builder = createActionBuilder().id(id as ActionId).enabled(false);
    actions.push(builder);
    return builder;
  };

  let stageTabId: string | null = null;
  let currentTabId: string | null = null;

  host.onStageAttached((event) => {
    stageTabId = event.tabId;
  });

  host.onStageDetached(() => {
    stageTabId = null;
  });

  host.onDidNavigate((event) => {
    if (!currentTabId || event.tabId === stageTabId) {
      currentTabId = event.tabId;
    }
  });

  // ========================================================================
  // User Navigation Actions (HUMAN renderer)
  // ========================================================================

  createAction(BROWSER_ACTIONS.NAV_GO_USER)
    .label('Go to URL')
    .run(async () => {
      const tabId = currentTabId || stageTabId;
      if (tabId) {
        // Intent = user means HUMAN renderer
        host.setTabIntent(tabId, 'user');
      }
    });

  createAction(BROWSER_ACTIONS.TAB_NEW_USER)
    .label('New Tab')
    .icon('+')
    .run(async () => {
      const result = await host.createTab(undefined, 'user');
      if (result.success) {
        currentTabId = result.tabId;
      }
    });

  createAction(BROWSER_ACTIONS.NAV_BACK)
    .label('Go Back')
    .icon('◀')
    .run(async () => {
      const tabId = stageTabId || currentTabId;
      if (tabId) {
        host.goBack(tabId);
      }
    });

  createAction(BROWSER_ACTIONS.NAV_FORWARD)
    .label('Go Forward')
    .icon('▶')
    .run(async () => {
      const tabId = stageTabId || currentTabId;
      if (tabId) {
        host.goForward(tabId);
      }
    });

  createAction(BROWSER_ACTIONS.NAV_RELOAD)
    .label('Reload')
    .icon('↻')
    .run(async () => {
      const tabId = stageTabId || currentTabId;
      if (tabId) {
        host.reload(tabId);
      }
    });

  // ========================================================================
  // Agent Navigation Actions (AGENT renderer)
  // ========================================================================

  createAction(BROWSER_ACTIONS.NAV_GO_AGENT)
    .label('Navigate (Agent)')
    .run(async () => {
      const tabId = currentTabId || stageTabId;
      if (tabId) {
        // Intent = agent means AGENT renderer (Playwright)
        host.setTabIntent(tabId, 'agent');
      }
    });

  createAction(BROWSER_ACTIONS.TAB_NEW_AGENT)
    .label('New Agent Tab')
    .icon('🤖')
    .run(async () => {
      const result = await host.createTab(undefined, 'agent');
      if (result.success) {
        currentTabId = result.tabId;
      }
    });

  // ========================================================================
  // Tab Management
  // ========================================================================

  createAction(BROWSER_ACTIONS.TAB_CLOSE)
    .label('Close Tab')
    .icon('×')
    .run(async () => {
      if (currentTabId) {
        await host.closeTab(currentTabId);
        currentTabId = null;
      }
    });

  // ========================================================================
  // Stage Management
  // ========================================================================

  createAction(BROWSER_ACTIONS.STAGE_ENTER)
    .label('Enter Stage')
    .icon('⛶')
    .run(async () => {
      const tabId = currentTabId || stageTabId;
      if (tabId) {
        const bounds = calculateStageBounds(0.7);
        host.attachStage(tabId, bounds);
        stageTabId = tabId;
      }
    });

  createAction(BROWSER_ACTIONS.STAGE_EXIT)
    .label('Exit Stage')
    .icon('⊡')
    .run(async () => {
      if (stageTabId) {
        host.detachStage(stageTabId);
        stageTabId = null;
      }
    });

  createAction(BROWSER_ACTIONS.STAGE_PRESET_50)
    .label('50% Stage')
    .run(async () => {
      if (stageTabId) {
        const bounds = calculateStageBounds(0.5);
        host.setStageBounds(stageTabId, bounds);
      }
    });

  createAction(BROWSER_ACTIONS.STAGE_PRESET_70)
    .label('70% Stage')
    .run(async () => {
      if (stageTabId) {
        const bounds = calculateStageBounds(0.7);
        host.setStageBounds(stageTabId, bounds);
      }
    });

  createAction(BROWSER_ACTIONS.STAGE_PRESET_100)
    .label('Full Stage')
    .run(async () => {
      if (stageTabId) {
        const bounds = calculateStageBounds(1.0);
        host.setStageBounds(stageTabId, bounds);
      }
    });

  // ========================================================================
  // Renderer Selection
  // ========================================================================

  createAction(BROWSER_ACTIONS.RENDERER_STREAM)
    .label('Stream Renderer');

  createAction(BROWSER_ACTIONS.RENDERER_GPU)
    .label('GPU Renderer');

  return {
    registry: {
      register: (_cid: string, _action: CapsuleAction) => {},
      unregister: (_cid: string, _actionId: ActionId) => {},
      list: (_cid: string) => actions.map((a) => a.build()),
      get: (_cid: string, _actionId: ActionId) =>
        actions.find((a) => a.build().id === _actionId)?.build(),
      has: (_cid: string, _actionId: ActionId) =>
        actions.some((a) => a.build().id === _actionId),
      update: (_cid: string, _actionId: ActionId, _updates: Partial<CapsuleAction>) => {},
    },
    actions: actions.map((a) => a.build()),
    cleanup: () => {},
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface BrowserActionsRegistration {
  registry: {
    register: (capsuleId: string, action: CapsuleAction) => void;
    unregister: (capsuleId: string, actionId: ActionId) => void;
    list: (capsuleId: string) => CapsuleAction[];
    get: (capsuleId: string, actionId: ActionId) => CapsuleAction | undefined;
    has: (capsuleId: string, actionId: ActionId) => boolean;
    update: (capsuleId: string, actionId: ActionId, updates: Partial<CapsuleAction>) => void;
  };
  actions: CapsuleAction[];
  cleanup: () => void;
}

function calculateStageBounds(preset: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const padding = 60;

  const widthPercent = preset;
  const heightPercent = preset * 1.1;

  const width = Math.min(screenWidth * widthPercent, 1920);
  const height = Math.min(screenHeight * heightPercent, 1080);

  return {
    x: Math.max(20, (screenWidth - width) / 2),
    y: Math.max(20, (screenHeight - height) / 2),
    width,
    height,
  };
}

// ============================================================================
// Navigation Helpers
// ============================================================================

export async function navigateTo(url: string, intent: NavIntent = 'user'): Promise<void> {
  const host = getElectronBrowserHost();
  const tabId = await getActiveTabId();

  if (tabId) {
    await host.navigate(tabId, url, intent);
  } else {
    const result = await host.createTab(url, intent);
    if (result.success) {
      // Tab created successfully
    }
  }
}

export async function getActiveTabId(): Promise<string | null> {
  const host = getElectronBrowserHost();

  const stageTabId = await host.getStageTabId();
  if (stageTabId) {
    return stageTabId;
  }

  const tabs = await host.getTabs();
  return tabs.length > 0 ? tabs[0].id : null;
}

export function getTabIntent(tabId: string): NavIntent {
  const host = getElectronBrowserHost();
  return host.getTabIntent(tabId);
}
