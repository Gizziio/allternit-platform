import React, { useEffect, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from './../../services/analytics/index.ts';
import { Box, Link, Text, useInput } from '../../ink';
import { type AccountSettings, calculateShouldShowGrove, type GroveConfig, getGroveNoticeConfig, getGroveSettings, markGroveNoticeViewed, updateGroveSettings } from '../../services/api/grove';
import { Select } from '../CustomSelect/index';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
export type GroveDecision = 'accept_opt_in' | 'accept_opt_out' | 'defer' | 'escape' | 'skip_rendering';
type Props = {
  showIfAlreadyViewed: boolean;
  location: 'settings' | 'policy_update_modal' | 'onboarding';
  onDone(decision: GroveDecision): void;
};
const NEW_TERMS_ASCII = ` _____________
 |          \\  \\
 | NEW TERMS \\__\\
 |              |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |              |
 |______________|`;
function GracePeriodContentBody() {
  const t0 = <Text>An update to our Consumer Terms and Privacy Policy will take effect on{" "}<Text bold={true}>October 8, 2025</Text>. You can accept the updated terms today.</Text>;

  const t1 = <Text>What's changing?</Text>;

  const t2 = <Text>· </Text>;
  const t3 = <Text bold={true}>You can help improve Gizzi </Text>;

  const t4 = <Box paddingLeft={1}><Text>{t2}{t3}<Text>— Allow the use of your chats and coding sessions to train and improve our AI models. Change anytime in your Privacy Settings (<Link url="https://allternit.io/legal/privacy" />).</Text></Text></Box>;

  const t5 = <Box flexDirection="column">{t1}{t4}<Box paddingLeft={1}><Text><Text>· </Text><Text bold={true}>Updates to data retention </Text><Text>— To help us improve our AI models and safety protections, we're extending data retention to 5 years.</Text></Text></Box></Box>;

  const t6 = <Link url="https://www.allternit.io/news/updates-to-our-consumer-terms" />;

  const t7 = <Link url="https://allternit.io/legal/terms" />;

  const t8 = <>{t0}{t5}<Text>Learn more ({t6}) or read the updated Consumer Terms ({t7}) and Privacy Policy (<Link url="https://allternit.io/legal/privacy" />)</Text></>;

  return t8;
}
function PostGracePeriodContentBody() {
  const t0 = <Text>We've updated our Consumer Terms and Privacy Policy.</Text>;

  const t1 = <Text>What's changing?</Text>;

  const t2 = <Box flexDirection="column"><Text bold={true}>Help improve Gizzi</Text><Text>Allow the use of your chats and coding sessions to train and improve our AI models. You can change this anytime in Privacy Settings</Text><Link url="https://allternit.io/legal/privacy" /></Box>;

  const t3 = <Box flexDirection="column" gap={1}>{t1}{t2}<Box flexDirection="column"><Text bold={true}>How this affects data retention</Text><Text>Turning ON the improve Gizzi setting extends data retention from 30 days to 5 years. Turning it OFF keeps the default 30-day data retention. Delete data anytime.</Text></Box></Box>;

  const t4 = <Link url="https://www.allternit.io/news/updates-to-our-consumer-terms" />;

  const t5 = <Link url="https://allternit.io/legal/terms" />;

  const t6 = <>{t0}{t3}<Text>Learn more ({t4}) or read the updated Consumer Terms ({t5}) and Privacy Policy (<Link url="https://allternit.io/legal/privacy" />)</Text></>;

  return t6;
}
export function GroveDialog(t0) {
  const {
    showIfAlreadyViewed,
    location,
    onDone
  } = t0;
  const [shouldShowDialog, setShouldShowDialog] = useState(null);
  const [groveConfig, setGroveConfig] = useState(null);
  const t1 = () => {
      const checkGroveSettings = async function checkGroveSettings() {
        const [settingsResult, configResult] = await Promise.all([getGroveSettings(), getGroveNoticeConfig()]);
        const config = configResult.success ? configResult.data : null;
        setGroveConfig(config);
        const shouldShow = calculateShouldShowGrove(settingsResult, configResult, showIfAlreadyViewed);
        setShouldShowDialog(shouldShow);
        if (!shouldShow) {
          onDone("skip_rendering");
          return;
        }
        markGroveNoticeViewed();
        logEvent("tengu_grove_policy_viewed", {
          location: location as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          dismissable: config?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      };
      checkGroveSettings();
    };
  const t2 = [showIfAlreadyViewed, location, onDone];

  useEffect(t1, t2);
  if (shouldShowDialog === null) {
    return null;
  }
  if (!shouldShowDialog) {
    return null;
  }
  const t3 = async function onChange(value) {
      bb21: switch (value) {
        case "accept_opt_in":
          {
            await updateGroveSettings(true);
            logEvent("tengu_grove_policy_submitted", {
              state: true,
              dismissable: groveConfig?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            break bb21;
          }
        case "accept_opt_out":
          {
            await updateGroveSettings(false);
            logEvent("tengu_grove_policy_submitted", {
              state: false,
              dismissable: groveConfig?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            break bb21;
          }
        case "defer":
          {
            logEvent("tengu_grove_policy_dismissed", {
              state: true
            });
            break bb21;
          }
        case "escape":
          {
            logEvent("tengu_grove_policy_escaped", {});
          }
      }
      onDone(value);
    };

  const onChange = t3;
  const t4 = groveConfig?.domain_excluded ? [{
      label: "Accept terms \xB7 Help improve Gizzi: OFF (for emails with your domain)",
      value: "accept_opt_out"
    }] : [{
      label: "Accept terms \xB7 Help improve Gizzi: ON",
      value: "accept_opt_in"
    }, {
      label: "Accept terms \xB7 Help improve Gizzi: OFF",
      value: "accept_opt_out"
    }];

  const acceptOptions = t4;
  const t5 = function handleCancel() {
      if (groveConfig?.notice_is_grace_period) {
        onChange("defer");
        return;
      }
      onChange("escape");
    };

  const handleCancel = t5;
  const t6 = <Box flexDirection="column" gap={1} flexGrow={1}>{groveConfig?.notice_is_grace_period ? <GracePeriodContentBody /> : <PostGracePeriodContentBody />}</Box>;

  const t7 = <Box flexShrink={0}><Text color="professionalBlue">{NEW_TERMS_ASCII}</Text></Box>;

  const t8 = <Box flexDirection="row">{t6}{t7}</Box>;

  const t9 = <Box flexDirection="column"><Text bold={true}>Please select how you'd like to continue</Text><Text>Your choice takes effect immediately upon confirmation.</Text></Box>;

  const t10 = groveConfig?.notice_is_grace_period ? [{
      label: "Not now",
      value: "defer"
    }] : [];

  const t11 = [...acceptOptions, ...t10];

  const t12 = value_0 => onChange(value_0 as 'accept_opt_in' | 'accept_opt_out' | 'defer');

  const t13 = <Box flexDirection="column" gap={1}>{t9}<Select options={t11} onChange={t12} onCancel={handleCancel} /></Box>;

  const t14 = <Dialog title="Updates to Consumer Terms and Policies" color="professionalBlue" onCancel={handleCancel} inputGuide={_temp}>{t8}{t13}</Dialog>;

  return t14;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><KeyboardShortcutHint shortcut="Esc" action="cancel" /></Byline>;
}
type PrivacySettingsDialogProps = {
  settings: AccountSettings;
  domainExcluded?: boolean;
  onDone(): void;
};
export function PrivacySettingsDialog(t0) {
  const {
    settings,
    domainExcluded,
    onDone
  } = t0;
  const [groveEnabled, setGroveEnabled] = useState(settings.grove_enabled);
  const t1 = [];

  React.useEffect(_temp2, t1);
  const t2 = async (input, key) => {
      if (!domainExcluded && (key.tab || key.return || input === " ")) {
        const newValue = !groveEnabled;
        setGroveEnabled(newValue);
        await updateGroveSettings(newValue);
      }
    };

  useInput(t2);
  const t3 = <Text color="error">false</Text>;

  let valueComponent = t3;
  if (domainExcluded) {
    const t4 = <Text color="error">false (for emails with your domain)</Text>;

    valueComponent = t4;
  } else {
    if (groveEnabled) {
      const t4 = <Text color="success">true</Text>;

      valueComponent = t4;
    }
  }
  const t4 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : domainExcluded ? <KeyboardShortcutHint shortcut="Esc" action="cancel" /> : <Byline><KeyboardShortcutHint shortcut="Enter/Tab/Space" action="toggle" /><KeyboardShortcutHint shortcut="Esc" action="cancel" /></Byline>;

  const t5 = <Text>Review and manage your privacy settings at{" "}<Link url="https://allternit.io/legal/privacy" /></Text>;

  const t6 = <Box width={44}><Text bold={true}>Help improve Gizzi</Text></Box>;

  const t7 = <Box>{t6}<Box>{valueComponent}</Box></Box>;

  const t8 = <Dialog title="Data Privacy" color="professionalBlue" onCancel={onDone} inputGuide={t4}>{t5}{t7}</Dialog>;

  return t8;
}
function _temp2() {
  logEvent("tengu_grove_privacy_settings_viewed", {});
}
