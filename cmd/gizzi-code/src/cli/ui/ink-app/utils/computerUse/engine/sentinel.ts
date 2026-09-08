/**
 * Sentinel app classification for the permission dialog.
 *
 * Replaces `@ant/computer-use-mcp/sentinelApps`. Apps in these categories get
 * a warning line in ComputerUseApproval because controlling them is
 * equivalent to controlling a whole capability class (shell, filesystem,
 * system settings).
 */

export type SentinelCategory = 'shell' | 'filesystem' | 'system_settings'

export interface SentinelApp {
  id: string
  name: string
  bundleId: string
  category: SentinelCategory
}

const TERMINAL_CATEGORY: SentinelCategory = 'shell'

function terminal(id: string, name: string): SentinelApp {
  return { id, name, bundleId: id, category: TERMINAL_CATEGORY }
}

export const SENTINEL_APPS: SentinelApp[] = [
  // Shell-equivalents: typing here IS arbitrary command execution.
  terminal('com.apple.Terminal', 'Terminal'),
  terminal('com.googlecode.iterm2', 'iTerm2'),
  terminal('com.mitchellh.ghostty', 'Ghostty'),
  terminal('net.kovidgoyal.kitty', 'kitty'),
  terminal('dev.warp.Warp-Stable', 'Warp'),
  terminal('org.alacritty', 'Alacritty'),
  terminal('com.hyperkit.hyper', 'Hyper'),
  // Full filesystem access.
  {
    id: 'com.apple.finder',
    name: 'Finder',
    bundleId: 'com.apple.finder',
    category: 'filesystem',
  },
  // System-wide settings.
  {
    id: 'com.apple.SystemPreferences',
    name: 'System Settings',
    bundleId: 'com.apple.SystemPreferences',
    category: 'system_settings',
  },
  {
    id: 'com.apple.systempreferences',
    name: 'System Preferences',
    bundleId: 'com.apple.systempreferences',
    category: 'system_settings',
  },
]

const BY_BUNDLE_ID = new Map(SENTINEL_APPS.map(a => [a.bundleId, a]))

export function getSentinelCategory(
  bundleId: string,
): SentinelCategory | undefined {
  return BY_BUNDLE_ID.get(bundleId)?.category
}
