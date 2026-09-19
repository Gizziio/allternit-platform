import React, { type ReactNode } from 'react';
import { Box } from '../../../../ink';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Select } from '../../../CustomSelect/select';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import type { AgentWizardData } from '../types';
export function MethodStep() {
  const {
    goNext,
    goBack,
    updateWizardData,
    goToStep
  } = useWizard();
  const t0 = [{
      label: "Generate with Gizzi (recommended)",
      value: "generate"
    }, {
      label: "Manual configuration",
      value: "manual"
    }];

  const methodOptions = t0;
  const t1 = <Byline><KeyboardShortcutHint shortcut={"\u2191\u2193"} action="navigate" /><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" /></Byline>;

  const t2 = value => {
      const method = value as 'generate' | 'manual';
      updateWizardData({
        method,
        wasGenerated: method === "generate"
      });
      if (method === "generate") {
        goNext();
      } else {
        goToStep(3);
      }
    };

  const t3 = () => goBack();

  const t4 = <WizardDialogLayout subtitle="Creation method" footerText={t1}><Box><Select key="method-select" options={methodOptions} onChange={t2} onCancel={t3} /></Box></WizardDialogLayout>;

  return t4;
}
