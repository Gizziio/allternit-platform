import { useContext } from 'react'
import type { WizardContextValue } from './types'
import { WizardContext } from './WizardProvider'

export function useWizard<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>,
>(): WizardContextValue & { wizardData: T } {
  const context = useContext(WizardContext) as (WizardContextValue & { wizardData: T }) | null
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
