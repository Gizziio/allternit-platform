import { describe, it, expect } from 'vitest';
import {
  BOT_CATEGORY_DEFAULT_TOOLS,
  BOT_NATIVE_TOOLS,
  toggleBotTool,
} from './bot-tool-registry';
import { mapBotComputerStatus, BOT_COMPUTER_STATUS_LABEL } from './useBotComputer';

describe('bot-tool-registry', () => {
  it('offers real native tool ids with no duplicates', () => {
    const ids = BOT_NATIVE_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('web_search');
    expect(ids).toContain('computer');
    for (const tool of BOT_NATIVE_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('category defaults only reference real registry tools', () => {
    const registry = new Set(BOT_NATIVE_TOOLS.map((t) => t.id));
    for (const [category, tools] of Object.entries(BOT_CATEGORY_DEFAULT_TOOLS)) {
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(registry.has(tool), `${category} -> ${tool}`).toBe(true);
      }
    }
  });

  it('toggles tools on and off immutably', () => {
    expect(toggleBotTool([], 'web_search')).toEqual(['web_search']);
    expect(toggleBotTool(['web_search', 'memory'], 'web_search')).toEqual(['memory']);
    expect(toggleBotTool(['memory'], 'computer')).toEqual(['memory', 'computer']);
  });
});

describe('mapBotComputerStatus', () => {
  it('maps computer statuses to rail labels', () => {
    expect(mapBotComputerStatus('creating')).toBe('provisioning');
    expect(mapBotComputerStatus('running')).toBe('running');
    expect(mapBotComputerStatus('stopped')).toBe('stopped');
    expect(mapBotComputerStatus('error')).toBe('error');
  });

  it('treats a missing record as provisioning (Create Bot provisions on submit)', () => {
    expect(mapBotComputerStatus(undefined)).toBe('provisioning');
  });

  it('has a label for every status', () => {
    for (const status of ['provisioning', 'running', 'stopped', 'error', 'none'] as const) {
      expect(BOT_COMPUTER_STATUS_LABEL[status].length).toBeGreaterThan(0);
    }
  });
});
