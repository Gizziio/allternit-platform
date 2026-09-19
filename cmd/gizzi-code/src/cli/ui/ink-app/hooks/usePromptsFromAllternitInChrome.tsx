import type { ContentBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/messages.mjs';
import { useEffect, useRef } from 'react';
import { logError } from './../utils/log.ts';
import { z } from 'zod/v4';
import { callIdeRpc } from '../services/mcp/client';
import type { ConnectedMCPServer, MCPServerConnection } from '../services/mcp/types';
import type { PermissionMode } from '../types/permissions';
import { ALLTERNIT_IN_CHROME_MCP_SERVER_NAME, isTrackedAllternitInChromeTabId } from '../../../../shared/utils/allternitInChrome/common';
import { lazySchema } from '../utils/lazySchema';
import { enqueuePendingNotification } from '../utils/messageQueueManager';

// Schema for the prompt notification from Chrome extension (JSON-RPC 2.0 format)
const AllternitInChromePromptNotificationSchema = lazySchema(() => z.object({
  method: z.literal('notifications/message'),
  params: z.object({
    prompt: z.string(),
    image: z.object({
      type: z.literal('base64'),
      media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
      data: z.string()
    }).optional(),
    tabId: z.number().optional()
  })
}));

/**
 * A hook that listens for prompt notifications from the Claude for Chrome extension,
 * enqueues them as user prompts, and syncs permission mode changes to the extension.
 */
export function usePromptsFromAllternitInChrome(mcpClients, toolPermissionMode) {
  useRef(undefined);
  const t0 = [mcpClients];

  useEffect(_temp, t0);
  const t1 = () => {
      const chromeClient = findChromeClient(mcpClients);
      if (!chromeClient) {
        return;
      }
      const chromeMode = toolPermissionMode === "bypassPermissions" ? "skip_all_permission_checks" : "ask";
      callIdeRpc("set_permission_mode", {
        mode: chromeMode
      }, chromeClient);
    };
  const t2 = [mcpClients, toolPermissionMode];

  useEffect(t1, t2);
}
function _temp() {}
function findChromeClient(clients: MCPServerConnection[]): ConnectedMCPServer | undefined {
  return clients.find((client): client is ConnectedMCPServer => client.type === 'connected' && client.name === ALLTERNIT_IN_CHROME_MCP_SERVER_NAME);
}
