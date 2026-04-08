import { getKernelBridge } from './index.js';
export async function listJobs() {
  const bridge = await getKernelBridge();
  return bridge.kernel.listWih({ tags: ['job'] });
}
