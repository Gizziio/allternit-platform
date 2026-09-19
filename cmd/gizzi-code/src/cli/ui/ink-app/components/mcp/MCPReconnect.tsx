import figures from 'figures';
import React, { useEffect, useState } from 'react';
import type { CommandResultDisplay } from '../../commands';
import { Box, color, Text, useTheme } from '../../ink';
import { useMcpReconnect } from '../../services/mcp/MCPConnectionManager';
import { useAppStateStore } from '../../state/AppState';
import { Spinner } from '../Spinner';
type Props = {
  serverName: string;
  onComplete: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
export function MCPReconnect({
    serverName,
    onComplete
}: Props) {
  const [theme] = useTheme();
  const store = useAppStateStore();
  const reconnectMcpServer = useMcpReconnect();
  const [isReconnecting, setIsReconnecting] = useState(true);
  const [error, setError] = useState(null);
  const t1 = () => {
      const attemptReconnect = async function attemptReconnect() {
        ;
        try {
          const server = store.getState().mcp.clients.find(c => c.name === serverName);
          if (!server) {
            setError(`MCP server "${serverName}" not found`);
            setIsReconnecting(false);
            onComplete(`MCP server "${serverName}" not found`);
            return;
          }
          const result = await reconnectMcpServer(serverName);
          bb43: switch (result.client.type) {
            case "connected":
              {
                setIsReconnecting(false);
                onComplete(`Successfully reconnected to ${serverName}`);
                break bb43;
              }
            case "needs-auth":
              {
                setError(`${serverName} requires authentication`);
                setIsReconnecting(false);
                onComplete(`${serverName} requires authentication. Use /mcp to authenticate.`);
                break bb43;
              }
            case "pending":
            case "failed":
            case "disabled":
              {
                setError(`Failed to reconnect to ${serverName}`);
                setIsReconnecting(false);
                onComplete(`Failed to reconnect to ${serverName}`);
              }
          }
        } catch (t3) {
          const err = t3;
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage);
          setIsReconnecting(false);
          onComplete(`Error: ${errorMessage}`);
        }
      };
      attemptReconnect();
    };
  const t2 = [serverName, reconnectMcpServer, store, onComplete];

  useEffect(t1, t2);
  if (isReconnecting) {
    const t3 = <Text color="text">Reconnecting to <Text bold={true}>{serverName}</Text></Text>;

    const t4 = <Box><Spinner /><Text> Establishing connection to MCP server</Text></Box>;

    const t5 = <Box flexDirection="column" gap={1} padding={1}>{t3}{t4}</Box>;

    return t5;
  }
  if (error) {
    const t3 = color("error", theme)(figures.cross);

    const t4 = <Text>{t3} </Text>;

    const t5 = <Text color="error">Failed to reconnect to {serverName}</Text>;

    const t6 = <Box>{t4}{t5}</Box>;

    const t7 = <Text dimColor={true}>Error: {error}</Text>;

    const t8 = <Box flexDirection="column" gap={1} padding={1}>{t6}{t7}</Box>;

    return t8;
  }
  return null;
}
