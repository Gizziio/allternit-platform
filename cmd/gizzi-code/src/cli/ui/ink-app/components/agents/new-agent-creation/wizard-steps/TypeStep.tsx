import React, { type ReactNode, useState } from 'react';
import { Box, Text } from '../../../../ink';
import { useKeybinding } from '../../../../keybindings/useKeybinding';
import type { AgentDefinition } from '../../../../tools/AgentTool/loadAgentsDir';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import TextInput from '../../../TextInput';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import { validateAgentType } from '../../validateAgent';
import type { AgentWizardData } from '../types';
type Props = {
  existingAgents: AgentDefinition[];
};
export function TypeStep(_props) {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const [agentType, setAgentType] = useState(wizardData.agentType || "");
  const [error, setError] = useState(null);
  const [cursorOffset, setCursorOffset] = useState(agentType.length);
  const t0 = {
      context: "Settings"
    };

  useKeybinding("confirm:no", goBack, t0);
  const t1 = value => {
      const trimmedValue = value.trim();
      const validationError = validateAgentType(trimmedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      updateWizardData({
        agentType: trimmedValue
      });
      goNext();
    };

  const handleSubmit = t1;
  const t2 = <Byline><KeyboardShortcutHint shortcut="Type" action="enter text" /><KeyboardShortcutHint shortcut="Enter" action="continue" /><ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="go back" /></Byline>;

  const t3 = <Text>Enter a unique identifier for your agent:</Text>;

  const t4 = <Box marginTop={1}><TextInput value={agentType} onChange={setAgentType} onSubmit={handleSubmit} placeholder="e.g., test-runner, tech-lead, etc" columns={60} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} focus={true} showCursor={true} /></Box>;

  const t5 = error && <Box marginTop={1}><Text color="error">{error}</Text></Box>;

  const t6 = <WizardDialogLayout subtitle="Agent type (identifier)" footerText={t2}><Box flexDirection="column">{t3}{t4}{t5}</Box></WizardDialogLayout>;

  return t6;
}
