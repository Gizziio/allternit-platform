import * as React from 'react';
import { useEffect } from 'react';
import { useNotifications } from '../../../../../context/notifications';
import { getIsRemoteMode } from '../../bootstrap/state';
import { Text } from '../../ink';
import { hasClaudeAiMcpEverConnected } from '../../services/mcp/claudeai';
import type { MCPServerConnection } from '../../services/mcp/types';
type Props = {
  mcpClients?: MCPServerConnection[];
};
const EMPTY_MCP_CLIENTS: MCPServerConnection[] = [];
export function useMcpConnectivityStatus({
    mcpClients: t1
}: Props) {
  const mcpClients = t1 === undefined ? EMPTY_MCP_CLIENTS : t1;
  const {
    addNotification
  } = useNotifications();
  const t2 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      const failedLocalClients = mcpClients.filter(_temp);
      const failedClaudeAiClients = mcpClients.filter(_temp2);
      const needsAuthLocalServers = mcpClients.filter(_temp3);
      const needsAuthClaudeAiServers = mcpClients.filter(_temp4);
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
          jsx: <><Text color="error">{failedClaudeAiClients.length} hosted{" "}{failedClaudeAiClients.length === 1 ? "connector" : "connectors"}{" "}unavailable</Text><Text dimColor={true}> · /mcp</Text></>,
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
          jsx: <><Text color="warning">{needsAuthClaudeAiServers.length} hosted{" "}{needsAuthClaudeAiServers.length === 1 ? "connector needs" : "connectors need"}{" "}auth</Text><Text dimColor={true}> · /mcp</Text></>,
          priority: "medium"
        });
      }
    };
  const t3 = [addNotification, mcpClients];

  useEffect(t2, t3);
}
function _temp4(client_2) {
  return client_2.type === "needs-auth" && client_2.config.type === "claudeai-proxy" && hasClaudeAiMcpEverConnected(client_2.name);
}
function _temp3(client_1) {
  return client_1.type === "needs-auth" && client_1.config.type !== "claudeai-proxy";
}
function _temp2(client_0) {
  return client_0.type === "failed" && client_0.config.type === "claudeai-proxy" && hasClaudeAiMcpEverConnected(client_0.name);
}
function _temp(client) {
  return client.type === "failed" && client.config.type !== "sse-ide" && client.config.type !== "ws-ide" && client.config.type !== "claudeai-proxy";
}
