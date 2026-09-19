import * as React from 'react';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import type { PromptRequest } from '../../types/hooks';
import { Select } from '../CustomSelect/select';
import { PermissionDialog } from '../permissions/PermissionDialog';
type Props = {
  title: string;
  toolInputSummary?: string | null;
  request: PromptRequest;
  onRespond: (key: string) => void;
  onAbort: () => void;
};
export function PromptDialog({
    title,
    toolInputSummary,
    request,
    onRespond,
    onAbort
}: Props) {
  const t1 = {
      isActive: true
    };

  useKeybinding("app:interrupt", onAbort, t1);
  const t2 = request.options.map(_temp);

  const options = t2;
  const t3 = toolInputSummary ? <Text dimColor={true}>{toolInputSummary}</Text> : undefined;

  const t4 = value => {
      onRespond(value);
    };

  const t5 = <Box flexDirection="column" paddingY={1}><Select options={options} onChange={t4} /></Box>;

  const t6 = <PermissionDialog title={title} subtitle={request.message} titleRight={t3}>{t5}</PermissionDialog>;

  return t6;
}
function _temp(opt) {
  return {
    label: opt.label,
    value: opt.key,
    description: opt.description
  };
}
