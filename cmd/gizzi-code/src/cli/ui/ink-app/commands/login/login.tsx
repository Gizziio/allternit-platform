import { feature } from 'bun:bundle';
import * as React from 'react';
import { resetCostState } from '../../bootstrap/state';
import { clearTrustedDeviceToken, enrollTrustedDevice } from '../../bridge/trustedDevice';
import type { LocalJSXCommandContext } from '../../commands';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint';
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow';
import { Dialog } from '../../components/design-system/Dialog';
import { useMainLoopModel } from '../../hooks/useMainLoopModel';
import { Text } from '../../ink';
import { refreshGrowthBookAfterAuthChange } from '../../services/analytics/growthbook';
import { refreshPolicyLimits } from '../../services/policyLimits/index';
import { refreshRemoteManagedSettings } from '../../services/remoteManagedSettings/index';
import type { LocalJSXCommandOnDone } from '../../types/command';
import { stripSignatureBlocks } from '../../utils/messages';
import { checkAndDisableAutoModeIfNeeded, checkAndDisableBypassPermissionsIfNeeded, resetAutoModeGateCheck, resetBypassPermissionsCheck } from '../../utils/permissions/bypassPermissionsKillswitch';
import { resetUserCache } from '../../utils/user';
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return <Login onDone={async success => {
    context.onChangeAPIKey();
    // Signature-bearing blocks (thinking, connector_text) are bound to the API key —
    // strip them so the new key doesn't reject stale signatures.
    context.setMessages(stripSignatureBlocks);
    if (success) {
      // Post-login refresh logic. Keep in sync with onboarding in src/interactiveHelpers.tsx
      // Reset cost state when switching accounts
      resetCostState();
      // Refresh remotely managed settings after login (non-blocking)
      void refreshRemoteManagedSettings();
      // Refresh policy limits after login (non-blocking)
      void refreshPolicyLimits();
      // Clear user data cache BEFORE GrowthBook refresh so it picks up fresh credentials
      resetUserCache();
      // Refresh GrowthBook after login to get updated feature flags (e.g., for claude.ai MCPs)
      refreshGrowthBookAfterAuthChange();
      // Clear any stale trusted device token from a previous account before
      // re-enrolling — prevents sending the old token on bridge calls while
      // the async enrollTrustedDevice() is in-flight.
      clearTrustedDeviceToken();
      // Enroll as a trusted device for Remote Control (10-min fresh-session window)
      void enrollTrustedDevice();
      // Reset killswitch gate checks and re-run with new org
      resetBypassPermissionsCheck();
      const appState = context.getAppState();
      void checkAndDisableBypassPermissionsIfNeeded(appState.toolPermissionContext, context.setAppState);
      if (feature('TRANSCRIPT_CLASSIFIER')) {
        resetAutoModeGateCheck();
        void checkAndDisableAutoModeIfNeeded(appState.toolPermissionContext, context.setAppState, appState.fastMode);
      }
      // Increment authVersion to trigger re-fetching of auth-dependent data in hooks (e.g., MCP servers)
      context.setAppState(prev => ({
        ...prev,
        authVersion: prev.authVersion + 1
      }));
    }
    onDone(success ? 'Login successful' : 'Login interrupted');
  }} />;
}
export function Login(props) {
  const mainLoopModel = useMainLoopModel();
  const t0 = () => props.onDone(false, mainLoopModel);

  const t1 = () => props.onDone(true, mainLoopModel);

  const t2 = <ConsoleOAuthFlow onDone={t1} startingMessage={props.startingMessage} />;

  const t3 = <Dialog title="Login" onCancel={t0} color="permission" inputGuide={_temp}>{t2}</Dialog>;

  return t3;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />;
}
