import { getInitialSettings } from '../../utils/settings/settings';
import { getGlobalConfig } from '../../utils/config';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled';
import type { AppState } from '../../state/AppStateStore';
import type { ToolPermissionContext } from '../../utils/permissions/permissionSetup';
import type { AgentDefinitions } from '../../tools/AgentTool/loadAgentsDir';

export function createInitialState(options: {
  verbose?: boolean;
  initialMainLoopModel: string | null;
  initialIsBriefOnly: boolean;
  effectiveToolPermissionContext: ToolPermissionContext;
  agent?: string;
  agentDefinitions: AgentDefinitions;
}): AppState {
  return {
    settings: getInitialSettings(),
    tasks: {},
    agentNameRegistry: new Map(),
    verbose: options.verbose ?? getGlobalConfig().verbose ?? false,
    mainLoopModel: options.initialMainLoopModel,
    mainLoopModelForSession: null,
    isBriefOnly: options.initialIsBriefOnly,
    expandedView: getGlobalConfig().showSpinnerTree
      ? 'teammates'
      : getGlobalConfig().showExpandedTodos
        ? 'tasks'
        : 'none',
    showTeammateMessagePreview: isAgentSwarmsEnabled() ? false : undefined,
    selectedIPAgentIndex: -1,
    coordinatorTaskIndex: -1,
    viewSelectionMode: 'none',
    footerSelection: null,
    toolPermissionContext: options.effectiveToolPermissionContext,
    agent: options.agent,
    agentDefinitions: options.agentDefinitions,
    mcp: {
      clients: [],
      tools: [],
      commands: [],
      resources: {},
      pluginReconnectKey: 0,
    },
    plugins: {
      enabled: [],
      errors: [],
    },
    skills: {
      loaded: [],
    },
    notifications: [],
    lastNotificationUpdate: 0,
    activeTools: [],
    activeCommands: [],
    stats: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationInputTokens: 0,
      totalCacheReadInputTokens: 0,
      totalCost: 0,
    },
    sessionHistory: [],
    isShuttingDown: false,
    autoModeEnabled: false,
    lastAutoModeDecision: null,
    interrupted: false,
    isTyping: false,
    replBridgeConnected: false,
    replBridgeSessionActive: false,
    replBridgeReconnecting: false,
    replBridgeConnectUrl: undefined,
    replBridgeSessionUrl: undefined,
    replBridgeEnvironmentId: undefined,
    replBridgeSessionId: undefined,
    replBridgeError: undefined,
    replBridgeInitialName: undefined,
    replBridgeEnabled: false,
    replBridgeExplicit: false,
    replBridgeOutboundOnly: false,
    effortValue: 'medium',
    isFastMode: false,
    showHelp: false,
    showKeybindings: false,
    showSettings: false,
    showTokenUsage: false,
    showCostUsage: false,
    showHistory: false,
    historySearchTerm: '',
    historySelectedIndex: -1,
    isProcessing: false,
    lastTurnDurationMs: 0,
    totalDurationMs: 0,
    isAwaitingApproval: false,
    approvalRequest: null,
    isAwaitingInput: false,
    inputRequest: null,
    idleSpeculationState: 'idle',
    isTeleporting: false,
    teleportTarget: undefined,
    isRemote: false,
    remoteCwd: undefined,
    remoteHost: undefined,
  };
}
