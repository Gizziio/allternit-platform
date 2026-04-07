/**
 * Auto Mode State
 */

export interface AutoModeState {
  enabled: boolean
  mode: string
}

export function getAutoModeState(): AutoModeState {
  return { enabled: false, mode: 'default' }
}
