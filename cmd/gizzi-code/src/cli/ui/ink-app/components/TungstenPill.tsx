import React from 'react'

/**
 * Tungsten Pill Component
 * TEMPORARY SHIM
 */

export interface TungstenPillProps {
  label: string
  onClick?: () => void
}

export function TungstenPill({ label, onClick }: TungstenPillProps): React.ReactElement {
  return (
    <button onClick={onClick}>
      {label}
    </button>
  )
}

export default TungstenPill
