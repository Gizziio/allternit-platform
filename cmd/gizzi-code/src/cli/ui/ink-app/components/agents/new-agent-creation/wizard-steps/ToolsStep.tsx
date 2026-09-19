import React, { type ReactNode } from 'react';
import type { Tools } from '../../../../Tool';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import { ToolSelector } from '../../ToolSelector';
import type { AgentWizardData } from '../types';
type Props = {
  tools: Tools;
};
export function ToolsStep({
    tools
}: Props) {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const t1 = selectedTools => {
      updateWizardData({
        selectedTools
      });
      goNext();
    };

  const handleComplete = t1;
  const initialTools = wizardData.selectedTools;
  const t2 = <Byline><KeyboardShortcutHint shortcut="Enter" action="toggle selection" /><KeyboardShortcutHint shortcut={"\u2191\u2193"} action="navigate" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" /></Byline>;

  const t3 = <WizardDialogLayout subtitle="Select tools" footerText={t2}><ToolSelector tools={tools} initialTools={initialTools} onComplete={handleComplete} onCancel={goBack} /></WizardDialogLayout>;

  return t3;
}
