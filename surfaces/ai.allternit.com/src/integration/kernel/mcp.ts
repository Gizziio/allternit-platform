import { execEvents } from '../execution/exec.events.js';

export async function connectMCP(serverId: string) {
  execEvents.emit('onLog', {
    runId: 'system',
    level: 'INFO',
    message: 'Connecting to MCP server: ' + serverId + '...',
    timestamp: Date.now()
  });

  await new Promise(resolve => setTimeout(resolve, 800));

  execEvents.emit('onLog', {
    runId: 'system',
    level: 'INFO',
    message: 'Connected to MCP server: ' + serverId,
    timestamp: Date.now()
  });

  return { success: true };
}

export async function disconnectMCP(serverId: string) {
  execEvents.emit('onLog', {
    runId: 'system',
    level: 'WARN',
    message: 'Disconnecting from MCP server: ' + serverId,
    timestamp: Date.now()
  });

  return { success: true };
}
