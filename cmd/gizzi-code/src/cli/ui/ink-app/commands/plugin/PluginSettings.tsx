import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint';
import { Byline } from '../../components/design-system/Byline';
import { Pane } from '../../components/design-system/Pane';
import { Tab, Tabs } from '../../components/design-system/Tabs';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from '../../ink';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding';
import { useAppState, useSetAppState } from '../../state/AppState';
import type { PluginError } from '../../types/plugin';
import { errorMessage } from '../../utils/errors';
import { clearAllCaches } from '../../utils/plugins/cacheUtils';
import { loadMarketplacesWithGracefulDegradation } from '../../utils/plugins/marketplaceHelpers';
import { loadKnownMarketplacesConfig, removeMarketplaceSource } from '../../utils/plugins/marketplaceManager';
import { getPluginEditableScopes } from '../../utils/plugins/pluginStartupCheck';
import type { EditableSettingSource } from '../../utils/settings/constants';
import { getSettingsForSource, updateSettingsForSource } from '../../utils/settings/settings';
import { AddMarketplace } from './AddMarketplace';
import { BrowseMarketplace } from './BrowseMarketplace';
import { DiscoverPlugins } from './DiscoverPlugins';
import { ManageMarketplaces } from './ManageMarketplaces';
import { ManagePlugins } from './ManagePlugins';
import { formatErrorMessage, getErrorGuidance } from './PluginErrors';
import { type ParsedCommand, parsePluginArgs } from './parseArgs';
import type { PluginSettingsProps, ViewState } from './types';
import { ValidatePlugin } from './ValidatePlugin';
type TabId = 'discover' | 'installed' | 'marketplaces' | 'errors';
function MarketplaceList(t0) {
  const {
    onComplete
  } = t0;
  const t1 = () => {
      const loadList = async function loadList() {
        ;
        try {
          const config = await loadKnownMarketplacesConfig();
          const names = Object.keys(config);
          if (names.length === 0) {
            onComplete("No marketplaces configured");
          } else {
            onComplete(`Configured marketplaces:\n${names.map(_temp).join("\n")}`);
          }
        } catch (t3) {
          const err = t3;
          onComplete(`Error loading marketplaces: ${errorMessage(err)}`);
        }
      };
      loadList();
    };
  const t2 = [onComplete];

  useEffect(t1, t2);
  const t3 = <Text>Loading marketplaces...</Text>;

  return t3;
}
function _temp(n) {
  return `  • ${n}`;
}
function McpRedirectBanner() {
  return null;
}
type ErrorRowAction = {
  kind: 'navigate';
  tab: TabId;
  viewState: ViewState;
} | {
  kind: 'remove-extra-marketplace';
  name: string;
  sources: Array<{
    source: EditableSettingSource;
    scope: string;
  }>;
} | {
  kind: 'remove-installed-marketplace';
  name: string;
} | {
  kind: 'managed-only';
  name: string;
} | {
  kind: 'none';
};
type ErrorRow = {
  label: string;
  message: string;
  guidance?: string | null;
  action: ErrorRowAction;
  scope?: string;
};

/**
 * Determine which settings sources define an extraKnownMarketplace entry.
 * Returns the editable sources (user/project/local) and whether policy also has it.
 */
