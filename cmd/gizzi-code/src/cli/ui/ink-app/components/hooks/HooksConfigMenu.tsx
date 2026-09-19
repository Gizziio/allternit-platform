/**
 * HooksConfigMenu is a read-only browser for configured hooks.
 *
 * Users can drill into each hook event, see configured matchers and hooks
 * (of any type: command, prompt, agent, http), and view individual hook
 * details. To add or modify hooks, users should edit settings.json directly
 * or ask Claude — the menu directs them there.
 *
 * The menu is read-only because the old editing UI only supported
 * command-type hooks and duplicating the settings.json editing surface
 * in-menu for all four types would be a maintenance burden.
 */
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { HookEvent } from './../../entrypoints/agentSdkTypes.ts';
import { useAppState, useAppStateStore } from './../../state/AppState.tsx';
import type { CommandResultDisplay } from '../../commands';
import { useSettingsChange } from '../../hooks/useSettingsChange';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { getHookEventMetadata, getHooksForMatcher, getMatcherMetadata, getSortedMatchersForEvent, groupHooksByEventAndMatcher } from '../../utils/hooks/hooksConfigManager';
import type { IndividualHookConfig } from '../../utils/hooks/hooksSettings';
import { getSettings_DEPRECATED, getSettingsForSource } from '../../utils/settings/settings';
import { plural } from '../../utils/stringUtils';
import { Dialog } from '../design-system/Dialog';
import { SelectEventMode } from './SelectEventMode';
import { SelectHookMode } from './SelectHookMode';
import { SelectMatcherMode } from './SelectMatcherMode';
import { ViewHookMode } from './ViewHookMode';
type Props = {
  toolNames: string[];
  onExit: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
type ModeState = {
  mode: 'select-event';
} | {
  mode: 'select-matcher';
  event: HookEvent;
} | {
  mode: 'select-hook';
  event: HookEvent;
  matcher: string;
} | {
  mode: 'view-hook';
  event: HookEvent;
  hook: IndividualHookConfig;
};
export function HooksConfigMenu({
    toolNames,
    onExit
}: Props) {
  const t1: ModeState = {
      mode: "select-event"
    };

  const [modeState, setModeState] = useState<ModeState>(t1);
  const [disabledByPolicy, setDisabledByPolicy] = useState(_temp);
  const [restrictedByPolicy, setRestrictedByPolicy] = useState(_temp2);
  const t2 = source => {
      if (source === "policySettings") {
        const settings_0 = getSettings_DEPRECATED();
        const hooksDisabled_0 = settings_0?.disableAllHooks === true;
        setDisabledByPolicy(hooksDisabled_0 && getSettingsForSource("policySettings")?.disableAllHooks === true);
        setRestrictedByPolicy(getSettingsForSource("policySettings")?.allowManagedHooksOnly === true);
      }
    };

  useSettingsChange(t2);
  const mode = modeState.mode;
  const selectedEvent = "event" in modeState ? modeState.event : "PreToolUse";
  const selectedMatcher = "matcher" in modeState ? modeState.matcher : null;
  const mcp = useAppState(_temp3);
  const appStateStore = useAppStateStore();
  const t3 = [...toolNames, ...mcp.tools.map(_temp4)];

  const combinedToolNames = t3;
  const t4 = groupHooksByEventAndMatcher(appStateStore.getState(), combinedToolNames);

  const hooksByEventAndMatcher = t4;
  const t5 = getSortedMatchersForEvent(hooksByEventAndMatcher, selectedEvent);

  const sortedMatchersForSelectedEvent = t5;
  const t6 = getHooksForMatcher(hooksByEventAndMatcher, selectedEvent, selectedMatcher);

  const hooksForSelectedMatcher = t6;
  const t7 = () => {
      onExit("Hooks dialog dismissed", {
        display: "system"
      });
    };

  const handleExit = t7;
  const t8 = mode === "select-event";
  const t9 = {
      context: "Confirmation",
      isActive: t8
    };

  useKeybinding("confirm:no", handleExit, t9);
  const t10 = () => {
      setModeState({
        mode: "select-event"
      });
    };

  const t11 = mode === "select-matcher";
  const t12 = {
      context: "Confirmation",
      isActive: t11
    };

  useKeybinding("confirm:no", t10, t12);
  const t13 = () => {
      if ("event" in modeState) {
        if (getMatcherMetadata(modeState.event, combinedToolNames) !== undefined) {
          setModeState({
            mode: "select-matcher",
            event: modeState.event
          });
        } else {
          setModeState({
            mode: "select-event"
          });
        }
      }
    };

  const t14 = mode === "select-hook";
  const t15 = {
      context: "Confirmation",
      isActive: t14
    };

  useKeybinding("confirm:no", t13, t15);
  const t16 = () => {
      if (modeState.mode === "view-hook") {
        const {
          event,
          hook
        } = modeState;
        setModeState({
          mode: "select-hook",
          event,
          matcher: hook.matcher || ""
        });
      }
    };

  const t17 = mode === "view-hook";
  const t18 = {
      context: "Confirmation",
      isActive: t17
    };

  useKeybinding("confirm:no", t16, t18);
  const t19 = getHookEventMetadata(combinedToolNames);

  const hookEventMetadata = t19;
  const settings_1 = getSettings_DEPRECATED();
  const hooksDisabled_1 = settings_1?.disableAllHooks === true;
  const byEvent = {};
  let total = 0;
  for (const [event_0, matchers] of Object.entries(hooksByEventAndMatcher)) {
      const eventCount = Object.values(matchers).reduce(_temp5, 0);
      byEvent[event_0 as HookEvent] = eventCount;
      total = total + eventCount;
    }
  const t20 = {
      hooksByEvent: byEvent,
      totalHooksCount: total
    };

  const {
    hooksByEvent,
    totalHooksCount
  } = t20;
  if (hooksDisabled_1) {
    const t21 = <Text bold={true}>disabled</Text>;

    const t22 = disabledByPolicy && " by a managed settings file";
    const t23 = <Text bold={true}>{totalHooksCount}</Text>;

    const t24 = plural(totalHooksCount, "hook");

    const t25 = plural(totalHooksCount, "is", "are");

    const t26 = <Text>All hooks are currently {t21}{t22}. You have{" "}{t23} configured{" "}{t24} that{" "}{t25} not running.</Text>;

    const t27 = <Box marginTop={1}><Text dimColor={true}>When hooks are disabled:</Text></Box>;
    const t28 = <Text dimColor={true}>· No hook commands will execute</Text>;
    const t29 = <Text dimColor={true}>· StatusLine will not be displayed</Text>;
    const t30 = <Text dimColor={true}>· Tool operations will proceed without hook validation</Text>;

    const t31 = <Box flexDirection="column">{t26}{t27}{t28}{t29}{t30}</Box>;

    const t32 = !disabledByPolicy && <Text dimColor={true}>To re-enable hooks, remove "disableAllHooks" from settings.json or ask Gizzide.</Text>;

    const t33 = <Box flexDirection="column" gap={1}>{t31}{t32}</Box>;

    const t34 = <Dialog title="Hook Configuration - Disabled" onCancel={handleExit} inputGuide={_temp6}>{t33}</Dialog>;

    return t34;
  }
  switch (modeState.mode) {
    case "select-event":
      {
        const t21 = event_2 => {
            if (getMatcherMetadata(event_2, combinedToolNames) !== undefined) {
              setModeState({
                mode: "select-matcher",
                event: event_2
              });
            } else {
              setModeState({
                mode: "select-hook",
                event: event_2,
                matcher: ""
              });
            }
          };

        const t22 = <SelectEventMode hookEventMetadata={hookEventMetadata} hooksByEvent={hooksByEvent} totalHooksCount={totalHooksCount} restrictedByPolicy={restrictedByPolicy} onSelectEvent={t21} onCancel={handleExit} />;

        return t22;
      }
    case "select-matcher":
      {
        const t21 = hookEventMetadata[modeState.event];
        const t22 = matcher => {
            setModeState({
              mode: "select-hook",
              event: modeState.event,
              matcher
            });
          };

        const t23 = () => {
            setModeState({
              mode: "select-event"
            });
          };

        const t24 = <SelectMatcherMode selectedEvent={modeState.event} matchersForSelectedEvent={sortedMatchersForSelectedEvent} hooksByEventAndMatcher={hooksByEventAndMatcher} eventDescription={t21.description} onSelect={t22} onCancel={t23} />;

        return t24;
      }
    case "select-hook":
      {
        const t21 = hookEventMetadata[modeState.event];
        const t22 = hook_1 => {
            setModeState({
              mode: "view-hook",
              event: modeState.event,
              hook: hook_1
            });
          };

        const t23 = () => {
            if (getMatcherMetadata(modeState.event, combinedToolNames) !== undefined) {
              setModeState({
                mode: "select-matcher",
                event: modeState.event
              });
            } else {
              setModeState({
                mode: "select-event"
              });
            }
          };

        const t24 = <SelectHookMode selectedEvent={modeState.event} selectedMatcher={modeState.matcher} hooksForSelectedMatcher={hooksForSelectedMatcher} hookEventMetadata={t21} onSelect={t22} onCancel={t23} />;

        return t24;
      }
    case "view-hook":
      {
        const t21 = modeState.hook;
        const t22 = getMatcherMetadata(modeState.event, combinedToolNames);

        const t23 = t22 !== undefined;
        const t24 = () => {
            const {
              event: event_1,
              hook: hook_0
            } = modeState;
            setModeState({
              mode: "select-hook",
              event: event_1,
              matcher: hook_0.matcher || ""
            });
          };

        const t25 = <ViewHookMode selectedHook={t21} eventSupportsMatcher={t23} onCancel={t24} />;

        return t25;
      }
  }
}
function _temp6() {
  return <Text>Esc to close</Text>;
}
function _temp5(sum, hooks) {
  return sum + hooks.length;
}
function _temp4(tool) {
  return tool.name;
}
function _temp3(s) {
  return s.mcp;
}
function _temp2() {
  return getSettingsForSource("policySettings")?.allowManagedHooksOnly === true;
}
function _temp() {
  const settings = getSettings_DEPRECATED();
  const hooksDisabled = settings?.disableAllHooks === true;
  return hooksDisabled && getSettingsForSource("policySettings")?.disableAllHooks === true;
}
