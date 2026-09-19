import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Text } from '../ink';
import { isMaxSubscriber, isProSubscriber, isTeamSubscriber } from '../utils/auth';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config';
import type { EffortLevel } from '../utils/effort';
import { convertEffortValueToLevel, getDefaultEffortForModel, getOpusDefaultEffortConfig, toPersistableEffort } from '../utils/effort';
import { parseUserSpecifiedModel } from '../utils/model/model';
import { updateSettingsForSource } from '../utils/settings/settings';
import type { OptionWithDescription } from './CustomSelect/select';
import { Select } from './CustomSelect/select';
import { effortLevelToSymbol } from './EffortIndicator';
import { PermissionDialog } from './permissions/PermissionDialog';
type EffortCalloutSelection = EffortLevel | undefined | 'dismiss';
type Props = {
  model: string;
  onDone: (selection: EffortCalloutSelection) => void;
};
const AUTO_DISMISS_MS = 30_000;
export function EffortCallout({
    model,
    onDone
}: Props) {
  const t1 = getOpusDefaultEffortConfig();

  const defaultEffortConfig = t1;
  const onDoneRef = useRef(onDone);
  const t2 = () => {
      onDoneRef.current = onDone;
    };

  useEffect(t2);
  const t3 = () => {
      onDoneRef.current("dismiss");
    };

  const handleCancel = t3;
  const t4 = [];

  useEffect(_temp, t4);
  const t5 = () => {
      const timeoutId = setTimeout(handleCancel, AUTO_DISMISS_MS);
      return () => clearTimeout(timeoutId);
    };
  const t6 = [handleCancel];

  useEffect(t5, t6);
  const defaultEffort = getDefaultEffortForModel(model);
  const t7 = defaultEffort ? convertEffortValueToLevel(defaultEffort) : "high";

  const defaultLevel = t7;
  const t8 = value => {
      const effortLevel = value === defaultLevel ? undefined : value;
      updateSettingsForSource("userSettings", {
        effortLevel: toPersistableEffort(effortLevel)
      });
      onDoneRef.current(value);
    };

  const handleSelect = t8;
  const t9 = [{
      label: <EffortOptionLabel level="medium" text="Medium (recommended)" />,
      value: "medium"
    }, {
      label: <EffortOptionLabel level="high" text="High" />,
      value: "high"
    }, {
      label: <EffortOptionLabel level="low" text="Low" />,
      value: "low"
    }];

  const options = t9;
  const t10 = <Box marginBottom={1} flexDirection="column"><Text>{defaultEffortConfig.dialogDescription}</Text></Box>;

  const t11 = <EffortIndicatorSymbol level="low" />;

  const t12 = <EffortIndicatorSymbol level="medium" />;

  const t13 = <Box marginBottom={1}><Text dimColor={true}>{t11} low {"\xB7"}{" "}{t12} medium {"\xB7"}{" "}<EffortIndicatorSymbol level="high" /> high</Text></Box>;

  const t14 = <PermissionDialog title={defaultEffortConfig.dialogTitle}><Box flexDirection="column" paddingX={2} paddingY={1}>{t10}{t13}<Select options={options} onChange={handleSelect} onCancel={handleCancel} /></Box></PermissionDialog>;

  return t14;
}
function _temp() {
  markV2Dismissed();
}
function EffortIndicatorSymbol(t0) {
  const {
    level
  } = t0;
  const t1 = effortLevelToSymbol(level);

  const t2 = <Text color="suggestion">{t1}</Text>;

  return t2;
}
function EffortOptionLabel(t0) {
  const {
    level,
    text
  } = t0;
  const t1 = <EffortIndicatorSymbol level={level} />;

  const t2 = <>{t1} {text}</>;

  return t2;
}

/**
 * Check whether to show the effort callout.
 *
 * Audience:
 * - Pro: already had medium default; show unless they saw v1 (effortCalloutDismissed)
 * - Max/Team: getting medium via tengu_grey_step2 config; show when enabled
 * - Everyone else: mark as dismissed so it never shows
 */
export function shouldShowEffortCallout(model: string): boolean {
  // Only show for Opus 4.6 for now
  const parsed = parseUserSpecifiedModel(model);
  if (!parsed.toLowerCase().includes('opus-4-6')) {
    return false;
  }
  const config = getGlobalConfig();
  if (config.effortCalloutV2Dismissed) return false;

  // Don't show to brand-new users — they never knew the old default, so this
  // isn't a change for them. Mark as dismissed so it stays suppressed.
  if (config.numStartups <= 1) {
    markV2Dismissed();
    return false;
  }

  // Pro users already had medium default before this PR. Show the new copy,
  // but skip if they already saw the v1 dialog — no point nagging twice.
  if (isProSubscriber()) {
    if (config.effortCalloutDismissed) {
      markV2Dismissed();
      return false;
    }
    return getOpusDefaultEffortConfig().enabled;
  }

  // Max/Team are the target of the tengu_grey_step2 config.
  // Don't mark dismissed when config is disabled — they should see the dialog
  // once it's enabled for them.
  if (isMaxSubscriber() || isTeamSubscriber()) {
    return getOpusDefaultEffortConfig().enabled;
  }

  // Everyone else (free tier, API key, non-subscribers): not in scope.
  markV2Dismissed();
  return false;
}
function markV2Dismissed(): void {
  saveGlobalConfig(current => {
    if (current.effortCalloutV2Dismissed) return current;
    return {
      ...current,
      effortCalloutV2Dismissed: true
    };
  });
}
