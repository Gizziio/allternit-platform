import chalk from '@/shared/util/chalk'
import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState, useSetAppState } from './../../../state/AppState.tsx';
import { applyPermissionUpdate, persistPermissionUpdate } from './../../../utils/permissions/PermissionUpdate.ts';
import type { PermissionUpdateDestination } from './../../../utils/permissions/PermissionUpdateSchema.ts';
import type { CommandResultDisplay } from '../../../commands';
import { Select } from '../../../components/CustomSelect/select';
import { useExitOnCtrlCDWithKeybindings } from '../../../hooks/useExitOnCtrlCDWithKeybindings';
import { useSearchInput } from '../../../hooks/useSearchInput';
import type { KeyboardEvent } from '../../../ink/events/keyboard-event';
import { Box, Text, useTerminalFocus } from '../../../ink';
import { useKeybinding } from '../../../keybindings/useKeybinding';
import { type AutoModeDenial, getAutoModeDenials } from '../../../utils/autoModeDenials';
import type { PermissionBehavior, PermissionRule, PermissionRuleValue } from '../../../utils/permissions/PermissionRule';
import { permissionRuleValueToString } from '../../../utils/permissions/permissionRuleParser';
import { deletePermissionRule, getAllowRules, getAskRules, getDenyRules, permissionRuleSourceDisplayString } from '../../../utils/permissions/permissions';
import type { UnreachableRule } from '../../../utils/permissions/shadowedRuleDetection';
import { jsonStringify } from '../../../utils/slowOperations';
import { Pane } from '../../design-system/Pane';
import { Tab, Tabs, useTabHeaderFocus, useTabsWidth } from '../../design-system/Tabs';
import { SearchBox } from '../../SearchBox';
// ui/option is a stub ("not yet implemented"); restore the option shape this
// list builds — {label, value} pairs fed to CustomSelect.
type Option = {
  label: React.ReactNode;
  value: string;
};
import { AddPermissionRules } from './AddPermissionRules';
import { AddWorkspaceDirectory } from './AddWorkspaceDirectory';
import { PermissionRuleDescription } from './PermissionRuleDescription';
import { PermissionRuleInput } from './PermissionRuleInput';
import { RecentDenialsTab } from './RecentDenialsTab';
import { RemoveWorkspaceDirectory } from './RemoveWorkspaceDirectory';
import { WorkspaceTab } from './WorkspaceTab';
type TabType = 'recent' | 'allow' | 'ask' | 'deny' | 'workspace';
type RuleSourceTextProps = {
  rule: PermissionRule;
};
function RuleSourceText({
    rule
}: RuleSourceTextProps) {
  const t1 = permissionRuleSourceDisplayString(rule.source);

  const t2 = `From ${t1}`;
  const t3 = <Text dimColor={true}>{t2}</Text>;

  return t3;
}

// Helper function to get the appropriate label for rule behavior
function getRuleBehaviorLabel(ruleBehavior: PermissionBehavior): string {
  switch (ruleBehavior) {
    case 'allow':
      return 'allowed';
    case 'deny':
      return 'denied';
    case 'ask':
      return 'ask';
  }
}

