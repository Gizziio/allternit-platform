import { feature } from 'bun:bundle';
import * as React from 'react';
import { Box, Text } from './../../ink.ts';
import { getPlatform } from './../../utils/platform.ts';
import { isKeybindingCustomizationEnabled } from '../../keybindings/loadUserBindings';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook';
import { isFastModeAvailable, isFastModeEnabled } from '../../utils/fastMode';
import { getNewlineInstructions } from './utils';

/** Format a shortcut for display in the help menu (e.g., "ctrl+o" → "ctrl + o") */
function formatShortcut(shortcut: string): string {
  return shortcut.replace(/\+/g, ' + ');
}
type Props = {
  dimColor?: boolean;
  fixedWidth?: boolean;
  gap?: number;
  paddingX?: number;
};
export function PromptInputHelpMenu(props) {
  const {
    dimColor,
    fixedWidth,
    gap,
    paddingX
  } = props;
  const t0 = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  const t1 = formatShortcut(t0);

  const transcriptShortcut = t1;
  const t2 = useShortcutDisplay("app:toggleTodos", "Global", "ctrl+t");
  const t3 = formatShortcut(t2);

  const todosShortcut = t3;
  const t4 = useShortcutDisplay("chat:undo", "Chat", "ctrl+_");
  const t5 = formatShortcut(t4);

  const undoShortcut = t5;
  const t6 = useShortcutDisplay("chat:stash", "Chat", "ctrl+s");
  const t7 = formatShortcut(t6);

  const stashShortcut = t7;
  const t8 = useShortcutDisplay("chat:cycleMode", "Chat", "shift+tab");
  const t9 = formatShortcut(t8);

  const cycleModeShortcut = t9;
  const t10 = useShortcutDisplay("chat:modelPicker", "Chat", "alt+p");
  const t11 = formatShortcut(t10);

  const modelPickerShortcut = t11;
  const t12 = useShortcutDisplay("chat:fastMode", "Chat", "alt+o");
  const t13 = formatShortcut(t12);

  const fastModeShortcut = t13;
  const t14 = useShortcutDisplay("chat:externalEditor", "Chat", "ctrl+g");
  const t15 = formatShortcut(t14);

  const externalEditorShortcut = t15;
  const t16 = useShortcutDisplay("app:toggleTerminal", "Global", "meta+j");
  const t17 = formatShortcut(t16);

  const terminalShortcut = t17;
  const t18 = useShortcutDisplay("chat:imagePaste", "Chat", "ctrl+v");
  const t19 = formatShortcut(t18);

  const imagePasteShortcut = t19;
  const t20 = feature("TERMINAL_PANEL") ? getFeatureValue_CACHED_MAY_BE_STALE("tengu_terminal_panel", false) ? <Box><Text dimColor={dimColor}>{terminalShortcut} for terminal</Text></Box> : null : null;

  const terminalShortcutElement = t20;
  const t21 = fixedWidth ? 24 : undefined;
  const t22 = <Box><Text dimColor={dimColor}>! for bash mode</Text></Box>;

  const t23 = <Box><Text dimColor={dimColor}>/ for commands</Text></Box>;

  const t24 = <Box><Text dimColor={dimColor}>@ for file paths</Text></Box>;

  const t25 = <Box><Text dimColor={dimColor}>{"& for background"}</Text></Box>;

  const t26 = <Box><Text dimColor={dimColor}>/btw for side question</Text></Box>;

  const t27 = <Box flexDirection="column" width={t21}>{t22}{t23}{t24}{t25}{t26}</Box>;

  const t28 = fixedWidth ? 35 : undefined;
  const t29 = <Box><Text dimColor={dimColor}>double tap esc to clear input</Text></Box>;

  const t30 = <Box><Text dimColor={dimColor}>{cycleModeShortcut}{" "}{false ? "to cycle modes" : "to auto-accept edits"}</Text></Box>;

  const t31 = <Box><Text dimColor={dimColor}>{transcriptShortcut} for verbose output</Text></Box>;

  const t32 = <Box><Text dimColor={dimColor}>{todosShortcut} to toggle tasks</Text></Box>;

  const t33 = getNewlineInstructions();

  const t34 = <Box><Text dimColor={dimColor}>{t33}</Text></Box>;

  const t35 = <Box flexDirection="column" width={t28}>{t29}{t30}{t31}{t32}{terminalShortcutElement}{t34}</Box>;

  const t36 = <Box><Text dimColor={dimColor}>{undoShortcut} to undo</Text></Box>;

  const t37 = getPlatform() !== "windows" && <Box><Text dimColor={dimColor}>ctrl + z to suspend</Text></Box>;

  const t38 = <Box><Text dimColor={dimColor}>{imagePasteShortcut} to paste images</Text></Box>;

  const t39 = <Box><Text dimColor={dimColor}>{modelPickerShortcut} to switch model</Text></Box>;

  const t40 = isFastModeEnabled() && isFastModeAvailable() && <Box><Text dimColor={dimColor}>{fastModeShortcut} to toggle fast mode</Text></Box>;

  const t41 = <Box><Text dimColor={dimColor}>{stashShortcut} to stash prompt</Text></Box>;

  const t42 = <Box><Text dimColor={dimColor}>{externalEditorShortcut} to edit in $EDITOR</Text></Box>;

  const t43 = isKeybindingCustomizationEnabled() && <Box><Text dimColor={dimColor}>/keybindings to customize</Text></Box>;

  const t44 = <Box flexDirection="column">{t36}{t37}{t38}{t39}{t40}{t41}{t42}{t43}</Box>;

  const t45 = <Box paddingX={paddingX} flexDirection="row" gap={gap}>{t27}{t35}{t44}</Box>;

  return t45;
}
