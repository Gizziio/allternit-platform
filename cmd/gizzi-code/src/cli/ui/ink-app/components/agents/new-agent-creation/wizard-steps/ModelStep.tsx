import React, { type ReactNode } from 'react';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import { ModelSelector } from '../../ModelSelector';
import type { AgentWizardData } from '../types';
export function ModelStep() {
  const {
    goNext,
    goBack,
    updateWizardData,
    wizardData
  } = useWizard();
  const t0 = model => {
      updateWizardData({
        selectedModel: model
      });
      goNext();
    };

  const handleComplete = t0;
  const t1 = <Byline><KeyboardShortcutHint shortcut={"\u2191\u2193"} action="navigate" /><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" /></Byline>;

  const t2 = <WizardDialogLayout subtitle="Select model" footerText={t1}><ModelSelector initialModel={wizardData.selectedModel} onComplete={handleComplete} onCancel={goBack} /></WizardDialogLayout>;

  return t2;
}