// Component for showing tool details and managing the interactive deletion workflow
function RuleDetails(t0) {
  const {
    rule,
    onDelete,
    onCancel
  } = t0;
  const exitState = useExitOnCtrlCDWithKeybindings();
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onCancel, t1);
  const t2 = permissionRuleValueToString(rule.ruleValue);

  const t3 = <Text bold={true}>{t2}</Text>;

  const t4 = <PermissionRuleDescription ruleValue={rule.ruleValue} />;

  const t5 = <RuleSourceText rule={rule} />;

  const t6 = <Box flexDirection="column" marginX={2}>{t3}{t4}{t5}</Box>;

  const ruleDescription = t6;
  const t7 = <Box marginLeft={3}>{exitState.pending ? <Text dimColor={true}>Press {exitState.keyName} again to exit</Text> : <Text dimColor={true}>Esc to cancel</Text>}</Box>;

  const footer = t7;
  if (rule.source === "policySettings") {
    const t8 = <Text bold={true} color="permission">Rule details</Text>;

    const t9 = <Text italic={true}>This rule is configured by managed settings and cannot be modified.{"\n"}Contact your system administrator for more information.</Text>;

    const t10 = <Box flexDirection="column" gap={1} borderStyle="round" paddingLeft={1} paddingRight={1} borderColor="permission">{t8}{ruleDescription}{t9}</Box>;

    const t11 = <>{t10}{footer}</>;

    return t11;
  }
  const t8 = getRuleBehaviorLabel(rule.ruleBehavior);

  const t9 = <Text bold={true} color="error">Delete {t8} tool?</Text>;

  const t10 = <Text>Are you sure you want to delete this permission rule?</Text>;

  const t11 = _ => _ === "yes" ? onDelete() : onCancel();

  const t12 = [{
      label: "Yes",
      value: "yes"
    }, {
      label: "No",
      value: "no"
    }];

  const t13 = <Select onChange={t11} onCancel={onCancel} options={t12} />;

  const t14 = <Box flexDirection="column" gap={1} borderStyle="round" paddingLeft={1} paddingRight={1} borderColor="error">{t9}{ruleDescription}{t10}{t13}</Box>;

  const t15 = <>{t14}{footer}</>;

  return t15;
}
type RulesTabContentProps = {
  options: Option[];
  searchQuery: string;
  isSearchMode: boolean;
  isFocused: boolean;
  onSelect: (value: string) => void;
  onCancel: () => void;
  lastFocusedRuleKey: string | undefined;
  cursorOffset?: number;
  onHeaderFocusChange?: (focused: boolean) => void;
};

// Component for rendering rules tab content with full width support
function RulesTabContent(props) {
  const {
    options,
    searchQuery,
    isSearchMode,
    isFocused,
    onSelect,
    onCancel,
    lastFocusedRuleKey,
    cursorOffset,
    onHeaderFocusChange
  } = props;
  const tabWidth = useTabsWidth();
  const {
    headerFocused,
    focusHeader,
    blurHeader
  } = useTabHeaderFocus();
  const t0 = () => {
      if (isSearchMode && headerFocused) {
        blurHeader();
      }
    };
  const t1 = [isSearchMode, headerFocused, blurHeader];

  useEffect(t0, t1);
  const t2 = () => {
      onHeaderFocusChange?.(headerFocused);
    };
  const t3 = [headerFocused, onHeaderFocusChange];

  useEffect(t2, t3);
  const t4 = isSearchMode && !headerFocused;
  const t5 = <Box marginBottom={1} flexDirection="column"><SearchBox query={searchQuery} isFocused={t4} isTerminalFocused={isFocused} width={tabWidth} cursorOffset={cursorOffset} /></Box>;

  const t6 = Math.min(10, options.length);
  const t7 = isSearchMode || headerFocused;
  const t8 = <Select options={options} onChange={onSelect} onCancel={onCancel} visibleOptionCount={t6} isDisabled={t7} defaultFocusValue={lastFocusedRuleKey} onUpFromFirstItem={focusHeader} />;

  const t9 = <Box flexDirection="column">{t5}{t8}</Box>;

  return t9;
}

