import { feature } from 'bun:bundle';
import * as React from 'react';
import type { AutoUpdaterResult } from '../utils/autoUpdater';
import { isAutoUpdaterDisabled } from '../utils/config';
import { logForDebugging } from '../utils/debug';
import { getCurrentInstallationType } from '../utils/doctorDiagnostic';
import { AutoUpdater } from './AutoUpdater';
import { NativeAutoUpdater } from './NativeAutoUpdater';
import { PackageManagerAutoUpdater } from './PackageManagerAutoUpdater';
type Props = {
  isUpdating: boolean;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  onAutoUpdaterResult: (autoUpdaterResult: AutoUpdaterResult) => void;
  autoUpdaterResult: AutoUpdaterResult | null;
  showSuccessMessage: boolean;
  verbose: boolean;
};
export function AutoUpdaterWrapper({
    isUpdating,
    onChangeIsUpdating,
    onAutoUpdaterResult,
    autoUpdaterResult,
    showSuccessMessage,
    verbose
}: Props) {
  const [useNativeInstaller, setUseNativeInstaller] = React.useState(null);
  const [isPackageManager, setIsPackageManager] = React.useState(null);
  const t1 = () => {
      const checkInstallation = async function checkInstallation() {
        if (feature("SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED") && isAutoUpdaterDisabled()) {
          logForDebugging("AutoUpdaterWrapper: Skipping detection, auto-updates disabled");
          return;
        }
        const installationType = await getCurrentInstallationType();
        logForDebugging(`AutoUpdaterWrapper: Installation type: ${installationType}`);
        setUseNativeInstaller(installationType === "native");
        setIsPackageManager(installationType === "package-manager");
      };
      checkInstallation();
    };
  const t2 = [];

  React.useEffect(t1, t2);
  if (useNativeInstaller === null || isPackageManager === null) {
    return null;
  }
  if (isPackageManager) {
    const t3 = <PackageManagerAutoUpdater verbose={verbose} onAutoUpdaterResult={onAutoUpdaterResult} autoUpdaterResult={autoUpdaterResult} isUpdating={isUpdating} onChangeIsUpdating={onChangeIsUpdating} showSuccessMessage={showSuccessMessage} />;

    return t3;
  }
  const Updater = useNativeInstaller ? NativeAutoUpdater : AutoUpdater;
  const t3 = <Updater verbose={verbose} onAutoUpdaterResult={onAutoUpdaterResult} autoUpdaterResult={autoUpdaterResult} isUpdating={isUpdating} onChangeIsUpdating={onChangeIsUpdating} showSuccessMessage={showSuccessMessage} />;

  return t3;
}
