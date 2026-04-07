/**
 * UI Option types and components
 */

import type { ReactNode } from 'react'

export interface OptionProps {
  value: string
  label: string
  disabled?: boolean
  children?: ReactNode
}

export interface OptionGroupProps {
  label: string
  options: OptionProps[]
}

export function Option(props: OptionProps): OptionProps {
  return props
}

export function OptionGroup(props: OptionGroupProps): OptionGroupProps {
  return props
}
