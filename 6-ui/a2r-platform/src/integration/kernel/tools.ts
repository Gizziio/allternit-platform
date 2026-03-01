import { getKernelBridge } from './index.js';
export async function listTools() {
  const bridge = await getKernelBridge();
  return (bridge as any).plugins.getAllTools();
}
