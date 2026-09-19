import { feature } from 'bun:bundle';
import * as React from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings';
import { useTerminalSize } from '../hooks/useTerminalSize';
import { Box, Text, usePreviewTheme, useTheme, useThemeSetting } from '../ink';
import { useRegisterKeybindingContext } from '../keybindings/KeybindingContext';
import { useKeybinding } from '../keybindings/useKeybinding';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay';
import { useAppState, useSetAppState } from '../state/AppState';
import { gracefulShutdown } from '../utils/gracefulShutdown';
import { updateSettingsForSource } from '../utils/settings/settings';
import type { ThemeSetting } from '../utils/theme';
import { Select } from './CustomSelect/index';
import { Byline } from './design-system/Byline';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { getColorModuleUnavailableReason, getSyntaxTheme } from './StructuredDiff/colorDiff';
import { StructuredDiff } from './StructuredDiff';
export type ThemePickerProps = {
  onThemeSelect: (setting: ThemeSetting) => void;
  showIntroText?: boolean;
  helpText?: string;
  showHelpTextBelow?: boolean;
  hideEscToCancel?: boolean;
  /** Skip exit handling when running in a context that already has it (e.g., onboarding) */
  skipExitHandling?: boolean;
  /** Called when the user cancels (presses Escape). If skipExitHandling is true and this is provided, it will be called instead of just saving the preview. */
  onCancel?: () => void;
};
export function ThemePicker({
    onThemeSelect,
    showIntroText: t1,
    helpText: t2,
    showHelpTextBelow: t3,
    hideEscToCancel: t4,
    skipExitHandling: t5,
    onCancel: onCancelProp
}: ThemePickerProps) {
  const showIntroText = t1 === undefined ? false : t1;
  const helpText = t2 === undefined ? "" : t2;
  const showHelpTextBelow = t3 === undefined ? false : t3;
  const hideEscToCancel = t4 === undefined ? false : t4;
  const skipExitHandling = t5 === undefined ? false : t5;
  const [theme] = useTheme();
  const themeSetting = useThemeSetting();
  const {
    columns
  } = useTerminalSize();
  const t6 = getColorModuleUnavailableReason();

  const colorModuleUnavailableReason = t6;
  const t7 = colorModuleUnavailableReason === null ? getSyntaxTheme(theme) : null;

  const syntaxTheme = t7;
  const {
    setPreviewTheme,
    savePreview,
    cancelPreview
  } = usePreviewTheme();
  const syntaxHighlightingDisabled = useAppState(_temp) ?? false;
  const setAppState = useSetAppState();
  useRegisterKeybindingContext("ThemePicker", true);
  const syntaxToggleShortcut = useShortcutDisplay("theme:toggleSyntaxHighlighting", "ThemePicker", "ctrl+t");
  const t8 = () => {
      if (colorModuleUnavailableReason === null) {
        const newValue = !syntaxHighlightingDisabled;
        updateSettingsForSource("userSettings", {
          syntaxHighlightingDisabled: newValue
        });
        setAppState(prev => ({
          ...prev,
          settings: {
            ...prev.settings,
            syntaxHighlightingDisabled: newValue
          }
        }));
      }
    };

  const t9 = {
      context: "ThemePicker"
    };

  useKeybinding("theme:toggleSyntaxHighlighting", t8, t9);
  const exitState = useExitOnCtrlCDWithKeybindings(skipExitHandling ? _temp2 : undefined);
  const t10 = [...(feature("AUTO_THEME") ? [{
      label: "Auto (match terminal)",
      value: "auto" as const
    }] : []), {
      label: "Dark mode",
      value: "dark"
    }, {
      label: "Light mode",
      value: "light"
    }, {
      label: "Dark mode (colorblind-friendly)",
      value: "dark-daltonized"
    }, {
      label: "Light mode (colorblind-friendly)",
      value: "light-daltonized"
    }, {
      label: "Dark mode (ANSI colors only)",
      value: "dark-ansi"
    }, {
      label: "Light mode (ANSI colors only)",
      value: "light-ansi"
    }];

  const themeOptions = t10;
  const t11 = showIntroText ? <Text>Let's get started.</Text> : <Text bold={true} color="permission">Theme</Text>;

  const t12 = <Text bold={true}>Choose the text style that looks best with your terminal</Text>;

  const t13 = helpText && !showHelpTextBelow && <Text dimColor={true}>{helpText}</Text>;

  const t14 = <Box flexDirection="column">{t12}{t13}</Box>;

  const t15 = (setting: string) => {
      setPreviewTheme(setting as ThemeSetting);
    };

  const t16 = (setting_0: string) => {
      savePreview();
      onThemeSelect(setting_0 as ThemeSetting);
    };

  const t17 = skipExitHandling ? () => {
      cancelPreview();
      onCancelProp?.();
    } : async () => {
      cancelPreview();
      await gracefulShutdown(0);
    };

  const t18 = <Select options={themeOptions} onFocus={t15} onChange={t16} onCancel={t17} visibleOptionCount={themeOptions.length} defaultValue={themeSetting} defaultFocusValue={themeSetting} />;

  const t19 = <Box flexDirection="column" gap={1}>{t11}{t14}{t18}</Box>;

  const t20 = {
      oldStart: 1,
      newStart: 1,
      oldLines: 3,
      newLines: 3,
      lines: [" function greet() {", "-  console.log(\"Hello, World!\");", "+  console.log(\"Hello, Gizzi!\"));", " }"]
    };

  const t21 = <Box flexDirection="column" borderTop={true} borderBottom={true} borderLeft={false} borderRight={false} borderStyle="dashed" borderColor="subtle"><StructuredDiff patch={t20} dim={false} filePath="demo.js" firstLine={null} width={columns} /></Box>;

  const t22 = colorModuleUnavailableReason === "env" ? `Syntax highlighting disabled (via GIZZI_CODE_SYNTAX_HIGHLIGHT=${process.env.GIZZI_CODE_SYNTAX_HIGHLIGHT})` : syntaxHighlightingDisabled ? `Syntax highlighting disabled (${syntaxToggleShortcut} to enable)` : syntaxTheme ? `Syntax theme: ${syntaxTheme.theme}${syntaxTheme.source ? ` (from ${syntaxTheme.source})` : ""} (${syntaxToggleShortcut} to disable)` : `Syntax highlighting enabled (${syntaxToggleShortcut} to disable)`;
  const t23 = <Text dimColor={true}>{" "}{t22}</Text>;

  const t24 = <Box flexDirection="column" width="100%">{t21}{t23}</Box>;

  const t25 = <Box flexDirection="column" gap={1}>{t19}{t24}</Box>;

  const content = t25;
  if (!showIntroText) {
    const t26 = <Box flexDirection="column">{content}</Box>;

    const t27 = showHelpTextBelow && helpText && <Box marginLeft={3}><Text dimColor={true}>{helpText}</Text></Box>;

    const t28 = !hideEscToCancel && <Box><Text dimColor={true} italic={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : <Byline><KeyboardShortcutHint shortcut="Enter" action="select" /><KeyboardShortcutHint shortcut="Esc" action="cancel" /></Byline>}</Text></Box>;

    const t29 = <Box marginTop={1}>{t27}{t28}</Box>;

    const t30 = <>{t26}{t29}</>;

    return t30;
  }
  return content;
}
function _temp2() {}
function _temp(s) {
  return s.settings.syntaxHighlightingDisabled;
}
