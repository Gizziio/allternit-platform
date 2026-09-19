import { feature } from 'bun:bundle';
import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { Box, Text } from '../ink';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook';
import { calculateTokenWarningState, getEffectiveContextWindowSize, isAutoCompactEnabled } from '../services/compact/autoCompact';
import { useCompactWarningSuppression } from '../services/compact/compactWarningHook';
import { getUpgradeMessage } from '../utils/model/contextWindowUpgradeCheck';
type Props = {
  tokenUsage: number;
  model: string;
};

export function TokenWarning({
    tokenUsage,
    model
}: Props) {
  const t1 = calculateTokenWarningState(tokenUsage, model);

  const {
    percentLeft,
    isAboveWarningThreshold,
    isAboveErrorThreshold
  } = t1;
  const suppressWarning = useCompactWarningSuppression();
  if (!isAboveWarningThreshold || suppressWarning) {
    return null;
  }
  const t2 = isAutoCompactEnabled();

  const showAutoCompactWarning = t2;
  const t3 = getUpgradeMessage("warning");

  const upgradeMessage = t3;
  let displayPercentLeft = percentLeft;
  let reactiveOnlyMode = false;
  if (feature("REACTIVE_COMPACT")) {
    if (getFeatureValue_CACHED_MAY_BE_STALE("tengu_cobalt_raccoon", false)) {
      reactiveOnlyMode = true;
    }
  }
  if (reactiveOnlyMode) {
    const effectiveWindow = getEffectiveContextWindowSize(model);
    const t4 = Math.round((effectiveWindow - tokenUsage) / effectiveWindow * 100);

    displayPercentLeft = Math.max(0, t4);
  }
  const autocompactLabel = reactiveOnlyMode ? `${100 - displayPercentLeft}% context used` : `${displayPercentLeft}% until auto-compact`;
  const t4 = <Box flexDirection="row">{showAutoCompactWarning ? <Text dimColor={true} wrap="truncate">{upgradeMessage ? `${autocompactLabel} \u00b7 ${upgradeMessage}` : autocompactLabel}</Text> : <Text color={isAboveErrorThreshold ? "error" : "warning"} wrap="truncate">{upgradeMessage ? `Context low (${percentLeft}% remaining) \u00b7 ${upgradeMessage}` : `Context low (${percentLeft}% remaining) \u00b7 Run /compact to compact & continue`}</Text>}</Box>;

  return t4;
}
