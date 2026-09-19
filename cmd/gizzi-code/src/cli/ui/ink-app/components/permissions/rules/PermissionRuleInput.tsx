import figures from 'figures';
import * as React from 'react';
import { useState } from 'react';
import TextInput from '../../../components/TextInput';
import { useExitOnCtrlCDWithKeybindings } from '../../../hooks/useExitOnCtrlCDWithKeybindings';
import { useTerminalSize } from '../../../hooks/useTerminalSize';
import { Box, Newline, Text } from '../../../ink';
import { useKeybinding } from '../../../keybindings/useKeybinding';
import { BashTool } from '../../../tools/BashTool/BashTool';
import { WebFetchTool } from '../../../tools/WebFetchTool/WebFetchTool';
import type { PermissionBehavior, PermissionRuleValue } from '../../../utils/permissions/PermissionRule';
import { permissionRuleValueFromString, permissionRuleValueToString } from '../../../utils/permissions/permissionRuleParser';
export type PermissionRuleInputProps = {
  onCancel: () => void;
  onSubmit: (ruleValue: PermissionRuleValue, ruleBehavior: PermissionBehavior) => void;
  ruleBehavior: PermissionBehavior;
};
export function PermissionRuleInput({
    onCancel,
    onSubmit,
    ruleBehavior
}: PermissionRuleInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const exitState = useExitOnCtrlCDWithKeybindings();
  const t1 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", onCancel, t1);
  const {
    columns
  } = useTerminalSize();
  const textInputColumns = columns - 6;
  const t2 = value => {
      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        return;
      }
      const ruleValue = permissionRuleValueFromString(trimmedValue);
      onSubmit(ruleValue, ruleBehavior);
    };

  const handleSubmit = t2;
  const t3 = <Text bold={true} color="permission">Add {ruleBehavior} permission rule</Text>;

  const t4 = <Newline />;

  const t5 = <Text bold={true}>{permissionRuleValueToString({
        toolName: WebFetchTool.name
      })}</Text>;
  const t6 = <Text bold={false}> or </Text>;

  const t7 = <Text>Permission rules are a tool name, optionally followed by a specifier in parentheses.{t4}e.g.,{" "}{t5}{t6}<Text bold={true}>{permissionRuleValueToString({
          toolName: BashTool.name,
          ruleContent: "ls:*"
        })}</Text></Text>;

  const t8 = <Box flexDirection="column">{t7}<Box borderDimColor={true} borderStyle="round" marginY={1} paddingLeft={1}><TextInput showCursor={true} value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} placeholder={`Enter permission rule${figures.ellipsis}`} columns={textInputColumns} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} /></Box></Box>;

  const t9 = <Box flexDirection="column" gap={1} borderStyle="round" paddingLeft={1} paddingRight={1} borderColor="permission">{t3}{t8}</Box>;

  const t10 = <Box marginLeft={3}>{exitState.pending ? <Text dimColor={true}>Press {exitState.keyName} again to exit</Text> : <Text dimColor={true}>Enter to submit · Esc to cancel</Text>}</Box>;

  const t11 = <>{t9}{t10}</>;

  return t11;
}
