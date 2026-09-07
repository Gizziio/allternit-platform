import { describe, expect, it } from 'vitest';
import { extractAciScreenshot } from './FabricSessionDriveViews';

describe('extractAciScreenshot', () => {
  it('reads type:screenshot data.screenshot', () => {
    expect(
      extractAciScreenshot({ type: 'screenshot', data: { screenshot: 'abc123' } }),
    ).toBe('data:image/png;base64,abc123');
  });

  it('reads nested ACU screenshot_b64 from a trace frame', () => {
    expect(
      extractAciScreenshot({
        type: 'trace',
        data: {
          message: 'screenshot.captured',
          event_type: 'screenshot.captured',
          data: { screenshot_b64: 'iVBORw0KGgo=' },
        },
      }),
    ).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('passes through data URLs', () => {
    expect(
      extractAciScreenshot({
        type: 'screenshot',
        data: { screenshot: 'data:image/png;base64,abc' },
      }),
    ).toBe('data:image/png;base64,abc');
  });

  it('returns null when there is no image', () => {
    expect(extractAciScreenshot({ type: 'trace', data: { message: 'plan.created' } })).toBeNull();
  });
});
