import React from 'react'

/**
 * Ultraplan Launch Dialog
 * TEMPORARY SHIM
 */

export interface UltraplanLaunchDialogProps {
  isOpen: boolean
  onLaunch: () => void
  onCancel: () => void
}

export function UltraplanLaunchDialog({ isOpen, onLaunch, onCancel }: UltraplanLaunchDialogProps): React.ReactElement | null {
  if (!isOpen) return null
  
  return (
    <div>
      <p>Launch Ultraplan?</p>
      <button onClick={onLaunch}>Launch</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default UltraplanLaunchDialog
