import { describe, expect, it } from 'vitest';
import { formatElapsed, workedForLabel } from './working-time';

describe('working-time', () => {
  it('matches OpenMaus compact elapsed strings', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(4_000)).toBe('4s');
    expect(formatElapsed(65_000)).toBe('1m 05s');
  });

  it('uses Worked for Ns only after a full second', () => {
    expect(workedForLabel(400)).toBe('Worked');
    expect(workedForLabel(4_000)).toBe('Worked for 4s');
  });
});
