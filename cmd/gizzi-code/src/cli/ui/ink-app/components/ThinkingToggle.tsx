import * as React from 'react';
import { useState } from 'react';
import { useExitOnCtrlCDWithKeybindings } from './../hooks/useExitOnCtrlCDWithKeybindings.ts';
import { Box, Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { Select } from './CustomSelect/index';
import { Byline } from './design-system/Byline';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { Pane } from './design-system/Pane';
export type Props = {
  currentValue: boolean;
  onSelect: (enabled: boolean) => void;
  onCancel?: () => void;
  isMidConversation?: boolean;
};
export function ThinkingToggle({
    currentValue,
    onSelect,
    onCancel,
    isMidConversation
}: Props) {
  const exitState = useExitOnCtrlCDWithKeybindings();
  const [confirmationPending, setConfirmationPending] = useState(null);
  const t1 = [{
      value: "true",
      label: "Enabled",
      description: "Gizzi will think before responding"
    }, {
      value: "false",
      label: "Disabled",
      description: "Gizzi will respond without extended thinking"
    }];

  const options = t1;
  const t2 = () => {
      if (confirmationPending !== null) {
        setConfirmationPending(null);
      } else {
        onCancel?.();
      }
    };

  const t3 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", t2, t3);
  const t4 = () => {
      if (confirmationPending !== null) {
        onSelect(confirmationPending);
      }
    };

  const t5 = confirmationPending !== null;
  const t6 = {
      context: "Confirmation",
      isActive: t5
    };

  useKeybinding("confirm:yes", t4, t6);
  const t7 = function handleSelectChange(value) {
      const selected = value === "true";
      if (isMidConversation && selected !== currentValue) {
        setConfirmationPending(selected);
      } else {
        onSelect(selected);
      }
    };

  const handleSelectChange = t7;
  const t8 = <Box marginBottom={1} flexDirection="column"><Text color="remember" bold={true}>Toggle thinking mode</Text><Text dimColor={true}>Enable or disable thinking for this session.</Text></Box>;

  const t9 = <Box flexDirection="column">{t8}{confirmationPending !== null ? <Box flexDirection="column" marginBottom={1} gap={1}><Text color="warning">Changing thinking mode mid-conversation will increase latency and may reduce quality. For best results, set this at the start of a session.</Text><Text color="warning">Do you want to proceed?</Text></Box> : <Box flexDirection="column" marginBottom={1}><Select defaultValue={currentValue ? "true" : "false"} defaultFocusValue={currentValue ? "true" : "false"} options={options} onChange={handleSelectChange} onCancel={onCancel ?? _temp} visibleOptionCount={2} /></Box>}</Box>;

  const t10 = <Text dimColor={true} italic={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : confirmationPending !== null ? <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="exit" /></Byline>}</Text>;

  const t11 = <Pane color="permission">{t9}{t10}</Pane>;

  return t11;
}
function _temp() {}
