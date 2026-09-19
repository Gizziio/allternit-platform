import React from 'react';
import { Box, Text } from '../../ink';
import { Byline } from '../design-system/Byline';
type Props = {
  serverToolsCount: number;
  serverPromptsCount: number;
  serverResourcesCount: number;
};
export function CapabilitiesSection({
    serverToolsCount,
    serverPromptsCount,
    serverResourcesCount
}: Props) {
  const capabilities = [];
  if (serverToolsCount > 0) {
      capabilities.push("tools");
    }
  if (serverResourcesCount > 0) {
      capabilities.push("resources");
    }
  if (serverPromptsCount > 0) {
      capabilities.push("prompts");
    }

  const t1 = <Text bold={true}>Capabilities: </Text>;

  const t2 = capabilities.length > 0 ? <Byline>{capabilities}</Byline> : "none";

  const t3 = <Box>{t1}<Text color="text">{t2}</Text></Box>;

  return t3;
}
