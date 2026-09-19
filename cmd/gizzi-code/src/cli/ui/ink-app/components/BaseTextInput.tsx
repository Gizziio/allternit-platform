import React from 'react';
import { renderPlaceholder } from '../hooks/renderPlaceholder';
import { usePasteHandler } from '../hooks/usePasteHandler';
import { useDeclaredCursor } from '../ink/hooks/use-declared-cursor';
import { Ansi, Box, Text, useInput } from '../ink';
import type { BaseInputState, BaseTextInputProps } from '../types/textInputTypes';
import type { TextHighlight } from '../utils/textHighlighting';
import { HighlightedInput } from './PromptInput/ShimmeredInput';
type BaseTextInputComponentProps = BaseTextInputProps & {
  inputState: BaseInputState;
  children?: React.ReactNode;
  terminalFocus: boolean;
  highlights?: TextHighlight[];
  invert?: (text: string) => string;
  hidePlaceholderText?: boolean;
};

/**
 * A base component for text inputs that handles rendering and basic input
 */
export function BaseTextInput(t0) {
  const {
    inputState,
    children,
    terminalFocus,
    invert,
    hidePlaceholderText,
    ...props
  } = t0;
  const {
    onInput,
    renderedValue,
    cursorLine,
    cursorColumn
  } = inputState;
  const t1 = Boolean(props.focus && props.showCursor && terminalFocus);
  const t2 = {
      line: cursorLine,
      column: cursorColumn,
      active: t1
    };

  const cursorRef = useDeclaredCursor(t2);
  const {
    wrappedOnInput,
    isPasting: t3
  } = usePasteHandler({
    onPaste: props.onPaste,
    onInput: (input, key) => {
      if (isPasting && key.return) {
        return;
      }
      onInput(input, key);
    },
    onImagePaste: props.onImagePaste
  });
  const isPasting = t3;
  const {
    onIsPastingChange
  } = props;
  React.useEffect(() => {
    if (onIsPastingChange) {
      onIsPastingChange(isPasting);
    }
  }, [isPasting, onIsPastingChange]);
  const {
    showPlaceholder,
    renderedPlaceholder
  } = renderPlaceholder({
    placeholder: props.placeholder,
    value: props.value,
    showCursor: props.showCursor,
    focus: props.focus,
    terminalFocus,
    invert,
    hidePlaceholderText
  });
  useInput(wrappedOnInput, {
    isActive: props.focus
  });
  const commandWithoutArgs = props.value && props.value.trim().indexOf(" ") === -1 || props.value && props.value.endsWith(" ");
  const showArgumentHint = Boolean(props.argumentHint && props.value && commandWithoutArgs && props.value.startsWith("/"));
  const cursorFiltered = props.showCursor && props.highlights ? props.highlights.filter(h => h.dimColor || props.cursorOffset < h.start || props.cursorOffset >= h.end) : props.highlights;
  const {
    viewportCharOffset,
    viewportCharEnd
  } = inputState;
  const filteredHighlights = cursorFiltered && viewportCharOffset > 0 ? cursorFiltered.filter(h_0 => h_0.end > viewportCharOffset && h_0.start < viewportCharEnd).map(h_1 => ({
    ...h_1,
    start: Math.max(0, h_1.start - viewportCharOffset),
    end: h_1.end - viewportCharOffset
  })) : cursorFiltered;
  const hasHighlights = filteredHighlights && filteredHighlights.length > 0;
  if (hasHighlights) {
    return <Box ref={cursorRef}><HighlightedInput text={renderedValue} highlights={filteredHighlights} />{showArgumentHint && <Text dimColor={true}>{props.value?.endsWith(" ") ? "" : " "}{props.argumentHint}</Text>}{children}</Box>;
  }
  const T0 = Box;
  const T1 = Text;
  const t4 = "truncate-end";
  const t5 = showPlaceholder && props.placeholderElement ? props.placeholderElement : showPlaceholder && renderedPlaceholder ? <Ansi>{renderedPlaceholder}</Ansi> : <Ansi>{renderedValue}</Ansi>;
  const t6 = showArgumentHint && <Text dimColor={true}>{props.value?.endsWith(" ") ? "" : " "}{props.argumentHint}</Text>;
  const t7 = <T1 wrap={t4} dimColor={props.dimColor}>{t5}{t6}{children}</T1>;

  const t8 = <T0 ref={cursorRef}>{t7}</T0>;

  return t8;
}
