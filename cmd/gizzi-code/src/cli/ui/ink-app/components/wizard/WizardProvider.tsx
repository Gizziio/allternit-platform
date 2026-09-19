import React, { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import type { WizardContextValue, WizardProviderProps } from './types';

// Use any here for the context since it will be cast properly when used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WizardContext = createContext<WizardContextValue<any> | null>(null);
export function WizardProvider<T extends Record<string, unknown>>({
    steps,
    initialData: t1,
    onComplete,
    onCancel,
    children,
    title,
    showStepCounter: t2
}: WizardProviderProps<T>) {
  const t3 = t1 === undefined ? {} as T : t1;

  const initialData = t3;
  const showStepCounter = t2 === undefined ? true : t2;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wizardData, setWizardData] = useState(initialData);
  const [isCompleted, setIsCompleted] = useState(false);
  const t4 = [];

  const [navigationHistory, setNavigationHistory] = useState(t4);
  useExitOnCtrlCDWithKeybindings();
  const t5 = () => {
      if (isCompleted) {
        setNavigationHistory([]);
        onComplete(wizardData);
      }
    };
  const t6 = [isCompleted, wizardData, onComplete];

  useEffect(t5, t6);
  const t7 = () => {
      if (currentStepIndex < steps.length - 1) {
        if (navigationHistory.length > 0) {
          setNavigationHistory(prev => [...prev, currentStepIndex]);
        }
        setCurrentStepIndex(_temp);
      } else {
        setIsCompleted(true);
      }
    };

  const goNext = t7;
  const t8 = () => {
      if (navigationHistory.length > 0) {
        const previousStep = navigationHistory[navigationHistory.length - 1];
        if (previousStep !== undefined) {
          setNavigationHistory(_temp2);
          setCurrentStepIndex(previousStep);
        }
      } else {
        if (currentStepIndex > 0) {
          setCurrentStepIndex(_temp3);
        } else {
          if (onCancel) {
            onCancel();
          }
        }
      }
    };

  const goBack = t8;
  const t9 = index => {
      if (index >= 0 && index < steps.length) {
        setNavigationHistory(prev_3 => [...prev_3, currentStepIndex]);
        setCurrentStepIndex(index);
      }
    };

  const goToStep = t9;
  const t10 = () => {
      setNavigationHistory([]);
      if (onCancel) {
        onCancel();
      }
    };

  const cancel = t10;
  const t11 = updates => {
      setWizardData(prev_4 => ({
        ...prev_4,
        ...updates
      }));
    };

  const updateWizardData = t11;
  const t12 = {
      currentStepIndex,
      totalSteps: steps.length,
      wizardData,
      setWizardData,
      updateWizardData,
      goNext,
      goBack,
      goToStep,
      cancel,
      title,
      showStepCounter
    };

  const contextValue = t12;
  const CurrentStepComponent = steps[currentStepIndex];
  if (!CurrentStepComponent || isCompleted) {
    return null;
  }
  const t13 = children || <CurrentStepComponent />;

  const t14 = <WizardContext.Provider value={contextValue}>{t13}</WizardContext.Provider>;

  return t14;
}
function _temp3(prev_2) {
  return prev_2 - 1;
}
function _temp2(prev_1) {
  return prev_1.slice(0, -1);
}
function _temp(prev_0) {
  return prev_0 + 1;
}
