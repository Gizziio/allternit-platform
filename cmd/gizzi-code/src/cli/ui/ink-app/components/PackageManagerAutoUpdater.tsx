import * as React from 'react';
import { useState } from 'react';
import { useInterval } from 'usehooks-ts';
import { Text } from '../ink';
import { type AutoUpdaterResult, getLatestVersionFromGcs, getMaxVersion, shouldSkipVersion } from '../utils/autoUpdater';
import { isAutoUpdaterDisabled } from '../utils/config';
import { logForDebugging } from '../utils/debug';
import { getPackageManager, type PackageManager } from '../utils/nativeInstaller/packageManagers';
import { gt, gte } from '../utils/semver';
import { getInitialSettings } from '../utils/settings/settings';
type Props = {
  isUpdating: boolean;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  onAutoUpdaterResult: (autoUpdaterResult: AutoUpdaterResult) => void;
  autoUpdaterResult: AutoUpdaterResult | null;
  showSuccessMessage: boolean;
  verbose: boolean;
};
export function PackageManagerAutoUpdater({
    verbose
}: Props) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [packageManager, setPackageManager] = useState("unknown");
  const t1 = async () => {
      false || false;
      if (isAutoUpdaterDisabled()) {
        return;
      }
      const [channel, pm] = await Promise.all([Promise.resolve(getInitialSettings()?.autoUpdatesChannel ?? "latest"), getPackageManager()]);
      setPackageManager(pm);
      let latest = await getLatestVersionFromGcs(channel);
      const maxVersion = await getMaxVersion();
      if (maxVersion && latest && gt(latest, maxVersion)) {
        logForDebugging(`PackageManagerAutoUpdater: maxVersion ${maxVersion} is set, capping update from ${latest} to ${maxVersion}`);
        if (gte(MACRO.VERSION, maxVersion)) {
          logForDebugging(`PackageManagerAutoUpdater: current version ${MACRO.VERSION} is already at or above maxVersion ${maxVersion}, skipping update`);
          setUpdateAvailable(false);
          return;
        }
        latest = maxVersion;
      }
      const hasUpdate = latest && !gte(MACRO.VERSION, latest) && !shouldSkipVersion(latest);
      setUpdateAvailable(!!hasUpdate);
      if (hasUpdate) {
        logForDebugging(`PackageManagerAutoUpdater: Update available ${MACRO.VERSION} -> ${latest}`);
      }
    };

  const checkForUpdates = t1;
  const t2 = () => {
      checkForUpdates();
    };
  const t3 = [checkForUpdates];

  React.useEffect(t2, t3);
  useInterval(checkForUpdates, 1800000);
  if (!updateAvailable) {
    return null;
  }
  const updateCommand = packageManager === "homebrew" ? "brew upgrade gizzi-code" : packageManager === "winget" ? "winget upgrade Allternit.GizziCode" : packageManager === "apk" ? "apk upgrade gizzi-code" : "your package manager update command";
  const t4 = verbose && <Text dimColor={true} wrap="truncate">currentVersion: {MACRO.VERSION}</Text>;

  const t5 = <Text color="warning" wrap="truncate">Update available! Run: <Text bold={true}>{updateCommand}</Text></Text>;

  const t6 = <>{t4}{t5}</>;

  return t6;
}