function getExtraMarketplaceSourceInfo(name: string): {
  editableSources: Array<{
    source: EditableSettingSource;
    scope: string;
  }>;
  isInPolicy: boolean;
} {
  const editableSources: Array<{
    source: EditableSettingSource;
    scope: string;
  }> = [];
  const sourcesToCheck = [{
    source: 'userSettings' as const,
    scope: 'user'
  }, {
    source: 'projectSettings' as const,
    scope: 'project'
  }, {
    source: 'localSettings' as const,
    scope: 'local'
  }];
  for (const {
    source,
    scope
  } of sourcesToCheck) {
    const settings = getSettingsForSource(source);
    if (settings?.extraKnownMarketplaces?.[name]) {
      editableSources.push({
        source,
        scope
      });
    }
  }
  const policySettings = getSettingsForSource('policySettings');
  const isInPolicy = Boolean(policySettings?.extraKnownMarketplaces?.[name]);
  return {
    editableSources,
    isInPolicy
  };
}
function buildMarketplaceAction(name: string): ErrorRowAction {
  const {
    editableSources,
    isInPolicy
  } = getExtraMarketplaceSourceInfo(name);
  if (editableSources.length > 0) {
    return {
      kind: 'remove-extra-marketplace',
      name,
      sources: editableSources
    };
  }
  if (isInPolicy) {
    return {
      kind: 'managed-only',
      name
    };
  }

  // Marketplace is in known_marketplaces.json but not in extraKnownMarketplaces
  // (e.g. previously installed manually) — route to ManageMarketplaces
  return {
    kind: 'navigate',
    tab: 'marketplaces',
    viewState: {
      type: 'manage-marketplaces',
      targetMarketplace: name,
      action: 'remove'
    }
  };
}
function buildPluginAction(pluginName: string): ErrorRowAction {
  return {
    kind: 'navigate',
    tab: 'installed',
    viewState: {
      type: 'manage-plugins',
      targetPlugin: pluginName,
      action: 'uninstall'
    }
  };
}
const TRANSIENT_ERROR_TYPES = new Set(['git-auth-failed', 'git-timeout', 'network-error']);
function isTransientError(error: PluginError): boolean {
  return TRANSIENT_ERROR_TYPES.has(error.type);
}

/**
 * Extract the plugin name from a PluginError, checking explicit fields first,
 * then falling back to the source field (format: "pluginName@marketplace").
 */
function getPluginNameFromError(error: PluginError): string | undefined {
  if ('pluginId' in error && error.pluginId) return error.pluginId;
  if ('plugin' in error && error.plugin) return error.plugin;
  // Fallback: source often contains "pluginName@marketplace"
  if (error.source.includes('@')) return error.source.split('@')[0];
  return undefined;
}
function buildErrorRows(failedMarketplaces: Array<{
  name: string;
  error?: string;
}>, extraMarketplaceErrors: PluginError[], pluginLoadingErrors: PluginError[], otherErrors: PluginError[], brokenInstalledMarketplaces: Array<{
  name: string;
  error: string;
}>, transientErrors: PluginError[], pluginScopes: Map<string, string>): ErrorRow[] {
  const rows: ErrorRow[] = [];

  // --- Transient errors at the top (restart to retry) ---
  for (const error of transientErrors) {
    const pluginName = 'pluginId' in error ? error.pluginId : 'plugin' in error ? error.plugin : undefined;
    rows.push({
      label: pluginName ?? error.source,
      message: formatErrorMessage(error),
      guidance: 'Restart to retry loading plugins',
      action: {
        kind: 'none'
      }
    });
  }

  // --- Marketplace errors ---
  // Track shown marketplace names to avoid duplicates across sources
  const shownMarketplaceNames = new Set<string>();
  for (const m of failedMarketplaces) {
    shownMarketplaceNames.add(m.name);
    const action = buildMarketplaceAction(m.name);
    const sourceInfo = getExtraMarketplaceSourceInfo(m.name);
    const scope = sourceInfo.isInPolicy ? 'managed' : sourceInfo.editableSources[0]?.scope;
    rows.push({
      label: m.name,
      message: m.error ?? 'Installation failed',
      guidance: action.kind === 'managed-only' ? 'Managed by your organization — contact your admin' : undefined,
      action,
      scope
    });
  }
  for (const e of extraMarketplaceErrors) {
    const marketplace = 'marketplace' in e ? e.marketplace : e.source;
    if (shownMarketplaceNames.has(marketplace)) continue;
    shownMarketplaceNames.add(marketplace);
    const action = buildMarketplaceAction(marketplace);
    const sourceInfo = getExtraMarketplaceSourceInfo(marketplace);
    const scope = sourceInfo.isInPolicy ? 'managed' : sourceInfo.editableSources[0]?.scope;
    rows.push({
      label: marketplace,
      message: formatErrorMessage(e),
      guidance: action.kind === 'managed-only' ? 'Managed by your organization — contact your admin' : getErrorGuidance(e),
      action,
      scope
    });
  }

  // Installed marketplaces that fail to load data (from known_marketplaces.json)
  for (const m of brokenInstalledMarketplaces) {
    if (shownMarketplaceNames.has(m.name)) continue;
    shownMarketplaceNames.add(m.name);
    rows.push({
      label: m.name,
      message: m.error,
      action: {
        kind: 'remove-installed-marketplace',
        name: m.name
      }
    });
  }

  // --- Plugin errors ---
  const shownPluginNames = new Set<string>();
  for (const error of pluginLoadingErrors) {
    const pluginName = getPluginNameFromError(error);
    if (pluginName && shownPluginNames.has(pluginName)) continue;
    if (pluginName) shownPluginNames.add(pluginName);
    const marketplace = 'marketplace' in error ? error.marketplace : undefined;
    // Try pluginId@marketplace format first, then just pluginName
    const scope = pluginName ? pluginScopes.get(error.source) ?? pluginScopes.get(pluginName) : undefined;
    rows.push({
      label: pluginName ? marketplace ? `${pluginName} @ ${marketplace}` : pluginName : error.source,
      message: formatErrorMessage(error),
      guidance: getErrorGuidance(error),
      action: pluginName ? buildPluginAction(pluginName) : {
        kind: 'none'
      },
      scope
    });
  }

  // --- Other errors (non-marketplace, non-plugin-specific) ---
  for (const error of otherErrors) {
    rows.push({
      label: error.source,
      message: formatErrorMessage(error),
      guidance: getErrorGuidance(error),
      action: {
        kind: 'none'
      }
    });
  }
  return rows;
}

