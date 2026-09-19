import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text } from '../../ink';
import { getDynamicConfig_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook';
import { logEvent } from '../../services/analytics/index';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config';
import { Select } from '../CustomSelect/select';
import { DesktopHandoff } from '../DesktopHandoff';
import { PermissionDialog } from '../permissions/PermissionDialog';
type DesktopUpsellConfig = {
  enable_shortcut_tip: boolean;
  enable_startup_dialog: boolean;
};
const DESKTOP_UPSELL_DEFAULT: DesktopUpsellConfig = {
  enable_shortcut_tip: false,
  enable_startup_dialog: false
};
export function getDesktopUpsellConfig(): DesktopUpsellConfig {
  return getDynamicConfig_CACHED_MAY_BE_STALE('tengu_desktop_upsell', DESKTOP_UPSELL_DEFAULT);
}
function isSupportedPlatform(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32' && process.arch === 'x64';
}
export function shouldShowDesktopUpsellStartup(): boolean {
  if (!isSupportedPlatform()) return false;
  if (!getDesktopUpsellConfig().enable_startup_dialog) return false;
  const config = getGlobalConfig();
  if (config.desktopUpsellDismissed) return false;
  if ((config.desktopUpsellSeenCount ?? 0) >= 3) return false;
  return true;
}
type DesktopUpsellSelection = 'try' | 'not-now' | 'never';
type Props = {
  onDone: () => void;
};
export function DesktopUpsellStartup({
    onDone
}: Props) {
  const [showHandoff, setShowHandoff] = useState(false);
  const t1 = [];

  useEffect(_temp, t1);
  if (showHandoff) {
    const t2 = <DesktopHandoff onDone={() => onDone()} />;

    return t2;
  }
  const t2 = function handleSelect(value) {
      switch (value) {
        case "try":
          {
            setShowHandoff(true);
            return;
          }
        case "never":
          {
            saveGlobalConfig(_temp2);
            onDone();
            return;
          }
        case "not-now":
          {
            onDone();
            return;
          }
      }
    };

  const handleSelect = t2;
  const t3 = {
      label: "Open in Gizzi Code Desktop",
      value: "try" as const
    };

  const t4 = {
      label: "Not now",
      value: "not-now" as const
    };

  const t5 = [t3, t4, {
      label: "Don't ask again",
      value: "never" as const
    }];

  const options = t5;
  const t6 = <Box marginBottom={1}><Text>Same Gizzi Code with visual diffs, live app preview, parallel sessions, and more.</Text></Box>;

  const t7 = () => handleSelect("not-now");

  const t8 = <PermissionDialog title="Try Gizzi Code Desktop"><Box flexDirection="column" paddingX={2} paddingY={1}>{t6}<Select options={options} onChange={handleSelect} onCancel={t7} /></Box></PermissionDialog>;

  return t8;
}
function _temp2(prev_0) {
  if (prev_0.desktopUpsellDismissed) {
    return prev_0;
  }
  return {
    ...prev_0,
    desktopUpsellDismissed: true
  };
}
function _temp() {
  const newCount = (getGlobalConfig().desktopUpsellSeenCount ?? 0) + 1;
  saveGlobalConfig(prev => {
    if ((prev.desktopUpsellSeenCount ?? 0) >= newCount) {
      return prev;
    }
    return {
      ...prev,
      desktopUpsellSeenCount: newCount
    };
  });
  logEvent("tengu_desktop_upsell_shown", {
    seen_count: newCount
  });
}
