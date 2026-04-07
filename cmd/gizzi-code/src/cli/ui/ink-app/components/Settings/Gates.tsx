import React from 'react'

/**
 * Settings Gates Component
 * TEMPORARY SHIM
 */

export interface GatesProps {
  enabled: boolean
}

export function Gates({ enabled }: GatesProps): React.ReactElement {
  return (
    <div>
      {enabled ? 'Gates Enabled' : 'Gates Disabled'}
    </div>
  )
}

export default Gates
