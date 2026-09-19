import type { ToolUseBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import { useMemo } from 'react';
import { findToolByName, type Tool, type Tools } from '../../../Tool';
import type { buildMessageLookups } from '../../../utils/messages';
export function useGetToolFromMessages(
  toolUseID: string,
  tools: Tools,
  lookups: ReturnType<typeof buildMessageLookups>
): { tool: Tool; toolUse: ToolUseBlockParam } | null {
  return useMemo(() => {
    const toolUse = lookups.toolUseByToolUseID.get(toolUseID);
    if (!toolUse) {
      return null;
    }
    const tool = findToolByName(tools, toolUse.name);
    if (!tool) {
      return null;
    }
    return {
      tool,
      toolUse
    };
  }, [lookups.toolUseByToolUseID, toolUseID, tools]);
}
