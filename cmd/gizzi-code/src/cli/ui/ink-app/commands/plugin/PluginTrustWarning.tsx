import figures from 'figures';
import * as React from 'react';
import { Box, Text } from '../../ink';
import { getPluginTrustMessage } from '../../utils/plugins/marketplaceHelpers';
export function PluginTrustWarning() {
  const t0 = getPluginTrustMessage();

  const customMessage = t0;
  const t1 = <Text color="gizzi">{figures.warning} </Text>;

  const t2 = <Box marginBottom={1}>{t1}<Text dimColor={true} italic={true}>Make sure you trust a plugin before installing, updating, or using it. Allternit does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change. See each plugin's homepage for more information.{customMessage ? ` ${customMessage}` : ""}</Text></Box>;

  return t2;
}
