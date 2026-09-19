import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { getIsRemoteMode } from '../../bootstrap/state';
import { useNotifications } from '../../../../../context/notifications';
import { Text } from '../../ink';
import { useAppState } from '../../state/AppState';
import { logForDebugging } from '../../utils/debug';
import { plural } from '../../utils/stringUtils';
export function usePluginInstallationStatus() {
  const {
    addNotification
  } = useNotifications();
  const installationStatus = useAppState(_temp);
  let t0;
  bb0: {
    if (!installationStatus) {
      const t1 = {
          totalFailed: 0,
          failedMarketplacesCount: 0,
          failedPluginsCount: 0
        };

      t0 = t1;
      break bb0;
    }
    const t1 = installationStatus.marketplaces.filter(_temp2);

    const failedMarketplaces = t1;
    const t2 = installationStatus.plugins.filter(_temp3);

    const failedPlugins = t2;
    const t3 = failedMarketplaces.length + failedPlugins.length;
    const t4 = {
        totalFailed: t3,
        failedMarketplacesCount: failedMarketplaces.length,
        failedPluginsCount: failedPlugins.length
      };

    t0 = t4;
  }
  const {
    totalFailed,
    failedMarketplacesCount,
    failedPluginsCount
  } = t0;
  const t1 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (!installationStatus) {
        logForDebugging("No installation status to monitor");
        return;
      }
      if (totalFailed === 0) {
        return;
      }
      logForDebugging(`Plugin installation status: ${failedMarketplacesCount} failed marketplaces, ${failedPluginsCount} failed plugins`);
      if (totalFailed === 0) {
        return;
      }
      logForDebugging(`Adding notification for ${totalFailed} failed installations`);
      addNotification({
        key: "plugin-install-failed",
        jsx: <><Text color="error">{totalFailed} {plural(totalFailed, "plugin")} failed to install</Text><Text dimColor={true}> · /plugin for details</Text></>,
        priority: "medium"
      });
    };

  const t2 = [addNotification, totalFailed, failedMarketplacesCount, failedPluginsCount];

  useEffect(t1, t2);
}
function _temp3(p) {
  return p.status === "failed";
}
function _temp2(m) {
  return m.status === "failed";
}
function _temp(s) {
  return s.plugins.installationStatus;
}
