import React from 'react'

/**
 * Command Palette Component
 * TEMPORARY SHIM
 */

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps): React.ReactElement | null {
  if (!isOpen) return null
  
  return (
    <div>
      <button onClick={onClose}>Close</button>
    </div>
  )
}

export default CommandPalette
