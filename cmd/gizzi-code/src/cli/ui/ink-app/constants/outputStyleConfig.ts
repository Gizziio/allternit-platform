// @ts-nocheck
import { logForDebugging } from '../utils/debug.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'
import {
  DEFAULT_OUTPUT_STYLE_NAME,
} from './outputStyleConstants.js'
import {
  getAllOutputStyles,
  type OutputStyleConfig,
} from './outputStyles.js'
import { getCwd } from '../utils/cwd.js'

/**
 * Resolve the active output style config from settings, falling back to the
 * built-in default. Kept in a separate leaf module so outputStyles.ts can stay
 * free of the settings import cycle.
 */
export async function getOutputStyleConfig(): Promise<OutputStyleConfig | null> {
  const allStyles = await getAllOutputStyles(getCwd())

  // Check for forced plugin output styles
  const forcedStyles = Object.values(allStyles).filter(
    (style): style is OutputStyleConfig =>
      style !== null &&
      style.source === 'plugin' &&
      style.forceForPlugin === true,
  )

  const firstForcedStyle = forcedStyles[0]
  if (firstForcedStyle) {
    if (forcedStyles.length > 1) {
      logForDebugging(
        `Multiple plugins have forced output styles: ${forcedStyles.map(s => s.name).join(', ')}. Using: ${firstForcedStyle.name}`,
        { level: 'warn' },
      )
    }
    logForDebugging(
      `Using forced plugin output style: ${firstForcedStyle.name}`,
    )
    return firstForcedStyle
  }

  const settings = getSettings_DEPRECATED()
  const outputStyle = (settings?.outputStyle ||
    DEFAULT_OUTPUT_STYLE_NAME) as string

  return allStyles[outputStyle] ?? null
}

/**
 * True when the user has selected a non-default output style.
 */
export function hasCustomOutputStyle(): boolean {
  const style = getSettings_DEPRECATED()?.outputStyle
  return style !== undefined && style !== DEFAULT_OUTPUT_STYLE_NAME
}
