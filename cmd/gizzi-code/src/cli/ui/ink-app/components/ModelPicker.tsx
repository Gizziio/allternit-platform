import capitalize from 'lodash-es/capitalize';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useExitOnCtrlCDWithKeybindings } from './../hooks/useExitOnCtrlCDWithKeybindings.ts';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from './../services/analytics/index.ts';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from './../utils/fastMode.ts';
import { Box, Text } from '../ink';
import { useKeybindings } from '../keybindings/useKeybinding';
import { useAppState, useSetAppState } from '../state/AppState';
import { convertEffortValueToLevel, type EffortLevel, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model';
import { getModelOptions } from '../utils/model/modelOptions';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { Select } from './CustomSelect/index';
import { Byline } from './design-system/Byline';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { Pane } from './design-system/Pane';
import { effortLevelToSymbol } from './EffortIndicator';
export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped (written to the assistant's .claude/settings.json via
   * install.ts) and should not leak to the user's global ~/.claude/settings.
   */
  skipSettingsWrite?: boolean;
};
const NO_PREFERENCE = '__NO_PREFERENCE__';
export function ModelPicker({
    initial,
    sessionModel,
    onSelect,
    onCancel,
    isStandaloneCommand,
    showFastModeNotice,
    headerText,
    skipSettingsWrite
}: Props) {
  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const initialValue = initial === null ? NO_PREFERENCE : initial;
  const [focusedValue, setFocusedValue] = useState(initialValue);
  const isFastMode = useAppState(_temp);
  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const effortValue = useAppState(_temp2);
  const t1 = effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined;

  const [effort, setEffort] = useState(t1);
  const t2 = isFastMode ?? false;
  const t3 = getModelOptions(t2);

  const modelOptions = t3;
  let t4;
  bb0: {
    if (initial !== null && !modelOptions.some(opt => opt.value === initial)) {
      const t5 = modelDisplayString(initial);

      const t6 = {
          value: initial,
          label: t5,
          description: "Current model"
        };

      const t7 = [...modelOptions, t6];

      t4 = t7;
      break bb0;
    }
    t4 = modelOptions;
  }
  const optionsWithInitial = t4;
  const t5 = optionsWithInitial.map(_temp3);

  const selectOptions = t5;
  const t6 = selectOptions.some(_ => _.value === initialValue) ? initialValue : selectOptions[0]?.value ?? undefined;

  const initialFocusValue = t6;
  const visibleCount = Math.min(10, selectOptions.length);
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount);
  const t7 = selectOptions.find(opt_1 => opt_1.value === focusedValue)?.label;

  const focusedModelName = t7;
  const focusedModel = resolveOptionModel(focusedValue);
  const focusedSupportsEffort = focusedModel ? modelSupportsEffort(focusedModel) : false;
  const t8 = focusedModel ? modelSupportsMaxEffort(focusedModel) : false;

  const focusedSupportsMax = t8;
  const t9 = getDefaultEffortLevelForOption(focusedValue);

  const focusedDefaultEffort = t9;
  const displayEffort = effort === "max" && !focusedSupportsMax ? "high" : effort;
  const t10 = value => {
      setFocusedValue(value);
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(value));
      }
    };

  const handleFocus = t10;
  const t11 = direction => {
      if (!focusedSupportsEffort) {
        return;
      }
      setEffort(prev => cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsMax));
      setHasToggledEffort(true);
    };

  const handleCycleEffort = t11;
  const t12 = {
      "modelPicker:decreaseEffort": () => handleCycleEffort("left"),
      "modelPicker:increaseEffort": () => handleCycleEffort("right")
    };

  const t13 = {
      context: "ModelPicker"
    };

  useKeybindings(t12, t13);
  const t14 = function handleSelect(value_0) {
      logEvent("tengu_model_command_menu_effort", {
        effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (!skipSettingsWrite) {
        const effortLevel = resolvePickerEffortPersistence(effort, getDefaultEffortLevelForOption(value_0), getSettingsForSource("userSettings")?.effortLevel, hasToggledEffort);
        const persistable = toPersistableEffort(effortLevel);
        if (persistable !== undefined) {
          updateSettingsForSource("userSettings", {
            effortLevel: persistable
          });
        }
        setAppState(prev_0 => ({
          ...prev_0,
          effortValue: effortLevel
        }));
      }
      const selectedModel = resolveOptionModel(value_0);
      const selectedEffort = hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel) ? effort : undefined;
      if (value_0 === NO_PREFERENCE) {
        onSelect(null, selectedEffort);
        return;
      }
      onSelect(value_0, selectedEffort);
    };

  const handleSelect = t14;
  const t15 = <Text color="remember" bold={true}>Select model</Text>;

  const t16 = headerText ?? "Switch models. Applies to this session and future Gizzi Code sessions. For other/previous model names, specify with --model.";
  const t17 = <Text dimColor={true}>{t16}</Text>;

  const t18 = sessionModel && <Text dimColor={true}>Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.</Text>;

  const t19 = <Box marginBottom={1} flexDirection="column">{t15}{t17}{t18}</Box>;

  const t20 = onCancel ?? _temp4;
  const t21 = <Box flexDirection="column"><Select defaultValue={initialValue} defaultFocusValue={initialFocusValue} options={selectOptions} onChange={handleSelect} onFocus={handleFocus} onCancel={t20} visibleOptionCount={visibleCount} /></Box>;

  const t22 = hiddenCount > 0 && <Box paddingLeft={3}><Text dimColor={true}>and {hiddenCount} more…</Text></Box>;

  const t23 = <Box flexDirection="column" marginBottom={1}>{t21}{t22}</Box>;

  const t24 = <Box marginBottom={1} flexDirection="column">{focusedSupportsEffort ? <Text dimColor={true}><EffortLevelIndicator effort={displayEffort} />{" "}{capitalize(displayEffort)} effort{displayEffort === focusedDefaultEffort ? " (default)" : ""}{" "}<Text color="subtle">← → to adjust</Text></Text> : <Text color="subtle"><EffortLevelIndicator effort={undefined} /> Effort not supported{focusedModelName ? ` for ${focusedModelName}` : ""}</Text>}</Box>;

  const t25 = isFastModeEnabled() ? showFastModeNotice ? <Box marginBottom={1}><Text dimColor={true}>Fast mode is <Text bold={true}>ON</Text> and available with{" "}{FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turn off fast mode.</Text></Box> : isFastModeAvailable() && !isFastModeCooldown() ? <Box marginBottom={1}><Text dimColor={true}>Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).</Text></Box> : null : null;

  const t26 = <Box flexDirection="column">{t19}{t23}{t24}{t25}</Box>;

  const t27 = isStandaloneCommand && <Text dimColor={true} italic={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" /></Byline>}</Text>;

  const t28 = <Box flexDirection="column">{t26}{t27}</Box>;

  const content = t28;
  if (!isStandaloneCommand) {
    return content;
  }
  const t29 = <Pane color="permission">{content}</Pane>;

  return t29;
}
function _temp4() {}
function _temp3(opt_0) {
  return {
    ...opt_0,
    value: opt_0.value === null ? NO_PREFERENCE : opt_0.value
  };
}
function _temp2(s_0) {
  return s_0.effortValue;
}
function _temp(s) {
  return isFastModeEnabled() ? s.fastMode : false;
}
function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  return value === NO_PREFERENCE ? getDefaultMainLoopModel() : parseUserSpecifiedModel(value);
}
function EffortLevelIndicator(t0) {
  const {
    effort
  } = t0;
  const t1 = effort ? "gizzi" : "subtle";
  const t2 = effort ?? "low";
  const t3 = effortLevelToSymbol(t2);

  const t4 = <Text color={t1}>{t3}</Text>;

  return t4;
}
function cycleEffortLevel(current: EffortLevel, direction: 'left' | 'right', includeMax: boolean): EffortLevel {
  const levels: EffortLevel[] = includeMax ? ['low', 'medium', 'high', 'max'] : ['low', 'medium', 'high'];
  // If the current level isn't in the cycle (e.g. 'max' after switching to a
  // non-Opus model), clamp to 'high'.
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}
function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}
