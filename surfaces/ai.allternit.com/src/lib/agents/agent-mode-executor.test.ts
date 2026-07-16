import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, destroy, createPluginInstance } = vi.hoisted(() => ({
  execute: vi.fn(),
  destroy: vi.fn(),
  createPluginInstance: vi.fn(),
}));

vi.mock('@/lib/plugins', () => ({ createPluginInstance }));
vi.mock('@/lib/ai/providers', () => ({ getDefaultPluginModel: vi.fn() }));

import { executeAgentMode } from './agent-mode-executor';

describe('executeAgentMode', () => {
  beforeEach(() => {
    execute.mockReset();
    destroy.mockReset();
    createPluginInstance.mockReset();
    execute.mockResolvedValue({ success: true, content: 'Code created.', artifacts: [] });
    createPluginInstance.mockResolvedValue({ execute, destroy, cancel: vi.fn() });
  });

  it('routes Code Mode through the code plugin', async () => {
    const onArtifact = vi.fn();

    await executeAgentMode('code', 'Create a component', undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('code');
    expect(execute).toHaveBeenCalledWith({
      prompt: 'Create a component',
      options: { templateTitle: undefined, format: undefined },
    });
    expect(onArtifact).toHaveBeenCalledWith(expect.objectContaining({ kind: 'jsx' }));
  });
});
