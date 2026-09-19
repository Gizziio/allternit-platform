/**
 * Wizard component types
 */

import type { FC, ComponentType, ReactNode } from 'react'
// Wizard context value
export interface WizardContextValue<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  currentStepIndex: number
  totalSteps: number
  wizardData: T
  setWizardData: (data: T) => void
  goToStep: (step: number) => void
  goNext: () => void
  goBack: () => void
  updateWizardData: (updates: Partial<T>) => void
  cancel: () => void
  title?: ReactNode
  showStepCounter?: boolean
}

// Wizard provider props
export interface WizardProviderProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  children?: ReactNode
  steps: WizardStep[]
  initialData?: T
  title?: ReactNode
  showStepCounter?: boolean
  onComplete?: (data: T) => void
  onCancel?: () => void
}

// A step is a zero-prop component rendered directly by WizardProvider
// (`<CurrentStepComponent />`); callers pass plain component references.
export type WizardStep = ComponentType<Record<string, never>>

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
