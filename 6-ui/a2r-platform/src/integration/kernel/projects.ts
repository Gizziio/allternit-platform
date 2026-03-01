import { getKernelBridge } from './index.js';

export async function createProject(title: string) {
  const bridge = await getKernelBridge();
  return bridge.kernel.createWih({
    title,
    status: 'draft',
    priority: 50,
    blockedBy: [],
    blocks: [],
    tags: ['project'],
    receiptRefs: [],
    artifacts: []
  });
}
