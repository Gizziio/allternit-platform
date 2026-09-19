import React, { useEffect, useRef } from 'react';
import { MCPSettings } from '../../components/mcp/index';
import { MCPReconnect } from '../../components/mcp/MCPReconnect';
import { useMcpToggleEnabled } from '../../services/mcp/MCPConnectionManager';
import { useAppState } from '../../state/AppState';
import type { LocalJSXCommandOnDone } from '../../types/command';
import { PluginSettings } from '../plugin/PluginSettings';

// TODO: This is a hack to get the context value from toggleMcpServer (useContext only works in a component)
// Ideally, all MCP state and functions would be in global state.
function MCPToggle(t0) {
  const {
    action,
    target,
    onComplete
  } = t0;
  const mcpClients = useAppState(_temp);
  const toggleMcpServer = useMcpToggleEnabled();
  const didRun = useRef(false);
  const t1 = () => {
      if (didRun.current) {
        return;
      }
      didRun.current = true;
      const isEnabling = action === "enable";
      const clients = mcpClients.filter(_temp2);
      const toToggle = target === "all" ? clients.filter(c_0 => isEnabling ? c_0.type === "disabled" : c_0.type !== "disabled") : clients.filter(c_1 => c_1.name === target);
      if (toToggle.length === 0) {
        onComplete(target === "all" ? `All MCP servers are already ${isEnabling ? "enabled" : "disabled"}` : `MCP server "${target}" not found`);
        return;
      }
      for (const s_0 of toToggle) {
        toggleMcpServer(s_0.name);
      }
      onComplete(target === "all" ? `${isEnabling ? "Enabled" : "Disabled"} ${toToggle.length} MCP server(s)` : `MCP server "${target}" ${isEnabling ? "enabled" : "disabled"}`);
    };
  const t2 = [action, target, mcpClients, toggleMcpServer, onComplete];

  useEffect(t1, t2);
  return null;
}
function _temp2(c) {
  return c.name !== "ide";
}
function _temp(s) {
  return s.mcp.clients;
}
export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  if (args) {
    const parts = args.trim().split(/\s+/);

    // Allow /mcp no-redirect to bypass the redirect for testing
    if (parts[0] === 'no-redirect') {
      return <MCPSettings onComplete={onDone} />;
    }
    if (parts[0] === 'reconnect' && parts[1]) {
      return <MCPReconnect serverName={parts.slice(1).join(' ')} onComplete={onDone} />;
    }
    if (parts[0] === 'enable' || parts[0] === 'disable') {
      return <MCPToggle action={parts[0]} target={parts.length > 1 ? parts.slice(1).join(' ') : 'all'} onComplete={onDone} />;
    }
  }

  // Redirect base /mcp command to /plugins installed tab for ant users
  if (("external" as string) === 'ant') {
    return <PluginSettings onComplete={onDone} args="manage" showMcpRedirectMessage />;
  }
  return <MCPSettings onComplete={onDone} />;
}
