import figures from 'figures';
import React, { useState } from 'react';
import { Box, Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import TextInput from './TextInput';
type Props = {
  initialLanguage: string | undefined;
  onComplete: (language: string | undefined) => void;
  onCancel: () => void;
};
export function LanguagePicker({
    initialLanguage,
    onComplete,
    onCancel
}: Props) {
  const [language, setLanguage] = useState(initialLanguage);
  const [cursorOffset, setCursorOffset] = useState((initialLanguage ?? "").length);
  const t1 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", onCancel, t1);
  const t2 = function handleSubmit() {
      const trimmed = language?.trim();
      onComplete(trimmed || undefined);
    };

  const handleSubmit = t2;
  const t3 = <Text>Enter your preferred response and voice language:</Text>;

  const t4 = <Text>{figures.pointer}</Text>;

  const t5 = language ?? "";
  const t6 = <Box flexDirection="row" gap={1}>{t4}<TextInput value={t5} onChange={setLanguage} onSubmit={handleSubmit} focus={true} showCursor={true} placeholder={`e.g., Japanese, 日本語, Español${figures.ellipsis}`} columns={60} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} /></Box>;

  const t7 = <Text dimColor={true}>Leave empty for default (English)</Text>;

  const t8 = <Box flexDirection="column" gap={1}>{t3}{t6}{t7}</Box>;

  return t8;
}
