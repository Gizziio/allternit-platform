// @ts-nocheck
import * as React from 'react';
import { getOauthProfileFromApiKey } from 'src/services/oauth/getOauthProfile';
import { isClaudeAISubscriber } from 'src/utils/auth';
import { Text } from '../../ink';
import { logEvent } from '../../services/analytics/index';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config';
import { useStartupNotification } from './useStartupNotification';
const MAX_SHOW_COUNT = 3;

/**
 * Hook to check if the user has a subscription on Console but isn't logged into it.
 */
export function useCanSwitchToExistingSubscription() {
  useStartupNotification(async () => {
    if ((getGlobalConfig().subscriptionNoticeCount ?? 0) >= MAX_SHOW_COUNT) {
      return null;
    }
    const subscriptionType = await getExistingClaudeSubscription();
    if (subscriptionType === null) {
      return null;
    }
    saveGlobalConfig(current => ({
      ...current,
      subscriptionNoticeCount: (current.subscriptionNoticeCount ?? 0) + 1
    }));
    logEvent("tengu_switch_to_subscription_notice_shown", {});
    return {
      key: "switch-to-subscription",
      jsx: <Text color="suggestion">Use your existing Claude {subscriptionType} plan with Claude Code<Text color="text" dimColor={true}>{" "}· /login to activate</Text></Text>,
      priority: "low"
    };
  });
}

async function getExistingClaudeSubscription(): Promise<'Max' | 'Pro' | null> {
  // If already using subscription auth, there is nothing to switch to
  if (isClaudeAISubscriber()) {
    return null;
  }
  const profile = await getOauthProfileFromApiKey();
  if (!profile) {
    return null;
  }
  if (profile.account.has_claude_max) {
    return 'Max';
  }
  if (profile.account.has_claude_pro) {
    return 'Pro';
  }
  return null;
}
