/**
 * Surfaces plugin-install prompts driven by `<gizzi-hint />` tags
 * that CLIs/SDKs emit to stderr. See docs/gizzi-hints.md.
 *
 * Show-once semantics: each plugin is prompted for at most once ever,
 * recorded in config regardless of yes/no. The pre-store gate in
 * maybeRecordPluginHint already dropped installed/shown/capped hints, so
 * anything that reaches this hook is worth resolving.
 */

import * as React from 'react';
import { useNotifications } from '../../../../context/notifications';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED, logEvent } from '../services/analytics/index';
import { clearPendingHint, getPendingHintSnapshot, markShownThisSession, subscribeToPendingHint } from '../utils/gizziHints';
import { logForDebugging } from '../utils/debug';
import { disableHintRecommendations, markHintPluginShown, type PluginHintRecommendation, resolvePluginHint } from '../utils/plugins/hintRecommendation';
import { installPluginFromMarketplace } from '../utils/plugins/pluginInstallationHelpers';
import { installPluginAndNotify, usePluginRecommendationBase } from './usePluginRecommendationBase';
type UseGizziHintRecommendationResult = {
  recommendation: PluginHintRecommendation | null;
  handleResponse: (response: 'yes' | 'no' | 'disable') => void;
};
export function useGizziHintRecommendation() {
  const pendingHint = React.useSyncExternalStore(subscribeToPendingHint, getPendingHintSnapshot);
  const {
    addNotification
  } = useNotifications();
  const {
    recommendation,
    clearRecommendation,
    tryResolve
  } = usePluginRecommendationBase();
  const t0 = () => {
      if (!pendingHint) {
        return;
      }
      tryResolve(async () => {
        const resolved = await resolvePluginHint(pendingHint);
        if (resolved) {
          logForDebugging(`[useGizziHintRecommendation] surfacing ${resolved.pluginId} from ${resolved.sourceCommand}`);
          markShownThisSession();
        }
        if (getPendingHintSnapshot() === pendingHint) {
          clearPendingHint();
        }
        return resolved;
      });
    };
  const t1 = [pendingHint, tryResolve];

  React.useEffect(t0, t1);
  const t2 = response => {
      if (!recommendation) {
        return;
      }
      markHintPluginShown(recommendation.pluginId);
      logEvent("tengu_plugin_hint_response", {
        _PROTO_plugin_name: recommendation.pluginName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
        _PROTO_marketplace_name: recommendation.marketplaceName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
        response: response as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      bb15: switch (response) {
        case "yes":
          {
            const {
              pluginId,
              pluginName,
              marketplaceName
            } = recommendation;
            installPluginAndNotify(pluginId, pluginName, "hint-plugin", addNotification, async pluginData => {
              const result = await installPluginFromMarketplace({
                pluginId,
                entry: pluginData.entry,
                marketplaceName,
                scope: "user",
                trigger: "hint"
              });
              if (result.success === false) {
                throw new Error(result.error);
              }
            });
            break bb15;
          }
        case "disable":
          {
            disableHintRecommendations();
            break bb15;
          }
        case "no":
      }
      clearRecommendation();
    };

  const handleResponse = t2;
  const t3 = {
      recommendation,
      handleResponse
    };

  return t3;
}
