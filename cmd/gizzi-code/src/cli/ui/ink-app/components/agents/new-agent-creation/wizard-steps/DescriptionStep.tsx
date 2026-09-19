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
export function DescriptionStep() {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const [whenToUse, setWhenToUse] = useState(wizardData.whenToUse || "");
  const [cursorOffset, setCursorOffset] = useState(whenToUse.length);
  const [error, setError] = useState(null);
  const t0 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", goBack, t0);
  const t1 = async () => {
      const result = await editPromptInEditor(whenToUse);
      if (result.content !== null) {
        setWhenToUse(result.content);
        setCursorOffset(result.content.length);
      }
    };

  const handleExternalEditor = t1;
  const t2 = {
      context: "Chat"
    };

  useKeybinding("chat:externalEditor", handleExternalEditor, t2);
  const t3 = value => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        setError("Description is required");
        return;
      }
      setError(null);
      updateWizardData({
        whenToUse: trimmedValue
      });
      goNext();
    };

  const handleSubmit = t3;
  const t4 = <Byline><KeyboardShortcutHint shortcut="Type" action="enter text" /><KeyboardShortcutHint shortcut="Enter" action="continue" /><ConfigurableShortcutHint action="chat:externalEditor" context="Chat" fallback="ctrl+g" description="open in editor" /><ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="go back" /></Byline>;

  const t5 = <Text>When should Gizzi use this agent?</Text>;

  const t6 = <Box marginTop={1}><TextInput value={whenToUse} onChange={setWhenToUse} onSubmit={handleSubmit} placeholder="e.g., use this agent after you're done writing code..." columns={80} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} focus={true} showCursor={true} /></Box>;

  const t7 = error && <Box marginTop={1}><Text color="error">{error}</Text></Box>;

  const t8 = <WizardDialogLayout subtitle="Description (tell Gizzi when to use this agent)" footerText={t4}><Box flexDirection="column">{t5}{t6}{t7}</Box></WizardDialogLayout>;

  return t8;
}
