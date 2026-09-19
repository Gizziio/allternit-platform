import * as React from 'react';
import { useEffect, useState } from 'react';
import { getIsRemoteMode } from '../../bootstrap/state';
import { useNotifications } from '../../../../../context/notifications';
import { Text } from '../../ink';
import { logForDebugging } from '../../utils/debug';
import { onPluginsAutoUpdated } from '../../utils/plugins/pluginAutoupdate';

/**
 * Hook that displays a notification when plugins have been auto-updated.
 * The notification tells the user to run /reload-plugins to apply the updates.
 */
export function usePluginAutoupdateNotification() {
  const {
    addNotification
  } = useNotifications();
  const t0 = [];

  const [updatedPlugins, setUpdatedPlugins] = useState(t0);
  const t1 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      const unsubscribe = onPluginsAutoUpdated(plugins => {
        logForDebugging(`Plugin autoupdate notification: ${plugins.length} plugin(s) updated`);
        setUpdatedPlugins(plugins);
      });
      return unsubscribe;
    };
  const t2 = [];

  useEffect(t1, t2);
  const t3 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      if (updatedPlugins.length === 0) {
        return;
      }
      const pluginNames = updatedPlugins.map(_temp);
      const displayNames = pluginNames.length <= 2 ? pluginNames.join(" and ") : `${pluginNames.length} plugins`;
      addNotification({
        key: "plugin-autoupdate-restart",
        jsx: <><Text color="success">{pluginNames.length === 1 ? "Plugin" : "Plugins"} updated:{" "}{displayNames}</Text><Text dimColor={true}> · Run /reload-plugins to apply</Text></>,
        priority: "low",
        timeoutMs: 10000
      });
      logForDebugging(`Showing plugin autoupdate notification for: ${pluginNames.join(", ")}`);
    };
  const t4 = [updatedPlugins, addNotification];

  useEffect(t3, t4);
}
function _temp(id) {
  const atIndex = id.indexOf("@");
  return atIndex > 0 ? id.substring(0, atIndex) : id;
}
