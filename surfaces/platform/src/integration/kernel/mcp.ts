import { getKernelBridge } from './index.js';
import { execEvents } from '../execution/exec.events.js';

export async function connectMCP(serverId: string) {
  const bridge = await getKernelBridge();
  
  execEvents.emit('onLog', {
    runId: 'system',
    level: 'INFO',
    message: 'Connecting to MCP server: ' + serverId + '...',
    timestamp: Date.now()
  });

  // Simulate connection delay
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
  const bridge = await getKernelBridge();
  
  execEvents.emit('onLog', {
    runId: 'system',
    level: 'WARN',
    message: 'Disconnecting from MCP server: ' + serverId,
    timestamp: Date.now()
  });

  return { success: true };
}
