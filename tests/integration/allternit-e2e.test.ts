import { describe, it, expect } from 'vitest';
import { AllternitRuntimeBridge } from '@allternit/runtime';
import path from 'path';

describe('Allternit End-to-End Integration', () => {
  it('should execute a shell command via the internalized engine', async () => {
    const bridge = new AllternitRuntimeBridge({
      rootDir: process.cwd(),
      storageDir: path.join(process.cwd(), '.allternit/test-receipts'),
      enforceWih: false
    });

    const result = await bridge.executeTool(
      { tool: 'shell', arguments: { command: 'echo "Hello Allternit"' }, context: {} },
      'test-agent'
    );

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('Hello Allternit');
  });
});
