// @ts-nocheck
/**
 * Leaf module for shouldEnablePromptSuggestion, extracted from
 * promptSuggestion.ts so AppStateStore.ts (which calls this synchronously
 * while building default app state) doesn't pull in that module's heavier
 * dependency graph (claudeAiLimits.js, speculation.js) which requires async
 * module init.
 */

import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../../utils/envUtils.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { isTeammate } from '../../utils/teammate.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'

export function shouldEnablePromptSuggestion(): boolean {
  // Env var overrides everything (for testing)
  const envOverride = process.env.GIZZI_CODE_ENABLE_PROMPT_SUGGESTION
  if (isEnvDefinedFalsy(envOverride)) {
    logEvent('tengu_prompt_suggestion_init', {
      enabled: false,
      source:
        'env' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return false
  }
  if (isEnvTruthy(envOverride)) {
    logEvent('tengu_prompt_suggestion_init', {
      enabled: true,
      source:
        'env' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return true
  }

  // Keep default in sync with Config.tsx (settings toggle visibility)
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_chomp_inflection', false)) {
    logEvent('tengu_prompt_suggestion_init', {
      enabled: false,
      source:
        'growthbook' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return false
  }

  // Disable in non-interactive mode (print mode, piped input, SDK)
  if (getIsNonInteractiveSession()) {
    logEvent('tengu_prompt_suggestion_init', {
      enabled: false,
      source:
        'non_interactive' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return false
  }

  // Disable for swarm teammates (only leader should show suggestions)
  if (isAgentSwarmsEnabled() && isTeammate()) {
    logEvent('tengu_prompt_suggestion_init', {
      enabled: false,
      source:
        'swarm_teammate' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return false
  }

  const enabled = getInitialSettings()?.promptSuggestionEnabled !== false
  logEvent('tengu_prompt_suggestion_init', {
    enabled,
    source:
      'setting' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
  return enabled
}
