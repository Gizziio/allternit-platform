// @ts-nocheck
import type { AppState } from '../../state/AppState.js'
import { readGizziEnv } from '@/shared/utils/gizziEnv.js';
import { logForDebugging } from '../debug.js'
import { updateHooksConfigSnapshot } from '../hooks/hooksConfigSnapshot.js'
import { loadAllPermissionRulesFromDisk } from '../permissions/permissionsLoader.js'
import type { SettingSource } from './constants.js'
import { getInitialSettings } from './settings.js'

// Lazy require() to avoid a circular init dependency through
// permissionSetup.js / permissions.js. The earlier dynamic-import approach
// (`void import(...).then(...)`) was converted by Bun's bundler into
// `init_permissionSetup2().then(...)` inside a sync __esm factory, crashing
// when init_permissionSetup2 wasn't yet defined. Using require() inside the
// getter defers resolution until first call (well after all __esm factories
// are assigned).
/* eslint-disable @typescript-eslint/no-require-imports */
let _permissionSetupModule: typeof import('../permissions/permissionSetup.js') | undefined
let _permissionsModule: typeof import('../permissions/permissions.js') | undefined
function getPermissionSetupModule() {
  return (_permissionSetupModule ??= require('../permissions/permissionSetup.js') as typeof import('../permissions/permissionSetup.js'))
}
function getPermissionsModule() {
  return (_permissionsModule ??= require('../permissions/permissions.js') as typeof import('../permissions/permissions.js'))
}
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Apply a settings change to app state. Re-reads settings from disk,
 * reloads permissions and hooks, and pushes the new state.
 *
 * Used by both the interactive path (AppState.tsx via useSettingsChange) and
 * the headless/SDK path (print.ts direct subscribe) so that managed-settings
 * / policy changes are fully applied in both modes.
 *
 * The settings cache is reset by the notifier (changeDetector.fanOut) before
 * listeners are iterated, so getInitialSettings() here reads fresh disk
 * state. Previously this function reset the cache itself, which — combined
 * with useSettingsChange's own reset — caused N disk reloads per notification
 * for N subscribers.
 *
 * Side-effects like clearing auth caches and applying env vars are handled by
 * `onChangeAppState` which fires when `settings` changes in state.
 */
export function applySettingsChange(
  source: SettingSource,
  setAppState: (f: (prev: AppState) => AppState) => void,
): void {
  const newSettings = getInitialSettings()

  logForDebugging(`Settings changed from ${source}, updating app state`)

  const updatedRules = loadAllPermissionRulesFromDisk()
  updateHooksConfigSnapshot()

  setAppState(prev => {
    let newContext = getPermissionsModule().syncPermissionRulesFromDisk(
      prev.toolPermissionContext,
      updatedRules,
    )

    // Ant-only: re-strip overly broad Bash allow rules after settings sync
    if (
      process.env.USER_TYPE === 'ant' &&
      readGizziEnv('ENTRYPOINT') !== 'local-agent'
    ) {
      const overlyBroad = getPermissionSetupModule().findOverlyBroadBashPermissions(
        updatedRules,
        [],
      )
      if (overlyBroad.length > 0) {
        newContext = getPermissionSetupModule().removeDangerousPermissions(
          newContext,
          overlyBroad,
        )
      }
    }

    if (
      newContext.isBypassPermissionsModeAvailable &&
      getPermissionSetupModule().isBypassPermissionsModeDisabled()
    ) {
      newContext =
        getPermissionSetupModule().createDisabledBypassPermissionsContext(
          newContext,
        )
    }

    newContext = getPermissionSetupModule().transitionPlanAutoMode(newContext)

    // Sync effortLevel from settings to top-level AppState when it changes
    // (e.g. via applyFlagSettings from IDE). Only propagate if the setting
    // itself changed — otherwise unrelated settings churn (e.g. tips dismissal
    // on startup) would clobber a --effort CLI flag value held in AppState.
    const prevEffort = prev.settings.effortLevel
    const newEffort = newSettings.effortLevel
    const effortChanged = prevEffort !== newEffort

    return {
      ...prev,
      settings: newSettings,
      toolPermissionContext: newContext,
      // Only propagate a defined new value — when the disk key is absent
      // (e.g. /effort max for non-ants writes undefined; --effort CLI flag),
      // prev.settings.effortLevel can be stale (internal writes suppress the
      // watcher that would resync AppState.settings), so effortChanged would
      // be true and we'd wipe a session-scoped value held in effortValue.
      ...(effortChanged && newEffort !== undefined
        ? { effortValue: newEffort }
        : {}),
    }
  })
}
