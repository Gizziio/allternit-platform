import { getKernelBridge } from './index.js';
import { execEvents } from '../execution/exec.events.js';
export async function startRun(wihId: string, payload: any) {
  const bridge = await getKernelBridge();
  execEvents.emit('onRunStart', { runId: wihId });
  // actual implementation would trigger bridge.wrapGatewayClient or similar
}
