import React, { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { Command } from '../../commands';
import type { Tool } from '../../Tool';
import type { MCPServerConnection, ScopedMcpServerConfig, ServerResource } from './types';
import { useManageMCPConnections } from './useManageMCPConnections';
interface MCPConnectionContextValue {
  reconnectMcpServer: (serverName: string) => Promise<{
    client: MCPServerConnection;
    tools: Tool[];
    commands: Command[];
    resources?: ServerResource[];
  }>;
  toggleMcpServer: (serverName: string) => Promise<void>;
}
const MCPConnectionContext = createContext<MCPConnectionContextValue | null>(null);
export function useMcpReconnect() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error("useMcpReconnect must be used within MCPConnectionManager");
  }
  return context.reconnectMcpServer;
}
export function useMcpToggleEnabled() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error("useMcpToggleEnabled must be used within MCPConnectionManager");
  }
  return context.toggleMcpServer;
}
interface MCPConnectionManagerProps {
  children: ReactNode;
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig> | undefined;
  isStrictMcpConfig: boolean;
}

// TODO (ollie): We may be able to get rid of this context by putting these function on app state
export function MCPConnectionManager(t0) {
  const {
    children,
    dynamicMcpConfig,
    isStrictMcpConfig
  } = t0;
  const {
    reconnectMcpServer,
    toggleMcpServer
  } = useManageMCPConnections(dynamicMcpConfig, isStrictMcpConfig);
  const t1 = {
      reconnectMcpServer,
      toggleMcpServer
    };

  const value = t1;
  const t2 = <MCPConnectionContext.Provider value={value}>{children}</MCPConnectionContext.Provider>;

  return t2;
}
