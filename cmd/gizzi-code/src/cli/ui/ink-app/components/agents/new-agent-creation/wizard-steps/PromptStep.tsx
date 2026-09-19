import React, { type ReactNode, useCallback, useState } from 'react';
import { Box, Text } from '../../../../ink';
import { useKeybinding } from '../../../../keybindings/useKeybinding';
import { editPromptInEditor } from '../../../../utils/promptEditor';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import TextInput from '../../../TextInput';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import type { AgentWizardData } from '../types';
export function PromptStep() {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const [systemPrompt, setSystemPrompt] = useState(wizardData.systemPrompt || "");
  const [cursorOffset, setCursorOffset] = useState(systemPrompt.length);
  const [error, setError] = useState(null);
  const t0 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", goBack, t0);
  const t1 = async () => {
      const result = await editPromptInEditor(systemPrompt);
      if (result.content !== null) {
        setSystemPrompt(result.content);
        setCursorOffset(result.content.length);
      }
    };

  const handleExternalEditor = t1;
  const t2 = {
      context: "Chat"
    };

  useKeybinding("chat:externalEditor", handleExternalEditor, t2);
  const t3 = () => {
      const trimmedPrompt = systemPrompt.trim();
      if (!trimmedPrompt) {
        setError("System prompt is required");
        return;
      }
      setError(null);
      updateWizardData({
        systemPrompt: trimmedPrompt
      });
      goNext();
    };

  const handleSubmit = t3;
  const t4 = <Byline><KeyboardShortcutHint shortcut="Type" action="enter text" /><KeyboardShortcutHint shortcut="Enter" action="continue" /><ConfigurableShortcutHint action="chat:externalEditor" context="Chat" fallback="ctrl+g" description="open in editor" /><ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="go back" /></Byline>;

  const t5 = <Text>Enter the system prompt for your agent:</Text>;
  const t6 = <Text dimColor={true}>Be comprehensive for best results</Text>;

  const t7 = <Box marginTop={1}><TextInput value={systemPrompt} onChange={setSystemPrompt} onSubmit={handleSubmit} placeholder="You are a helpful code reviewer who..." columns={80} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} focus={true} showCursor={true} /></Box>;

  const t8 = error && <Box marginTop={1}><Text color="error">{error}</Text></Box>;

  const t9 = <WizardDialogLayout subtitle="System prompt" footerText={t4}><Box flexDirection="column">{t5}{t6}{t7}{t8}</Box></WizardDialogLayout>;

  return t9;
}
