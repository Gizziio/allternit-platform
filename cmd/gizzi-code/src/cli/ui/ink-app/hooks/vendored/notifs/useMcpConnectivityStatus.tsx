import * as React from 'react';
import { useEffect } from 'react';
import { useNotifications } from 'src/context/notifications';
import { getIsRemoteMode } from '../../bootstrap/state';
import { Text } from '../../ink';
import { hasClaudeAiMcpEverConnected } from '../../services/mcp/claudeai';
import type { MCPServerConnection } from '../../services/mcp/types';

type Props = {
  mcpClients?: MCPServerConnection[];
};

const EMPTY_MCP_CLIENTS: MCPServerConnection[] = [];

export function useMcpConnectivityStatus({
  mcpClients = EMPTY_MCP_CLIENTS,
}: Props): void {
  const { addNotification } = useNotifications();
  const { removeNotification } = useNotifications();

  useEffect(() => {
    if (getIsRemoteMode()) {
      return;
    }
    const failedLocalClients = mcpClients.filter(
      client =>
        client.type === 'failed' &&
        client.config.type !== 'sse-ide' &&
        client.config.type !== 'ws-ide' &&
        client.config.type !== 'claudeai-proxy'
    );
    const failedClaudeAiClients = mcpClients.filter(
      client =>
        client.type === 'failed' &&
        client.config.type === 'claudeai-proxy' &&
        hasClaudeAiMcpEverConnected(client.name)
    );
    const needsAuthLocalServers = mcpClients.filter(
      client =>
        client.type === 'needs-auth' &&
        client.config.type !== 'claudeai-proxy'
    );
    const needsAuthClaudeAiServers = mcpClients.filter(
      client =>
        client.type === 'needs-auth' &&
        client.config.type === 'claudeai-proxy' &&
        hasClaudeAiMcpEverConnected(client.name)
    );
    if (failedLocalClients.length === 0 && failedClaudeAiClients.length === 0 && needsAuthLocalServers.length === 0 && needsAuthClaudeAiServers.length === 0) {
      return;
    }
    if (failedLocalClients.length > 0) {
      addNotification({
        key: "mcp-failed",
        jsx: <><Text color="error">{failedLocalClients.length} MCP{" "}{failedLocalClients.length === 1 ? "server" : "servers"} failed</Text><Text dimColor={true}> · /mcp</Text></>,
        priority: "medium"
      });
    }
    if (failedClaudeAiClients.length > 0) {
      addNotification({
        key: "mcp-claudeai-failed",
        jsx: <><Text color="error">{failedClaudeAiClients.length} claude.ai{" "}{failedClaudeAiClients.length === 1 ? "connector" : "connectors"}{" "}unavailable</Text><Text dimColor={true}> · /mcp</Text></>,
        priority: "medium"
      });
    }
    if (needsAuthLocalServers.length > 0) {
      addNotification({
        key: "mcp-needs-auth",
        jsx: <><Text color="warning">{needsAuthLocalServers.length} MCP{" "}{needsAuthLocalServers.length === 1 ? "server needs" : "servers need"}{" "}auth</Text><Text dimColor={true}> · /mcp</Text></>,
        priority: "medium"
      });
    }
    if (needsAuthClaudeAiServers.length > 0) {
      addNotification({
        key: "mcp-claudeai-needs-auth",
        jsx: <><Text color="warning">{needsAuthClaudeAiServers.length} claude.ai{" "}{needsAuthClaudeAiServers.length === 1 ? "connector needs" : "connectors need"}{" "}auth</Text><Text dimColor={true}> · /mcp</Text></>,
        priority: "medium"
      });
    }
  }, [addNotification, mcpClients, removeNotification]);
}
