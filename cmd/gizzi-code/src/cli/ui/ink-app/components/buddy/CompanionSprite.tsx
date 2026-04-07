import React from 'react'

/**
 * Companion Sprite Component
 * TEMPORARY SHIM
 */

export interface CompanionSpriteProps {
  mood?: 'happy' | 'neutral' | 'sad'
}

export function CompanionSprite({ mood = 'neutral' }: CompanionSpriteProps): React.ReactElement {
  return (
    <div>
      Companion: {mood}
    </div>
  )
}

export default CompanionSprite
