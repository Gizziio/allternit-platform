import { basename } from 'path';
import * as React from 'react';
import { useIdeConnectionStatus } from '../hooks/useIdeConnectionStatus';
import type { IDESelection } from '../hooks/useIdeSelection';
import { Text } from '../ink';
import type { MCPServerConnection } from '../services/mcp/types';
type IdeStatusIndicatorProps = {
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
};
export function IdeStatusIndicator({
    ideSelection,
    mcpClients
}: IdeStatusIndicatorProps) {
  const {
    status: ideStatus
  } = useIdeConnectionStatus(mcpClients);
  const shouldShowIdeSelection = ideStatus === "connected" && (ideSelection?.filePath || ideSelection?.text && ideSelection.lineCount > 0);
  if (ideStatus === null || !shouldShowIdeSelection || !ideSelection) {
    return null;
  }
  if (ideSelection.text && ideSelection.lineCount > 0) {
    const t1 = ideSelection.lineCount === 1 ? "line" : "lines";
    const t2 = <Text color="ide" key="selection-indicator" wrap="truncate">⧉ {ideSelection.lineCount}{" "}{t1} selected</Text>;

    return t2;
  }
  if (ideSelection.filePath) {
    const t1 = basename(ideSelection.filePath);

    const t2 = <Text color="ide" key="selection-indicator" wrap="truncate">⧉ In {t1}</Text>;

    return t2;
  }
}
