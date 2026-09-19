import * as React from 'react';
import { useEffect, useState } from 'react';
import { extraUsage as extraUsageCommand } from './../../commands/extra-usage/index.ts';
import { formatCost } from './../../cost-tracker.ts';
import { getSubscriptionType } from './../../utils/auth.ts';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { type ExtraUsage, fetchUtilization, type RateLimit, type Utilization } from '../../services/api/usage';
import { formatResetText } from '../../utils/format';
import { logError } from '../../utils/log';
import { jsonStringify } from '../../utils/slowOperations';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint';
import { Byline } from '../design-system/Byline';
import { ProgressBar } from '../design-system/ProgressBar';
import { isEligibleForOverageCreditGrant, OverageCreditUpsell } from '../LogoV2/OverageCreditUpsell';
type LimitBarProps = {
  title: string;
  limit: RateLimit;
  maxWidth: number;
  showTimeInReset?: boolean;
  extraSubtext?: string;
};
function LimitBar({
    title,
    limit,
    maxWidth,
    showTimeInReset: t1,
    extraSubtext
}: LimitBarProps) {
  const showTimeInReset = t1 === undefined ? true : t1;
  const {
    utilization,
    resets_at
  } = limit;
  if (utilization === null) {
    return null;
  }
  const usedText = `${Math.floor(utilization)}% used`;
  let subtext;
  if (resets_at) {
    const t2 = formatResetText(resets_at, true, showTimeInReset);

    subtext = `Resets ${t2}`;
  }
  if (extraSubtext) {
    if (subtext) {
      subtext = `${extraSubtext} · ${subtext}`;
    } else {
      subtext = extraSubtext;
    }
  }
  if (maxWidth >= 62) {
    const t2 = <Text bold={true}>{title}</Text>;

    const t3 = utilization / 100;
    const t4 = <ProgressBar ratio={t3} width={50} fillColor="rate_limit_fill" emptyColor="rate_limit_empty" />;

    const t5 = <Text>{usedText}</Text>;

    const t6 = <Box flexDirection="row" gap={1}>{t4}{t5}</Box>;

    const t7 = subtext && <Text dimColor={true}>{subtext}</Text>;

    const t8 = <Box flexDirection="column">{t2}{t6}{t7}</Box>;

    return t8;
  } else {
    const t2 = <Text bold={true}>{title}</Text>;

    const t3 = subtext && <><Text> </Text><Text dimColor={true}>· {subtext}</Text></>;

    const t4 = <Text>{t2}{t3}</Text>;

    const t5 = utilization / 100;
    const t6 = <ProgressBar ratio={t5} width={maxWidth} fillColor="rate_limit_fill" emptyColor="rate_limit_empty" />;

    const t7 = <Text>{usedText}</Text>;

    const t8 = <Box flexDirection="column">{t4}{t6}{t7}</Box>;

    return t8;
  }
}
export function Usage(): React.ReactNode {
  const [utilization, setUtilization] = useState<Utilization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {
    columns
  } = useTerminalSize();
  const availableWidth = columns - 2; // 2 for screen padding
  const maxWidth = Math.min(availableWidth, 80);
  const loadUtilization = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUtilization();
      setUtilization(data);
    } catch (err) {
      logError(err as Error);
      const axiosError = err as {
        response?: {
          data?: unknown;
        };
      };
      const responseBody = axiosError.response?.data ? jsonStringify(axiosError.response.data) : undefined;
      setError(responseBody ? `Failed to load usage data: ${responseBody}` : 'Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadUtilization();
  }, [loadUtilization]);
  useKeybinding('settings:retry', () => {
    void loadUtilization();
  }, {
    context: 'Settings',
    isActive: !!error && !isLoading
  });
  if (error) {
    return <Box flexDirection="column" gap={1}>
        <Text color="error">Error: {error}</Text>
        <Text dimColor>
          <Byline>
            <ConfigurableShortcutHint action="settings:retry" context="Settings" fallback="r" description="retry" />
            <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
          </Byline>
        </Text>
      </Box>;
  }
  if (!utilization) {
    return <Box flexDirection="column" gap={1}>
        <Text dimColor>Loading usage data…</Text>
        <Text dimColor>
          <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
        </Text>
      </Box>;
  }

  // Only Max and Team plans have a Sonnet limit that differs from the weekly
  // limit (see rateLimitMessages.ts). For other plans the bar is redundant.
  // Show for null (unknown plan) to stay consistent with rateLimitMessages.ts,
  // which labels it "Sonnet limit" in that case.
  const subscriptionType = getSubscriptionType();
  const showSonnetBar = subscriptionType === 'max' || subscriptionType === 'team' || subscriptionType === null;
  const limits = [{
    title: 'Current session',
    limit: utilization.five_hour
  }, {
    title: 'Current week (all models)',
    limit: utilization.seven_day
  }, ...(showSonnetBar ? [{
    title: 'Current week (Sonnet only)',
    limit: utilization.seven_day_sonnet
  }] : [])];
  return <Box flexDirection="column" gap={1} width="100%">
      {limits.some(({
      limit
    }) => limit) || <Text dimColor>/usage is only available for subscription plans.</Text>}

      {limits.map(({
      title,
      limit: limit_0
    }) => limit_0 && <LimitBar key={title} title={title} limit={limit_0} maxWidth={maxWidth} />)}

      {utilization.extra_usage && <ExtraUsageSection extraUsage={utilization.extra_usage} maxWidth={maxWidth} />}

      {isEligibleForOverageCreditGrant() && <OverageCreditUpsell maxWidth={maxWidth} />}

      <Text dimColor>
        <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
      </Text>
    </Box>;
}
type ExtraUsageSectionProps = {
  extraUsage: ExtraUsage;
  maxWidth: number;
};
const EXTRA_USAGE_SECTION_TITLE = 'Extra usage';
function ExtraUsageSection({
    extraUsage,
    maxWidth
}: ExtraUsageSectionProps) {
  const subscriptionType = getSubscriptionType();
  const isProOrMax = subscriptionType === "pro" || subscriptionType === "max";
  if (!isProOrMax) {
    return false;
  }
  if (!extraUsage.is_enabled) {
    if (extraUsageCommand.isEnabled()) {
      const t1 = <Box flexDirection="column"><Text bold={true}>{EXTRA_USAGE_SECTION_TITLE}</Text><Text dimColor={true}>Extra usage not enabled · /extra-usage to enable</Text></Box>;

      return t1;
    }
    return null;
  }
  if (extraUsage.monthly_limit === null) {
    const t1 = <Box flexDirection="column"><Text bold={true}>{EXTRA_USAGE_SECTION_TITLE}</Text><Text dimColor={true}>Unlimited</Text></Box>;

    return t1;
  }
  if (typeof extraUsage.used_credits !== "number" || typeof extraUsage.utilization !== "number") {
    return null;
  }
  const t1 = extraUsage.used_credits / 100;
  const t2 = formatCost(t1, 2);

  const formattedUsedCredits = t2;
  const t3 = extraUsage.monthly_limit / 100;
  const t4 = formatCost(t3, 2);

  const formattedMonthlyLimit = t4;
  const now = new Date();
  const oneMonthReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const T0 = LimitBar;
  const t7 = EXTRA_USAGE_SECTION_TITLE;
  const t5 = extraUsage.utilization;
  const t6 = oneMonthReset.toISOString();

  const t8 = {
      utilization: t5,
      resets_at: t6
    };

  const t9 = `${formattedUsedCredits} / ${formattedMonthlyLimit} spent`;
  const t10 = <T0 title={t7} limit={t8} showTimeInReset={false} extraSubtext={t9} maxWidth={maxWidth} />;

  return t10;
}
