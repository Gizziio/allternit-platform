import { describe, expect, it } from 'vitest';
import { ComputerUseCapability } from '../capabilities/computer-use.js';

describe('ComputerUseCapability screenshot response parsing', () => {
  it('reads the screenshot from artifacts[] (content as data URL)', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        run_id: 'r1',
        status: 'completed',
        artifacts: [
          { type: 'json', content: '{"ignored":true}' },
          { type: 'screenshot', mime: 'image/png', url: 'data:image/png;base64,cG5n' },
        ],
      }),
    });

    const result = await capability.getTool().execute!({ action: 'screenshot' }, {});
    expect(result).toEqual([{
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'cG5n' },
    }]);
  });

  it('reads the screenshot from artifacts[] (raw content, artifact mime wins)', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        artifacts: [
          { type: 'screenshot', mime: 'image/jpeg', content: 'anBtZw==' },
        ],
      }),
    });

    const result = await capability.getTool().execute!({ action: 'screenshot' }, {});
    expect(result).toEqual([{
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'anBtZw==' },
    }]);
  });

  it('prefers artifacts[] over the legacy top-level fields', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        screenshot: 'data:image/png;base64,bGVnYWN5',
        data: 'legacy',
        artifacts: [
          { type: 'screenshot', mime: 'image/png', content: 'Z2F0ZXdheQ==' },
        ],
      }),
    });

    const result = await capability.getTool().execute!({ action: 'screenshot' }, {});
    expect(result).toEqual([{
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'Z2F0ZXdheQ==' },
    }]);
  });

  it('falls back to the legacy screenshot/data fields when artifacts[] has no screenshot', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        artifacts: [{ type: 'text', content: 'log' }],
        screenshot: 'data:image/png;base64,bGVnYWN5',
      }),
    });

    const result = await capability.getTool().execute!({ action: 'screenshot' }, {});
    expect(result).toEqual([{
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'bGVnYWN5' },
    }]);
  });

  it('returns an error string when the gateway provides no screenshot anywhere', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({ status: 'completed', summary: 'done' }),
    });

    const result = await capability.getTool().execute!({ action: 'screenshot' }, {});
    expect(result).toBe('Error executing computer action: Computer Use gateway returned no screenshot data');
  });

  it('leaves non-screenshot actions on the summary path unchanged', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        status: 'completed',
        summary: 'Moved mouse to (10, 20)',
        artifacts: [{ type: 'screenshot', content: 'ignored' }],
      }),
    });

    const result = await capability.getTool().execute!({ action: 'mouse_move', coordinate: [10, 20] }, {});
    expect(result).toBe('Moved mouse to (10, 20)');
  });
});

describe('ComputerUseCapability error surfacing (never fakes success)', () => {
  it('surfaces an in-band gateway failure (HTTP 200, status failed, error object)', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({
        status: 'failed',
        summary: 'Reached step limit',
        error: { code: 'ADAPTER_FAILURE', message: 'All adapters failed' },
      }),
    });

    const result = await capability.getTool().execute!({ action: 'left_click', coordinate: [10, 20] }, {});
    expect(result).toBe(
      'Error executing computer action (ADAPTER_FAILURE): All adapters failed. Partial state: Reached step limit',
    );
  });

  it('does not emit the canned completion line when a completed run lacks a summary', async () => {
    // Completed run, no summary: the fallback completion line is honest only
    // because status === 'completed' was confirmed above it.
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({ status: 'completed', summary: null }),
    });

    const result = await capability.getTool().execute!({ action: 'key', text: 'Tab' }, {});
    expect(result).toBe('Action key completed.');
  });

  it('surfaces a non-completed, non-failed run status instead of claiming success', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({ status: 'pending', summary: null }),
    });

    const result = await capability.getTool().execute!({ action: 'type', text: 'hi' }, {});
    expect(result).toBe(
      "Error executing computer action: gateway run ended with status 'pending'.",
    );
  });

  it('surfaces a plain-string gateway error', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({ status: 'failed', error: 'engine exploded' }),
    });

    const result = await capability.getTool().execute!({ action: 'scroll', coordinate: [1, 1] }, {});
    expect(result).toBe('Error executing computer action: engine exploded.');
  });

  it('includes HTTP status and body detail when the gateway request itself fails', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => new Response('{"detail":"auth required"}', { status: 401, statusText: 'Unauthorized' }),
    });

    const result = await capability.getTool().execute!({ action: 'left_click', coordinate: [1, 1] }, {});
    expect(result).toContain('Error executing computer action:');
    expect(result).toContain('401');
    expect(result).toContain('auth required');
  });

  it('surfaces fetch-level (network) failures as errors', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => { throw new TypeError('fetch failed'); },
    });

    const result = await capability.getTool().execute!({ action: 'left_click', coordinate: [1, 1] }, {});
    expect(result).toBe('Error executing computer action: fetch failed');
  });
});
