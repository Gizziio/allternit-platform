import React from 'react'

/**
 * Ultraplan Choice Dialog
 * TEMPORARY SHIM
 */

export interface UltraplanChoiceDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function UltraplanChoiceDialog({ isOpen, onConfirm, onCancel }: UltraplanChoiceDialogProps): React.ReactElement | null {
  if (!isOpen) return null
  
  return (
    <div>
      <p>Confirm Ultraplan?</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default UltraplanChoiceDialog