// Composes the subtitle + search + Select for a single allow/ask/deny tab.
function PermissionRulesTab(t0) {
  let T0;
  let T1;
  let handleToolSelect;
  let rulesProps;
  let t1;
  let t2;
  let t3;
  let t4;
  let tab;
  const {
    tab: t5,
    getRulesOptions,
    handleToolSelect: t6,
    ...t7
  } = t0;
  tab = t5;
  handleToolSelect = t6;
  rulesProps = t7;
  T1 = Box;
  t2 = "column";
  t3 = tab === "allow" ? 0 : undefined;
  const t8 = {
      allow: "Gizzi Code won't ask before using allowed tools.",
      ask: "Gizzi Code will always ask for confirmation before using these tools.",
      deny: "Gizzi Code will always reject requests to use denied tools."
    };

  const t9 = t8[tab];

    t4 = <Text>{t9}</Text>;
  
  T0 = RulesTabContent;
  t1 = getRulesOptions(tab, rulesProps.searchQuery);
  

  const t5_2 = v => handleToolSelect(v, tab);

  const t6_2 = <T0 options={t1.options} onSelect={t5_2} {...rulesProps} />;

  const t7_2 = <T1 flexDirection={t2} flexShrink={t3}>{t4}{t6_2}</T1>;

  return t7_2;
}
type Props = {
  onExit: (result?: string, options?: {
    display?: CommandResultDisplay;
    shouldQuery?: boolean;
    metaMessages?: string[];
  }) => void;
  initialTab?: TabType;
  onRetryDenials?: (commands: string[]) => void;
};
export function PermissionRuleList({
    onExit,
    initialTab,
    onRetryDenials
}: Props) {
  const t1 = getAutoModeDenials();

  const hasDenials = t1.length > 0;
  const defaultTab = initialTab ?? (hasDenials ? "recent" : "allow");
  const t2 = [];

  const [changes, setChanges] = useState(t2);
  const toolPermissionContext = useAppState(_temp);
  const setAppState = useSetAppState();
  const isTerminalFocused = useTerminalFocus();
  const t3: {
    approved: Set<number>;
    retry: Set<number>;
    denials: AutoModeDenial[];
  } = {
      approved: new Set(),
      retry: new Set(),
      denials: []
    };

  const denialStateRef = useRef(t3);
  const t4 = s_0 => {
      denialStateRef.current = s_0;
    };

  const handleDenialStateChange = t4;
  const [selectedRule, setSelectedRule] = useState<PermissionRule | undefined>();
  const [lastFocusedRuleKey, setLastFocusedRuleKey] = useState<string | undefined>();
  const [addingRuleToTab, setAddingRuleToTab] = useState<TabType | null>(null);
  const [validatedRule, setValidatedRule] = useState<{
    ruleValue: PermissionRuleValue;
    ruleBehavior: PermissionBehavior;
  } | null>(null);
  const [isAddingWorkspaceDirectory, setIsAddingWorkspaceDirectory] = useState(false);
  const [removingDirectory, setRemovingDirectory] = useState(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [headerFocused, setHeaderFocused] = useState(true);
  const t5 = focused => {
      setHeaderFocused(focused);
    };

  const handleHeaderFocusChange = t5;
  const map = new Map();
  getAllowRules(toolPermissionContext).forEach(rule => {
      map.set(jsonStringify(rule), rule);
    });

  const allowRulesByKey = map;
  const map_0 = new Map();
  getDenyRules(toolPermissionContext).forEach(rule_0 => {
      map_0.set(jsonStringify(rule_0), rule_0);
    });

  const denyRulesByKey = map_0;
  const map_1 = new Map();
  getAskRules(toolPermissionContext).forEach(rule_1 => {
      map_1.set(jsonStringify(rule_1), rule_1);
    });

  const askRulesByKey = map_1;
  const t6 = (tab: TabType, t7?: string) => {
      const query = t7 === undefined ? "" : t7;
      const rulesByKey = (() => {
        switch (tab) {
          case "allow":
            {
              return allowRulesByKey;
            }
          case "deny":
            {
              return denyRulesByKey;
            }
          case "ask":
            {
              return askRulesByKey;
            }
          case "workspace":
          case "recent":
            {
              return new Map();
            }
        }
      })();
      const options = [];
      if (tab !== "workspace" && tab !== "recent" && !query) {
        options.push({
          label: `Add a new rule${figures.ellipsis}`,
          value: "add-new-rule"
        });
      }
      const sortedRuleKeys = Array.from(rulesByKey.keys()).sort((a, b) => {
        const ruleA = rulesByKey.get(a);
        const ruleB = rulesByKey.get(b);
        if (ruleA && ruleB) {
          const ruleAString = permissionRuleValueToString(ruleA.ruleValue).toLowerCase();
          const ruleBString = permissionRuleValueToString(ruleB.ruleValue).toLowerCase();
          return ruleAString.localeCompare(ruleBString);
        }
        return 0;
      });
      const lowerQuery = query.toLowerCase();
      for (const ruleKey of sortedRuleKeys) {
        const rule_2 = rulesByKey.get(ruleKey);
        if (rule_2) {
          const ruleString = permissionRuleValueToString(rule_2.ruleValue);
          if (query && !ruleString.toLowerCase().includes(lowerQuery)) {
            continue;
          }
          options.push({
            label: ruleString,
            value: ruleKey
          });
        }
      }
      return {
        options,
        rulesByKey
      };
    };

  const getRulesOptions = t6;
  const exitState = useExitOnCtrlCDWithKeybindings();
  const isSearchModeActive = !selectedRule && !addingRuleToTab && !validatedRule && !isAddingWorkspaceDirectory && !removingDirectory;
  const t7 = isSearchModeActive && isSearchMode;
  const t8 = () => {
      setIsSearchMode(false);
    };

  const t9 = {
      isActive: t7,
      onExit: t8
    };

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput(t9);
  const t10 = e => {
      if (!isSearchModeActive) {
        return;
      }
      if (isSearchMode) {
        return;
      }
      if (e.ctrl || e.meta) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setIsSearchMode(true);
        setSearchQuery("");
      } else {
        if (e.key.length === 1 && e.key !== "j" && e.key !== "k" && e.key !== "m" && e.key !== "i" && e.key !== "r" && e.key !== " ") {
          e.preventDefault();
          setIsSearchMode(true);
          setSearchQuery(e.key);
        }
      }
    };

  const handleKeyDown = t10;
  const t11 = (selectedValue, tab_0) => {
      const {
        rulesByKey: rulesByKey_0
      } = getRulesOptions(tab_0);
      if (selectedValue === "add-new-rule") {
        setAddingRuleToTab(tab_0);
        return;
      } else {
        setSelectedRule(rulesByKey_0.get(selectedValue));
        return;
      }
    };

  const handleToolSelect = t11;
  const t12 = () => {
      setAddingRuleToTab(null);
    };

  const handleRuleInputCancel = t12;
  const t13 = (ruleValue, ruleBehavior) => {
      setValidatedRule({
        ruleValue,
        ruleBehavior
      });
      setAddingRuleToTab(null);
    };

  const handleRuleInputSubmit = t13;
  const t14 = (rules, unreachable) => {
      setValidatedRule(null);
      for (const rule_3 of rules) {
        setChanges(prev => [...prev, `Added ${rule_3.ruleBehavior} rule ${chalk.bold(permissionRuleValueToString(rule_3.ruleValue))}`]);
      }
      if (unreachable && unreachable.length > 0) {
        for (const u of unreachable) {
          const severity = u.shadowType === "deny" ? "blocked" : "shadowed";
          setChanges(prev_0 => [...prev_0, chalk.yellow(`${figures.warning} Warning: ${permissionRuleValueToString(u.rule.ruleValue)} is ${severity}`), chalk.dim(`  ${u.reason}`), chalk.dim(`  Fix: ${u.fix}`)]);
        }
      }
    };

  const handleAddRulesSuccess = t14;
  const t15 = () => {
      setValidatedRule(null);
    };

  const handleAddRuleCancel = t15;
  const t16 = () => setIsAddingWorkspaceDirectory(true);

  const handleRequestAddDirectory = t16;
  const t17 = path => setRemovingDirectory(path);

  const handleRequestRemoveDirectory = t17;
  const t18 = () => {
      const s_1 = denialStateRef.current;
      const denialsFor = (set: Set<number>) => Array.from(set).map(idx => s_1.denials[idx]).filter(_temp2);
      const retryDenials = denialsFor(s_1.retry);
      if (retryDenials.length > 0) {
        const commands = retryDenials.map(_temp3);
        onRetryDenials?.(commands);
        onExit(undefined, {
          shouldQuery: true,
          metaMessages: [`Permission granted for: ${commands.join(", ")}. You may now retry ${commands.length === 1 ? "this command" : "these commands"} if you would like.`]
        });
        return;
      }
      const approvedDenials = denialsFor(s_1.approved);
      if (approvedDenials.length > 0 || changes.length > 0) {
        const approvedMsg = approvedDenials.length > 0 ? [`Approved ${approvedDenials.map(_temp4).join(", ")}`] : [];
        onExit([...approvedMsg, ...changes].join("\n"));
      } else {
        onExit("Permissions dialog dismissed", {
          display: "system"
        });
      }
    };

  const handleRulesCancel = t18;
  const t19 = isSearchModeActive && !isSearchMode;
  const t20 = {
      context: "Settings",
      isActive: t19
    };

  useKeybinding("confirm:no", handleRulesCancel, t20);
  const t21 = () => {
      if (!selectedRule) {
        return;
      }
      const {
        options: options_0
      } = getRulesOptions(selectedRule.ruleBehavior as TabType);
      const selectedKey = jsonStringify(selectedRule);
      const ruleKeys = options_0.filter(_temp5).map(_temp6);
      const currentIndex = ruleKeys.indexOf(selectedKey);
      let nextFocusKey;
      if (currentIndex !== -1) {
        if (currentIndex < ruleKeys.length - 1) {
          nextFocusKey = ruleKeys[currentIndex + 1];
        } else {
          if (currentIndex > 0) {
            nextFocusKey = ruleKeys[currentIndex - 1];
          }
        }
      }
      setLastFocusedRuleKey(nextFocusKey);
      deletePermissionRule({
        rule: selectedRule,
        initialContext: toolPermissionContext,
        setToolPermissionContext(toolPermissionContext_0) {
          setAppState(prev_1 => ({
            ...prev_1,
            toolPermissionContext: toolPermissionContext_0
          }));
        }
      });
      setChanges(prev_2 => [...prev_2, `Deleted ${selectedRule.ruleBehavior} rule ${chalk.bold(permissionRuleValueToString(selectedRule.ruleValue))}`]);
      setSelectedRule(undefined);
    };

  const handleDeleteRule = t21;
  if (selectedRule) {
    const t22 = () => setSelectedRule(undefined);

    const t23 = <RuleDetails rule={selectedRule} onDelete={handleDeleteRule} onCancel={t22} />;

    return t23;
  }
  if (addingRuleToTab && addingRuleToTab !== "workspace" && addingRuleToTab !== "recent") {
    const t22 = <PermissionRuleInput onCancel={handleRuleInputCancel} onSubmit={handleRuleInputSubmit} ruleBehavior={addingRuleToTab} />;

    return t22;
  }
  if (validatedRule) {
    const t22 = [validatedRule.ruleValue];

    const t23 = toolPermissionContext_1 => {
        setAppState(prev_3 => ({
          ...prev_3,
          toolPermissionContext: toolPermissionContext_1
        }));
      };

    const t24 = <AddPermissionRules onAddRules={handleAddRulesSuccess} onCancel={handleAddRuleCancel} ruleValues={t22} ruleBehavior={validatedRule.ruleBehavior} initialContext={toolPermissionContext} setToolPermissionContext={t23} />;

    return t24;
  }
  if (isAddingWorkspaceDirectory) {
    const t22 = (path_0: string, remember: boolean) => {
        const destination = (remember ? "localSettings" : "session") as PermissionUpdateDestination;
        const permissionUpdate = {
          type: "addDirectories" as const,
          directories: [path_0],
          destination
        };
        const updatedContext = applyPermissionUpdate(toolPermissionContext, permissionUpdate);
        setAppState(prev_4 => ({
          ...prev_4,
          toolPermissionContext: updatedContext
        }));
        if (remember) {
          persistPermissionUpdate(permissionUpdate);
        }
        setChanges(prev_5 => [...prev_5, `Added directory ${chalk.bold(path_0)} to workspace${remember ? " and saved to local settings" : " for this session"}`]);
        setIsAddingWorkspaceDirectory(false);
      };

    const t23 = () => setIsAddingWorkspaceDirectory(false);

    const t24 = <AddWorkspaceDirectory onAddDirectory={t22} onCancel={t23} permissionContext={toolPermissionContext} />;

    return t24;
  }
  if (removingDirectory) {
    const t22 = () => {
        setChanges(prev_6 => [...prev_6, `Removed directory ${chalk.bold(removingDirectory)} from workspace`]);
        setRemovingDirectory(null);
      };

    const t23 = () => setRemovingDirectory(null);

    const t24 = toolPermissionContext_2 => {
        setAppState(prev_7 => ({
          ...prev_7,
          toolPermissionContext: toolPermissionContext_2
        }));
      };

    const t25 = <RemoveWorkspaceDirectory directoryPath={removingDirectory} onRemove={t22} onCancel={t23} permissionContext={toolPermissionContext} setPermissionContext={t24} />;

    return t25;
  }
  const t22 = {
      searchQuery,
      isSearchMode,
      isFocused: isTerminalFocused,
      onCancel: handleRulesCancel,
      lastFocusedRuleKey,
      cursorOffset: searchCursorOffset,
      getRulesOptions,
      handleToolSelect,
      onHeaderFocusChange: handleHeaderFocusChange
    };

  const sharedRulesProps = t22;
  const isHidden = !!selectedRule || !!addingRuleToTab || !!validatedRule || isAddingWorkspaceDirectory || !!removingDirectory;
  const t23 = !isSearchMode;
  const t24 = <Tab id="recent" title="Recently denied"><RecentDenialsTab onHeaderFocusChange={handleHeaderFocusChange} onStateChange={handleDenialStateChange} /></Tab>;

  const t25 = <Tab id="allow" title="Allow"><PermissionRulesTab tab="allow" {...sharedRulesProps} /></Tab>;

  const t26 = <Tab id="ask" title="Ask"><PermissionRulesTab tab="ask" {...sharedRulesProps} /></Tab>;

  const t27 = <Tab id="deny" title="Deny"><PermissionRulesTab tab="deny" {...sharedRulesProps} /></Tab>;

  const t28 = <Text>Gizzi Code can read files in the workspace, and make edits when auto-accept edits is on.</Text>;

  const t29 = <Tab id="workspace" title="Workspace"><Box flexDirection="column">{t28}<WorkspaceTab onExit={onExit} toolPermissionContext={toolPermissionContext} onRequestAddDirectory={handleRequestAddDirectory} onRequestRemoveDirectory={handleRequestRemoveDirectory} onHeaderFocusChange={handleHeaderFocusChange} /></Box></Tab>;

  const t30 = <Tabs title="Permissions:" color="permission" defaultTab={defaultTab} hidden={isHidden} initialHeaderFocused={!hasDenials} navFromContent={t23}>{t24}{t25}{t26}{t27}{t29}</Tabs>;

  const t31 = <Box marginTop={1} paddingLeft={1}><Text dimColor={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : headerFocused ? <>←/→ tab switch · ↓ return · Esc cancel</> : isSearchMode ? <>Type to filter · Enter/↓ select · ↑ tabs · Esc clear</> : hasDenials && defaultTab === "recent" ? <>Enter approve · r retry · ↑↓ navigate · ←/→ switch · Esc cancel</> : <>↑↓ navigate · Enter select · Type to search · ←/→ switch · Esc cancel</>}</Text></Box>;

  const t32 = <Pane color="permission">{t30}{t31}</Pane>;

  const t33 = <Box flexDirection="column" onKeyDown={handleKeyDown}>{t32}</Box>;

  return t33;
}
function _temp6(opt_0) {
  return opt_0.value;
}
function _temp5(opt) {
  return opt.value !== "add-new-rule";
}
function _temp4(d_1) {
  return chalk.bold(d_1.display);
}
function _temp3(d_0) {
  return d_0.display;
}
function _temp2(d) {
  return d !== undefined;
}
function _temp(s) {
  return s.toolPermissionContext;
}
