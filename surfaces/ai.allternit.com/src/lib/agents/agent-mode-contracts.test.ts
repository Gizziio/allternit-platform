import { describe, expect, it } from 'vitest';
import {
  applyModeContractToPrompt,
  getAgentModeContract,
  stripModeContractPrompt,
} from './agent-mode-contracts';

describe('mode contract prompt binding', () => {
  const research = getAgentModeContract('research')!;
  const docs = getAgentModeContract('docs')!;

  it('replaces a previous mode instead of stacking', () => {
    const first = applyModeContractToPrompt('You are Scout.', research);
    const second = applyModeContractToPrompt(first, docs, 'Brief');

    expect(second).toContain('You are Scout.');
    expect(second).toContain('You are executing Docs mode.');
    expect(second).not.toContain('You are executing Deep Research mode.');
    expect(second).toContain('TEMPLATE: Brief');
  });

  it('strips legacy unwrapped mode blocks', () => {
    const legacy = [
      'You are Scout.',
      research.systemPrompt,
      'MODE: research',
      'REQUIRED ARTIFACT: research-report',
      'REQUIRED CAPABILITIES: web_search, browser, file_write',
    ].join('\n\n');

    expect(stripModeContractPrompt(legacy)).toBe('You are Scout.');
  });
});
