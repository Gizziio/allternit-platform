import React from 'react'
import { Box, Text } from '@/ink.js'
import { getPluginDirsState } from '../../../../shared/utils/plugins/pluginDirectories'

/**
 * Doctor section reporting canonical vs legacy plugin directory state.
 *
 * Canonical is ~/.gizzi/plugins (gizzi-owned); legacy is the upstream-inherited
 * ~/.claude/plugins, kept as a read-only fallback. Renders nothing when neither
 * directory exists; warns when legacy holds state that has not been migrated.
 */
export function PluginDirsDoctorSection(): React.ReactNode {
  let state: ReturnType<typeof getPluginDirsState>
  try {
    state = getPluginDirsState()
  } catch {
    return null
  }

  if (!state.canonicalExists && !state.legacyExists) {
    return null
  }

  const needsMigration = state.legacyHasState && !state.canonicalHasState

  return (
    <Box flexDirection="column">
      <Text bold={true}>Plugin Directories</Text>
      <Text>
        └ Canonical: {state.canonicalDir}
        {state.canonicalHasState ? '' : ' (no state yet)'}
      </Text>
      <Text>
        └ Legacy: {state.legacyDir}
        {!state.legacyExists
          ? ' (not present)'
          : state.legacyHasState
            ? ''
            : ' (empty)'}
      </Text>
      {needsMigration && (
        <Text color="warning">
          └ DEPRECATED: un-migrated plugin state in the legacy directory — run
          `gizzi plugin migrate` to copy it to the canonical location.
        </Text>
      )}
      {!needsMigration && state.canonicalHasState && state.legacyHasState && (
        <Text dimColor={true}>
          └ Legacy state already migrated; the legacy directory is a read-only
          fallback and can be removed.
        </Text>
      )}
    </Box>
  )
}
