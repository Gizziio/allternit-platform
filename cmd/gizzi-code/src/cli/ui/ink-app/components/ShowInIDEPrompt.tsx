// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — generic Props requires type argument (TS2314), latent, not a conversion regression.
import { basename, relative } from 'path';
import React from 'react';
import { Box, Text } from '../ink';
import { getCwd } from '../utils/cwd';
import { isSupportedVSCodeTerminal } from '../utils/ide';
import { Select } from './CustomSelect/index';
import { Pane } from './design-system/Pane';
import type { PermissionOption, PermissionOptionWithLabel } from './permissions/FilePermissionDialog/permissionOptions';
type Props<A> = {
  filePath: string;
  input: A;
  onChange: (option: PermissionOption, args: A, feedback?: string) => void;
  options: PermissionOptionWithLabel[];
  ideName: string;
  symlinkTarget?: string | null;
  rejectFeedback: string;
  acceptFeedback: string;
  setFocusedOption: (value: string) => void;
  onInputModeToggle: (value: string) => void;
  focusedOption: string;
  yesInputMode: boolean;
  noInputMode: boolean;
};
export function ShowInIDEPrompt({
    onChange,
    options,
    input,
    filePath,
    ideName,
    symlinkTarget,
    rejectFeedback,
    acceptFeedback,
    setFocusedOption,
    onInputModeToggle,
    focusedOption,
    yesInputMode,
    noInputMode
}: Props) {
  const t1 = <Text bold={true} color="permission">Opened changes in {ideName} ⧉</Text>;

  const t2 = symlinkTarget && <Text color="warning">{relative(getCwd(), symlinkTarget).startsWith("..") ? `This will modify ${symlinkTarget} (outside working directory) via a symlink` : `Symlink target: ${symlinkTarget}`}</Text>;

  const t3 = isSupportedVSCodeTerminal() && <Text dimColor={true}>Save file to continue…</Text>;

  const t4 = basename(filePath);

  const t5 = <Text>Do you want to make this edit to{" "}<Text bold={true}>{t4}</Text>?</Text>;

  const t6 = value => {
      const selected = options.find(opt => opt.value === value);
      if (selected) {
        if (selected.option.type === "reject") {
          const trimmedFeedback = rejectFeedback.trim();
          onChange(selected.option, input, trimmedFeedback || undefined);
          return;
        }
        if (selected.option.type === "accept-once") {
          const trimmedFeedback_0 = acceptFeedback.trim();
          onChange(selected.option, input, trimmedFeedback_0 || undefined);
          return;
        }
        onChange(selected.option, input);
      }
    };

  const t7 = () => onChange({
      type: "reject"
    }, input);

  const t8 = value_0 => setFocusedOption(value_0);

  const t9 = <Select options={options} inlineDescriptions={true} onChange={t6} onCancel={t7} onFocus={t8} onInputModeToggle={onInputModeToggle} />;

  const t10 = <Box flexDirection="column">{t5}{t9}</Box>;

  const t11 = (focusedOption === "yes" && !yesInputMode || focusedOption === "no" && !noInputMode) && " \xB7 Tab to amend";
  const t12 = <Box marginTop={1}><Text dimColor={true}>Esc to cancel{t11}</Text></Box>;

  const t13 = <Pane color="permission"><Box flexDirection="column" gap={1}>{t1}{t2}{t3}{t10}{t12}</Box></Pane>;

  return t13;
}
