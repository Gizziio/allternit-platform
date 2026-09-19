import React, { type ReactNode } from 'react';
import { Box } from '../../../../ink';
import { useKeybinding } from '../../../../keybindings/useKeybinding';
import type { AgentColorName } from '../../../../tools/AgentTool/agentColorManager';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import { ColorPicker } from '../../ColorPicker';
import type { AgentWizardData } from '../types';
export function ColorStep() {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const t0 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", goBack, t0);
  const t1 = color => {
      updateWizardData({
        selectedColor: color,
        finalAgent: {
          agentType: wizardData.agentType,
          whenToUse: wizardData.whenToUse,
          getSystemPrompt: () => wizardData.systemPrompt,
          tools: wizardData.selectedTools,
          ...(wizardData.selectedModel ? {
            model: wizardData.selectedModel
          } : {}),
          ...(color ? {
            color: color as AgentColorName
          } : {}),
          source: wizardData.location
        }
      });
      goNext();
    };

  const handleConfirm = t1;
  const t2 = <Byline><KeyboardShortcutHint shortcut={"\u2191\u2193"} action="navigate" /><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" /></Byline>;

  const t3 = wizardData.agentType || "agent";
  const t4 = <WizardDialogLayout subtitle="Choose background color" footerText={t2}><Box><ColorPicker agentName={t3} currentColor="automatic" onConfirm={handleConfirm} /></Box></WizardDialogLayout>;

  return t4;
}
