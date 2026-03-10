import { getKernelBridge } from './index.js';

// Tool interface from kernel
interface Tool {
  id: string;
  name: string;
  description?: string;
}

// Kernel bridge interface for tools (matches RuntimeBridge structure)
interface KernelBridge {
  plugins: {
    getAllTools(): Tool[];
  };
}

export async function listTools(): Promise<Tool[]> {
  const bridge = await getKernelBridge();
  const kernelBridge = bridge as unknown as KernelBridge;
  return kernelBridge.plugins.getAllTools();
}
