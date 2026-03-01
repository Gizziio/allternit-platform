import { getKernelBridge } from './index.js';
export async function checkFileAccess(path: string, operation: string) {
  const bridge = await getKernelBridge();
  return bridge.kernel.routeFileAccess({ path, operation } as any);
}