/**
 * Remove a marketplace from extraKnownMarketplaces in the given settings sources,
 * and also remove any associated enabled plugins.
 */
function removeExtraMarketplace(name: string, sources: Array<{
  source: EditableSettingSource;
}>): void {
  for (const {
    source
  } of sources) {
    const settings = getSettingsForSource(source);
    if (!settings) continue;
    const updates: Record<string, unknown> = {};

    // Remove from extraKnownMarketplaces
    if (settings.extraKnownMarketplaces?.[name]) {
      updates.extraKnownMarketplaces = {
        ...settings.extraKnownMarketplaces,
        [name]: undefined
      };
    }

    // Remove associated enabled plugins (format: "plugin@marketplace")
    if (settings.enabledPlugins) {
      const suffix = `@${name}`;
      let removedPlugins = false;
      const updatedPlugins = {
        ...settings.enabledPlugins
      };
      for (const pluginId in updatedPlugins) {
        if (pluginId.endsWith(suffix)) {
          updatedPlugins[pluginId] = undefined;
          removedPlugins = true;
        }
      }
      if (removedPlugins) {
        updates.enabledPlugins = updatedPlugins;
      }
    }
    if (Object.keys(updates).length > 0) {
      updateSettingsForSource(source, updates);
    }
  }
}
function ErrorsTabContent(t0) {
  const {
    setViewState,
    setActiveTab,
    markPluginsChanged
  } = t0;
  const errors = useAppState(_temp2);
  const installationStatus = useAppState(_temp3);
  const setAppState = useSetAppState();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionMessage, setActionMessage] = useState(null);
  const t1 = [];

  const [marketplaceLoadFailures, setMarketplaceLoadFailures] = useState(t1);
  const t2 = () => {
      (async () => {
        try {
          const config = await loadKnownMarketplacesConfig();
          const {
            failures
          } = await loadMarketplacesWithGracefulDegradation(config);
          setMarketplaceLoadFailures(failures);
        } catch {
          // Failure banner is best-effort; settings stay usable without it.
        }
      })();
    };
  const t3 = [];

  useEffect(t2, t3);
  const failedMarketplaces = installationStatus.marketplaces.filter(_temp4);
  const failedMarketplaceNames = new Set(failedMarketplaces.map(_temp5));
  const transientErrors = errors.filter(isTransientError);
  const extraMarketplaceErrors = errors.filter(e => (e.type === "marketplace-not-found" || e.type === "marketplace-load-failed" || e.type === "marketplace-blocked-by-policy") && !failedMarketplaceNames.has(e.marketplace));
  const pluginLoadingErrors = errors.filter(_temp6);
  const otherErrors = errors.filter(_temp7);
  const pluginScopes = getPluginEditableScopes();
  const rows = buildErrorRows(failedMarketplaces, extraMarketplaceErrors, pluginLoadingErrors, otherErrors, marketplaceLoadFailures, transientErrors, pluginScopes);
  const t4 = () => {
      setViewState({
        type: "menu"
      });
    };

  const t5 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", t4, t5);
  const handleSelect = () => {
    const row = rows[selectedIndex];
    if (!row) {
      return;
    }
    const {
      action
    } = row;
    bb77: switch (action.kind) {
      case "navigate":
        {
          setActiveTab(action.tab);
          setViewState(action.viewState);
          break bb77;
        }
      case "remove-extra-marketplace":
        {
          const scopes = action.sources.map(_temp8).join(", ");
          removeExtraMarketplace(action.name, action.sources);
          clearAllCaches();
          setAppState(prev_0 => ({
            ...prev_0,
            plugins: {
              ...prev_0.plugins,
              errors: prev_0.plugins.errors.filter(e_2 => !("marketplace" in e_2 && e_2.marketplace === action.name)),
              installationStatus: {
                ...prev_0.plugins.installationStatus,
                marketplaces: prev_0.plugins.installationStatus.marketplaces.filter(m_1 => m_1.name !== action.name)
              }
            }
          }));
          setActionMessage(`${figures.tick} Removed "${action.name}" from ${scopes} settings`);
          markPluginsChanged();
          break bb77;
        }
      case "remove-installed-marketplace":
        {
          (async () => {
            ;
            try {
              await removeMarketplaceSource(action.name);
              clearAllCaches();
              setMarketplaceLoadFailures(prev => prev.filter(f => f.name !== action.name));
              setActionMessage(`${figures.tick} Removed marketplace "${action.name}"`);
              markPluginsChanged();
            } catch (t6) {
              const err = t6;
              setActionMessage(`Failed to remove "${action.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
          })();
          break bb77;
        }
      case "managed-only":
        {
          break bb77;
        }
      case "none":
    }
  };
  const t7 = () => setSelectedIndex(_temp9);

  const t8 = rows.length > 0;
  const t9 = {
      context: "Select",
      isActive: t8
    };

  useKeybindings({
    "select:previous": t7,
    "select:next": () => setSelectedIndex(prev_2 => Math.min(rows.length - 1, prev_2 + 1)),
    "select:accept": handleSelect
  }, t9);
  const clampedIndex = Math.min(selectedIndex, Math.max(0, rows.length - 1));
  if (clampedIndex !== selectedIndex) {
    setSelectedIndex(clampedIndex);
  }
  const selectedAction = rows[clampedIndex]?.action;
  const hasAction = selectedAction && selectedAction.kind !== "none" && selectedAction.kind !== "managed-only";
  if (rows.length === 0) {
    const t10 = <Box marginLeft={1}><Text dimColor={true}>No plugin errors</Text></Box>;

    const t11 = <Box flexDirection="column">{t10}<Box marginTop={1}><Text dimColor={true} italic={true}><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" /></Text></Box></Box>;

    return t11;
  }
  const T0 = Box;
  const t10 = "column";
  const t11 = (row_0, idx) => {
      const isSelected = idx === clampedIndex;
      return <Box key={idx} marginLeft={1} flexDirection="column" marginBottom={1}><Text><Text color={isSelected ? "suggestion" : "error"}>{isSelected ? figures.pointer : figures.cross}{" "}</Text><Text bold={isSelected}>{row_0.label}</Text>{row_0.scope && <Text dimColor={true}> ({row_0.scope})</Text>}</Text><Box marginLeft={3}><Text color="error">{row_0.message}</Text></Box>{row_0.guidance && <Box marginLeft={3}><Text dimColor={true} italic={true}>{row_0.guidance}</Text></Box>}</Box>;
    };

  const t12 = rows.map(t11);
  const t13 = actionMessage && <Box marginTop={1} marginLeft={1}><Text color="gizzi">{actionMessage}</Text></Box>;

  const t14 = <ConfigurableShortcutHint action="select:previous" context="Select" fallback={"\u2191"} description="navigate" />;

  const t15 = hasAction && <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="resolve" />;

  const t16 = <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />;

  const t17 = <Box marginTop={1}><Text dimColor={true} italic={true}><Byline>{t14}{t15}{t16}</Byline></Text></Box>;

  const t18 = <T0 flexDirection={t10}>{t12}{t13}{t17}</T0>;

  return t18;
}
function _temp9(prev_1) {
  return Math.max(0, prev_1 - 1);
}
function _temp8(s_1) {
  return s_1.scope;
}
function _temp7(e_1) {
  if (isTransientError(e_1)) {
    return false;
  }
  if (e_1.type === "marketplace-not-found" || e_1.type === "marketplace-load-failed" || e_1.type === "marketplace-blocked-by-policy") {
    return false;
  }
  return getPluginNameFromError(e_1) === undefined;
}
function _temp6(e_0) {
  if (isTransientError(e_0)) {
    return false;
  }
  if (e_0.type === "marketplace-not-found" || e_0.type === "marketplace-load-failed" || e_0.type === "marketplace-blocked-by-policy") {
    return false;
  }
  return getPluginNameFromError(e_0) !== undefined;
}
function _temp5(m_0) {
  return m_0.name;
}
function _temp4(m) {
  return m.status === "failed";
}
function _temp3(s_0) {
  return s_0.plugins.installationStatus;
}
function _temp2(s) {
  return s.plugins.errors;
}
function getInitialViewState(parsedCommand: ParsedCommand): ViewState {
  switch (parsedCommand.type) {
    case 'help':
      return {
        type: 'help'
      };
    case 'validate':
      return {
        type: 'validate',
        path: parsedCommand.path
      };
    case 'install':
      if (parsedCommand.marketplace) {
        return {
          type: 'browse-marketplace',
          targetMarketplace: parsedCommand.marketplace,
          targetPlugin: parsedCommand.plugin
        };
      }
      if (parsedCommand.plugin) {
        return {
          type: 'discover-plugins',
          targetPlugin: parsedCommand.plugin
        };
      }
      return {
        type: 'discover-plugins'
      };
    case 'manage':
      return {
        type: 'manage-plugins'
      };
    case 'uninstall':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'uninstall'
      };
    case 'enable':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'enable'
      };
    case 'disable':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'disable'
      };
    case 'marketplace':
      if (parsedCommand.action === 'list') {
        return {
          type: 'marketplace-list'
        };
      }
      if (parsedCommand.action === 'add') {
        return {
          type: 'add-marketplace',
          initialValue: parsedCommand.target
        };
      }
      if (parsedCommand.action === 'remove') {
        return {
          type: 'manage-marketplaces',
          targetMarketplace: parsedCommand.target,
          action: 'remove'
        };
      }
      if (parsedCommand.action === 'update') {
        return {
          type: 'manage-marketplaces',
          targetMarketplace: parsedCommand.target,
          action: 'update'
        };
      }
      return {
        type: 'marketplace-menu'
      };
    case 'menu':
    default:
      // Default to discover view showing all plugins
      return {
        type: 'discover-plugins'
      };
  }
}
function getInitialTab(viewState: ViewState): TabId {
  if (viewState.type === 'manage-plugins') return 'installed';
  if (viewState.type === 'manage-marketplaces') return 'marketplaces';
  return 'discover';
}
export function PluginSettings(t0: PluginSettingsProps) {
  const {
    onComplete,
    args,
    showMcpRedirectMessage
  } = t0;
  const parsedCommand = parsePluginArgs(args);
  const t1 = getInitialViewState(parsedCommand);

  const initialViewState = t1;
  const [viewState, setViewState] = useState(initialViewState);
  const t2 = getInitialTab(initialViewState);

  const [activeTab, setActiveTab] = useState(t2);
  const [inputValue, setInputValue] = useState(viewState.type === "add-marketplace" ? viewState.initialValue || "" : "");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [childSearchActive, setChildSearchActive] = useState(false);
  const setAppState = useSetAppState();
  const pluginErrorCount = useAppState(_temp0);
  const errorsTabTitle = pluginErrorCount > 0 ? `Errors (${pluginErrorCount})` : "Errors";
  const exitState = useExitOnCtrlCDWithKeybindings();
  const cliMode = parsedCommand.type === "marketplace" && parsedCommand.action === "add" && parsedCommand.target !== undefined;
  const t3 = () => {
      setAppState(_temp1);
    };

  const markPluginsChanged = t3;
  const t4 = tabId => {
      const tab = tabId as TabId;
      setActiveTab(tab);
      setError(null);
      bb37: switch (tab) {
        case "discover":
          {
            setViewState({
              type: "discover-plugins"
            });
            break bb37;
          }
        case "installed":
          {
            setViewState({
              type: "manage-plugins"
            });
            break bb37;
          }
        case "marketplaces":
          {
            setViewState({
              type: "manage-marketplaces"
            });
            break bb37;
          }
        case "errors":
      }
    };

  const handleTabChange = t4;
  const t5 = () => {
      if (viewState.type === "menu" && !result) {
        onComplete();
      }
    };
  const t6 = [viewState.type, result, onComplete];

  useEffect(t5, t6);
  const t7 = () => {
      if (viewState.type === "browse-marketplace" && activeTab !== "discover") {
        setActiveTab("discover");
      }
    };
  const t8 = [viewState.type, activeTab];

  useEffect(t7, t8);
  const t9 = () => {
      setActiveTab("marketplaces");
      setViewState({
        type: "manage-marketplaces"
      });
      setInputValue("");
      setError(null);
    };

  const handleAddMarketplaceEscape = t9;
  const t10 = viewState.type === "add-marketplace";
  const t11 = {
      context: "Settings",
      isActive: t10
    };

  useKeybinding("confirm:no", handleAddMarketplaceEscape, t11);
  const t12 = () => {
      if (result) {
        onComplete(result);
      }
    };
  const t13 = [result, onComplete];

  useEffect(t12, t13);
  const t14 = () => {
      if (viewState.type === "help") {
        onComplete();
      }
    };
  const t15 = [viewState.type, onComplete];

  useEffect(t14, t15);
  if (viewState.type === "help") {
    const t16 = <Box flexDirection="column"><Text bold={true}>Plugin Command Usage:</Text><Text> </Text><Text dimColor={true}>Installation:</Text><Text> /plugin install - Browse and install plugins</Text><Text>{" "}{"/plugin install <marketplace> - Install from specific marketplace"}</Text><Text>{" /plugin install <plugin> - Install specific plugin"}</Text><Text>{" "}{"/plugin install <plugin>@<market> - Install plugin from marketplace"}</Text><Text> </Text><Text dimColor={true}>Management:</Text><Text> /plugin manage - Manage installed plugins</Text><Text>{" /plugin enable <plugin> - Enable a plugin"}</Text><Text>{" /plugin disable <plugin> - Disable a plugin"}</Text><Text>{" /plugin uninstall <plugin> - Uninstall a plugin"}</Text><Text> </Text><Text dimColor={true}>Marketplaces:</Text><Text> /plugin marketplace - Marketplace management menu</Text><Text> /plugin marketplace add - Add a marketplace</Text><Text>{" "}{"/plugin marketplace add <path/url> - Add marketplace directly"}</Text><Text> /plugin marketplace update - Update marketplaces</Text><Text>{" "}{"/plugin marketplace update <name> - Update specific marketplace"}</Text><Text> /plugin marketplace remove - Remove a marketplace</Text><Text>{" "}{"/plugin marketplace remove <name> - Remove specific marketplace"}</Text><Text> /plugin marketplace list - List all marketplaces</Text><Text> </Text><Text dimColor={true}>Validation:</Text><Text>{" "}{"/plugin validate <path> - Validate a manifest file or directory"}</Text><Text> </Text><Text dimColor={true}>Other:</Text><Text> /plugin - Main plugin menu</Text><Text> /plugin help - Show this help</Text><Text> /plugins - Alias for /plugin</Text></Box>;

    return t16;
  }
  if (viewState.type === "validate") {
    const t16 = <ValidatePlugin onComplete={onComplete} path={viewState.path} />;

    return t16;
  }
  if (viewState.type === "marketplace-menu") {
    setViewState({
      type: "menu"
    });
    return null;
  }
  if (viewState.type === "marketplace-list") {
    const t16 = <MarketplaceList onComplete={onComplete} />;

    return t16;
  }
  if (viewState.type === "add-marketplace") {
    const t16 = <AddMarketplace inputValue={inputValue} setInputValue={setInputValue} cursorOffset={cursorOffset} setCursorOffset={setCursorOffset} error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onAddComplete={markPluginsChanged} cliMode={cliMode} />;

    return t16;
  }
  const t16 = showMcpRedirectMessage && activeTab === "installed" ? <McpRedirectBanner /> : undefined;

  const t17 = <Tab id="discover" title="Discover">{viewState.type === "browse-marketplace" ? <BrowseMarketplace error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onInstallComplete={markPluginsChanged} targetMarketplace={viewState.targetMarketplace} targetPlugin={viewState.targetPlugin} /> : <DiscoverPlugins error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onInstallComplete={markPluginsChanged} onSearchModeChange={setChildSearchActive} targetPlugin={viewState.type === "discover-plugins" ? viewState.targetPlugin : undefined} />}</Tab>;

  const t18 = viewState.type === "manage-plugins" ? viewState.targetPlugin : undefined;
  const t19 = viewState.type === "manage-plugins" ? viewState.targetMarketplace : undefined;
  const t20 = viewState.type === "manage-plugins" ? viewState.action : undefined;
  const t21 = <Tab id="installed" title="Installed"><ManagePlugins setViewState={setViewState} setResult={setResult} onManageComplete={markPluginsChanged} onSearchModeChange={setChildSearchActive} targetPlugin={t18} targetMarketplace={t19} action={t20} /></Tab>;

  const t22 = viewState.type === "manage-marketplaces" ? viewState.targetMarketplace : undefined;
  const t23 = viewState.type === "manage-marketplaces" ? viewState.action : undefined;
  const t24 = <Tab id="marketplaces" title="Marketplaces"><ManageMarketplaces setViewState={setViewState} error={error} setError={setError} setResult={setResult} exitState={exitState} onManageComplete={markPluginsChanged} targetMarketplace={t22} action={t23} /></Tab>;

  const t25 = <ErrorsTabContent setViewState={setViewState} setActiveTab={setActiveTab} markPluginsChanged={markPluginsChanged} />;

  const t26 = <Tab id="errors" title={errorsTabTitle}>{t25}</Tab>;

  const t27 = <Pane color="suggestion"><Tabs title="Plugins" selectedTab={activeTab} onTabChange={handleTabChange} color="suggestion" disableNavigation={childSearchActive} banner={t16}>{t17}{t21}{t24}{t26}</Tabs></Pane>;

  return t27;
}
function _temp1(prev) {
  return prev.plugins.needsRefresh ? prev : {
    ...prev,
    plugins: {
      ...prev.plugins,
      needsRefresh: true
    }
  };
}
function _temp0(s) {
  let count = s.plugins.errors.length;
  for (const m of s.plugins.installationStatus.marketplaces) {
    if (m.status === "failed") {
      count++;
    }
  }
  return count;
}
