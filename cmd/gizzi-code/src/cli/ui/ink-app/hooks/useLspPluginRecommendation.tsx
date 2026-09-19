/**
 * Hook for LSP plugin recommendations
 *
 * Detects file edits and recommends LSP plugins when:
 * - File extension matches an LSP plugin
 * - LSP binary is already installed on the system
 * - Plugin is not already installed
 * - User hasn't disabled recommendations
 *
 * Only shows one recommendation per session.
 */

import { extname, join } from 'path';
import * as React from 'react';
import { hasShownLspRecommendationThisSession, setLspRecommendationShownThisSession } from '../bootstrap/state';
import { useNotifications } from '../../../../context/notifications';
import { useAppState } from '../state/AppState';
import { saveGlobalConfig } from '../utils/config';
import { logForDebugging } from '../utils/debug';
import { logError } from '../utils/log';
import { addToNeverSuggest, getMatchingLspPlugins, incrementIgnoredCount } from '../utils/plugins/lspRecommendation';
import { cacheAndRegisterPlugin } from '../utils/plugins/pluginInstallationHelpers';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings';
import { installPluginAndNotify, usePluginRecommendationBase } from './usePluginRecommendationBase';

// Threshold for detecting timeout vs explicit dismiss (ms)
// Menu auto-dismisses at 30s, so anything over 28s is likely timeout
const TIMEOUT_THRESHOLD_MS = 28_000;
export type LspRecommendationState = {
  pluginId: string;
  pluginName: string;
  pluginDescription?: string;
  fileExtension: string;
  shownAt: number; // Timestamp for timeout detection
} | null;
type UseLspPluginRecommendationResult = {
  recommendation: LspRecommendationState;
  handleResponse: (response: 'yes' | 'no' | 'never' | 'disable') => void;
};
export function useLspPluginRecommendation() {
  const trackedFiles = useAppState(_temp);
  const {
    addNotification
  } = useNotifications();
  const t0 = new Set();

  const checkedFilesRef = React.useRef(t0);
  const {
    recommendation,
    clearRecommendation,
    tryResolve
  } = usePluginRecommendationBase();
  const t1 = () => {
      tryResolve(async () => {
        if (hasShownLspRecommendationThisSession()) {
          return null;
        }
        const newFiles = [];
        for (const file of trackedFiles) {
          if (!checkedFilesRef.current.has(file)) {
            checkedFilesRef.current.add(file);
            newFiles.push(file);
          }
        }
        for (const filePath of newFiles) {
          ;
          try {
            const matches = await getMatchingLspPlugins(filePath);
            const match = matches[0];
            if (match) {
              logForDebugging(`[useLspPluginRecommendation] Found match: ${match.pluginName} for ${filePath}`);
              setLspRecommendationShownThisSession(true);
              return {
                pluginId: match.pluginId,
                pluginName: match.pluginName,
                pluginDescription: match.description,
                fileExtension: extname(filePath),
                shownAt: Date.now()
              };
            }
          } catch (t3) {
            const error = t3;
            logError(error);
          }
        }
        return null;
      });
    };
  const t2 = [trackedFiles, tryResolve];

  React.useEffect(t1, t2);
  const t3 = response => {
      if (!recommendation) {
        return;
      }
      const {
        pluginId,
        pluginName,
        shownAt
      } = recommendation;
      logForDebugging(`[useLspPluginRecommendation] User response: ${response} for ${pluginName}`);
      bb60: switch (response) {
        case "yes":
          {
            installPluginAndNotify(pluginId, pluginName, "lsp-plugin", addNotification, async pluginData => {
              logForDebugging(`[useLspPluginRecommendation] Installing plugin: ${pluginId}`);
              const localSourcePath = typeof pluginData.entry.source === "string" ? join(pluginData.marketplaceInstallLocation, pluginData.entry.source) : undefined;
              await cacheAndRegisterPlugin(pluginId, pluginData.entry, "user", undefined, localSourcePath);
              const settings = getSettingsForSource("userSettings");
              updateSettingsForSource("userSettings", {
                enabledPlugins: {
                  ...settings?.enabledPlugins,
                  [pluginId]: true
                }
              });
              logForDebugging(`[useLspPluginRecommendation] Plugin installed: ${pluginId}`);
            });
            break bb60;
          }
        case "no":
          {
            const elapsed = Date.now() - shownAt;
            if (elapsed >= TIMEOUT_THRESHOLD_MS) {
              logForDebugging(`[useLspPluginRecommendation] Timeout detected (${elapsed}ms), incrementing ignored count`);
              incrementIgnoredCount();
            }
            break bb60;
          }
        case "never":
          {
            addToNeverSuggest(pluginId);
            break bb60;
          }
        case "disable":
          {
            saveGlobalConfig(_temp2);
          }
      }
      clearRecommendation();
    };

  const handleResponse = t3;
  const t4 = {
      recommendation,
      handleResponse
    };

  return t4;
}
function _temp2(current) {
  if (current.lspRecommendationDisabled) {
    return current;
  }
  return {
    ...current,
    lspRecommendationDisabled: true
  };
}
function _temp(s) {
  return s.fileHistory.trackedFiles;
}
