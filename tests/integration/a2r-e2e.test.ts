import { describe, it, expect } from 'vitest';
import { A2RRuntimeBridge } from '@a2r/runtime';
import path from 'path';

describe('A2R End-to-End Integration', () => {
  it('should execute a shell command via the internalized engine', async () => {
    const bridge = new A2RRuntimeBridge({
      rootDir: process.cwd(),
      storageDir: path.join(process.cwd(), '.a2r/test-receipts'),
      enforceWih: false
    });

    const result = await bridge.executeTool(
      { tool: 'shell', arguments: { command: 'echo "Hello A2R"' }, context: {} },
      'test-agent'
    );

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('Hello A2R');
  });
});
