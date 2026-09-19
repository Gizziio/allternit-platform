import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { Text } from './../../ink.ts';
import { getRateLimitWarning, getUsingOverageText } from './../../services/claudeAiLimits.ts';
import { useClaudeAiLimits } from './../../services/claudeAiLimitsHook.ts';
import { getSubscriptionType } from './../../utils/auth.ts';
import { hasClaudeAiBillingAccess } from './../../utils/billing.ts';
import { getIsRemoteMode } from '../../bootstrap/state';
export function useRateLimitWarningNotification(model) {
  const {
    addNotification
  } = useNotifications();
  const claudeAiLimits = useClaudeAiLimits();
  const t0 = getRateLimitWarning(claudeAiLimits, model);

  const rateLimitWarning = t0;
  const t1 = getUsingOverageText(claudeAiLimits);

  const usingOverageText = t1;
  const shownWarningRef = useRef(null);
  const t2 = getSubscriptionType();

  const subscriptionType = t2;
  const t3 = hasClaudeAiBillingAccess();

  const hasBillingAccess = t3;
  const isTeamOrEnterprise = subscriptionType === "team" || subscriptionType === "enterprise";
  const [hasShownOverageNotification, setHasShownOverageNotification] = useState(false);
  const t4 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (claudeAiLimits.isUsingOverage && !hasShownOverageNotification && (!isTeamOrEnterprise || hasBillingAccess)) {
        addNotification({
          key: "limit-reached",
          text: usingOverageText,
          priority: "immediate"
        });
        setHasShownOverageNotification(true);
      } else {
        if (!claudeAiLimits.isUsingOverage && hasShownOverageNotification) {
          setHasShownOverageNotification(false);
        }
      }
    };
  const t5 = [claudeAiLimits.isUsingOverage, usingOverageText, hasShownOverageNotification, addNotification, hasBillingAccess, isTeamOrEnterprise];

  useEffect(t4, t5);
  const t6 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (rateLimitWarning && rateLimitWarning !== shownWarningRef.current) {
        shownWarningRef.current = rateLimitWarning;
        addNotification({
          key: "rate-limit-warning",
          jsx: <Text><Text color="warning">{rateLimitWarning}</Text></Text>,
          priority: "high"
        });
      }
    };
  const t7 = [rateLimitWarning, addNotification];

  useEffect(t6, t7);
}
