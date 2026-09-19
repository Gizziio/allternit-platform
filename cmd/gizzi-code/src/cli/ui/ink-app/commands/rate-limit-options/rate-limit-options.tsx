import React, { useMemo, useState } from 'react';
import type { CommandResultDisplay, LocalJSXCommandContext } from '../../commands';
import { type OptionWithDescription, Select } from '../../components/CustomSelect/select';
import { Dialog } from '../../components/design-system/Dialog';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook';
import { logEvent } from '../../services/analytics/index';
import { useClaudeAiLimits } from '../../services/claudeAiLimitsHook';
import type { ToolUseContext } from '../../Tool';
import type { LocalJSXCommandOnDone } from '../../types/command';
import { getOauthAccountInfo, getRateLimitTier, getSubscriptionType } from '../../utils/auth';
import { hasClaudeAiBillingAccess } from '../../utils/billing';
import { call as extraUsageCall } from '../extra-usage/extra-usage';
import { extraUsage } from '../extra-usage/index';
import upgrade from '../upgrade/index';
import { call as upgradeCall } from '../upgrade/upgrade';
type RateLimitOptionsMenuOptionType = 'upgrade' | 'extra-usage' | 'cancel';
type RateLimitOptionsMenuProps = {
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay | undefined;
  } | undefined) => void;
  context: ToolUseContext & LocalJSXCommandContext;
};
function RateLimitOptionsMenu({
    onDone,
    context
}: RateLimitOptionsMenuProps) {
  const [subCommandJSX, setSubCommandJSX] = useState(null);
  const claudeAiLimits = useClaudeAiLimits();
  const t1 = getSubscriptionType();

  const subscriptionType = t1;
  const t2 = getRateLimitTier();

  const rateLimitTier = t2;
  const hasExtraUsageEnabled = getOauthAccountInfo()?.hasExtraUsageEnabled === true;
  const isMax = subscriptionType === "max";
  const isMax20x = isMax && rateLimitTier === "default_claude_max_20x";
  const isTeamOrEnterprise = subscriptionType === "team" || subscriptionType === "enterprise";
  const buyFirst = getFeatureValue_CACHED_MAY_BE_STALE("tengu_jade_anvil_4", false);
  let t3;
  bb0: {
    const actionOptions = [];
    if (extraUsage.isEnabled()) {
        const hasBillingAccess = hasClaudeAiBillingAccess();
        const needsToRequestFromAdmin = isTeamOrEnterprise && !hasBillingAccess;
        const isOrgSpendCapDepleted = claudeAiLimits.overageDisabledReason === "out_of_credits" || claudeAiLimits.overageDisabledReason === "org_level_disabled_until" || claudeAiLimits.overageDisabledReason === "org_service_zero_credit_limit";
        if (needsToRequestFromAdmin && isOrgSpendCapDepleted) {} else {
          const isOverageState = claudeAiLimits.overageStatus === "rejected" || claudeAiLimits.overageStatus === "allowed_warning";
          let label;
          if (needsToRequestFromAdmin) {
            label = isOverageState ? "Request more" : "Request extra usage";
          } else {
            label = hasExtraUsageEnabled ? "Add funds to continue with extra usage" : "Switch to extra usage";
          }
          const t4 = {
              label,
              value: "extra-usage"
            };

          actionOptions.push(t4);
        }
      }
    if (!isMax20x && !isTeamOrEnterprise && upgrade.isEnabled()) {
        const t4 = {
            label: "Upgrade your plan",
            value: "upgrade"
          };

        actionOptions.push(t4);
      }

    const t4 = {
        label: "Stop and wait for limit to reset",
        value: "cancel"
      };

    const cancelOption = t4;
    if (buyFirst) {
      const t5 = [...actionOptions, cancelOption];

      t3 = t5;
      break bb0;
    }
    const t5 = [cancelOption, ...actionOptions];

    t3 = t5;
  }
  const options = t3;
  const t4 = function handleCancel() {
      logEvent("tengu_rate_limit_options_menu_cancel", {});
      onDone(undefined, {
        display: "skip"
      });
    };

  const handleCancel = t4;
  const t5 = function handleSelect(value) {
      if (value === "upgrade") {
        logEvent("tengu_rate_limit_options_menu_select_upgrade", {});
        upgradeCall(onDone, context).then(jsx => {
          if (jsx) {
            setSubCommandJSX(jsx);
          }
        });
      } else {
        if (value === "extra-usage") {
          logEvent("tengu_rate_limit_options_menu_select_extra_usage", {});
          extraUsageCall(onDone, context).then(jsx_0 => {
            if (jsx_0) {
              setSubCommandJSX(jsx_0);
            }
          });
        } else {
          if (value === "cancel") {
            handleCancel();
          }
        }
      }
    };

  const handleSelect = t5;
  if (subCommandJSX) {
    return subCommandJSX;
  }
  const t6 = <Select options={options} onChange={handleSelect} visibleOptionCount={options.length} />;

  const t7 = <Dialog title="What do you want to do?" onCancel={handleCancel} color="suggestion">{t6}</Dialog>;

  return t7;
}
export async function call(onDone: LocalJSXCommandOnDone, context: ToolUseContext & LocalJSXCommandContext): Promise<React.ReactNode> {
  return <RateLimitOptionsMenu onDone={onDone} context={context} />;
}
