/**
 * Wizard component types
 */

import type { FC, ComponentType, ReactNode } from 'react'
// Wizard context value
export interface WizardContextValue {
  currentStep: number
  totalSteps: number
  stepData: Record<string, unknown>
  wizardData: any
  goToStep: (step: number) => void
  goNext: () => void
  goBack: () => void
  setStepData: (key: string, value: unknown) => void
  updateWizardData: (key: string, value: unknown) => void
  cancel: () => void
  isFirstStep: boolean
  isLastStep: boolean
}

// Wizard provider props
export interface WizardProviderProps {
  children: ReactNode
  steps: WizardStep[]
  onComplete?: (data: Record<string, unknown>) => void
  onCancel?: () => void
}

export interface WizardStep {
  id: string
  title: string
  component: React.ComponentType<unknown>
}

export interface WizardState {
  completed: string[]
  data: Record<string, unknown>
}

// Component type for wizard steps
export interface WizardStepComponentProps {
  onNext: () => void
  onBack?: () => void
  updateData: (data: Record<string, unknown>) => void
  isValid?: boolean
}

export type WizardStepComponent = ComponentType<WizardStepComponentProps>
// Wizard configuration
export interface WizardConfig {
  onComplete: (data: Record<string, unknown>) => void
  }
