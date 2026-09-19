import React, { type ReactNode } from 'react';
import type { Theme } from '../../utils/theme';
import { Dialog } from '../design-system/Dialog';
import { useWizard } from './useWizard';
import { WizardNavigationFooter } from './WizardNavigationFooter';
type Props = {
  title?: string;
  color?: keyof Theme;
  children: ReactNode;
  subtitle?: string;
  footerText?: ReactNode;
};
export function WizardDialogLayout({
    title: titleOverride,
    color: t1,
    children,
    subtitle,
    footerText
}: Props) {
  const color = t1 === undefined ? "suggestion" : t1;
  const {
    currentStepIndex,
    totalSteps,
    title: providerTitle,
    showStepCounter,
    goBack
  } = useWizard();
  const title = titleOverride || providerTitle || "Wizard";
  const stepSuffix = showStepCounter !== false ? ` (${currentStepIndex + 1}/${totalSteps})` : "";
  const t2 = `${title}${stepSuffix}`;
  const t3 = <Dialog title={t2} subtitle={subtitle} onCancel={goBack} color={color} hideInputGuide={true} isCancelActive={false}>{children}</Dialog>;

  const t4 = <WizardNavigationFooter instructions={footerText} />;

  const t5 = <>{t3}{t4}</>;

  return t5;
}
