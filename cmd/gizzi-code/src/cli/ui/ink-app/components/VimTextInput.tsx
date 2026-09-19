import chalk from '@/shared/util/chalk'
import React from 'react';
import { useClipboardImageHint } from '../hooks/useClipboardImageHint';
import { useVimInput } from '../hooks/useVimInput';
import { Box, color, useTerminalFocus, useTheme } from '../ink';
import type { VimTextInputProps } from '../types/textInputTypes';
import type { TextHighlight } from '../utils/textHighlighting';
import { BaseTextInput } from './BaseTextInput';
export type Props = VimTextInputProps & {
  highlights?: TextHighlight[];
};
export default function VimTextInput(props) {
  const [theme] = useTheme();
  const isTerminalFocused = useTerminalFocus();
  useClipboardImageHint(isTerminalFocused, !!props.onImagePaste);
  const t0 = props.value;
  const t1 = props.onChange;
  const t2 = props.onSubmit;
  const t3 = props.onExit;
  const t4 = props.onExitMessage;
  const t5 = props.onHistoryReset;
  const t6 = props.onHistoryUp;
  const t7 = props.onHistoryDown;
  const t8 = props.onClearInput;
  const t9 = props.focus;
  const t10 = props.mask;
  const t11 = props.multiline;
  const t12 = props.showCursor ? " " : "";
  const t13 = props.highlightPastedText;
  const t14 = isTerminalFocused ? chalk.inverse : _temp;
  const t15 = color("text", theme);

  const t16 = {
      value: t0,
      onChange: t1,
      onSubmit: t2,
      onExit: t3,
      onExitMessage: t4,
      onHistoryReset: t5,
      onHistoryUp: t6,
      onHistoryDown: t7,
      onClearInput: t8,
      focus: t9,
      mask: t10,
      multiline: t11,
      cursorChar: t12,
      highlightPastedText: t13,
      invert: t14,
      themeText: t15,
      columns: props.columns,
      maxVisibleLines: props.maxVisibleLines,
      onImagePaste: props.onImagePaste,
      disableCursorMovementForUpDownKeys: props.disableCursorMovementForUpDownKeys,
      disableEscapeDoublePress: props.disableEscapeDoublePress,
      externalOffset: props.cursorOffset,
      onOffsetChange: props.onChangeCursorOffset,
      inputFilter: props.inputFilter,
      onModeChange: props.onModeChange,
      onUndo: props.onUndo
    };

  const vimInputState = useVimInput(t16);
  const {
    mode,
    setMode
  } = vimInputState;
  const t17 = () => {
      if (props.initialMode && props.initialMode !== mode) {
        setMode(props.initialMode);
      }
    };
  const t18 = [props.initialMode, mode, setMode];

  React.useEffect(t17, t18);
  const t19 = <Box flexDirection="column"><BaseTextInput inputState={vimInputState} terminalFocus={isTerminalFocused} highlights={props.highlights} {...props} /></Box>;

  return t19;
}
function _temp(text) {
  return text;
}
