import { describe, it, expect } from 'vitest';
import {
  BOT_CATEGORY_DEFAULT_TOOLS,
  BOT_NATIVE_TOOLS,
  toggleBotTool,
} from './bot-tool-registry';
import {
  BOT_DESKTOP_PRESETS,
  describeDesktopResources,
  presetIdForResources,
} from './vm-operator';
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

describe('bot desktop presets', () => {
  it('medium preset matches the atomic-create defaults (2 vCPU / 4 GB / 100 GB)', () => {
    const medium = BOT_DESKTOP_PRESETS.find((p) => p.id === 'medium');
    expect(medium?.resources).toEqual({ cpu: '2', memory: '4096', disk: '102400' });
  });

  it('describes resources in GB', () => {
    expect(describeDesktopResources({ cpu: '4', memory: '8192', disk: '204800' })).toBe(
      '4 vCPU · 8 GB RAM · 200 GB disk',
    );
    expect(describeDesktopResources(undefined)).toBe('2 vCPU · 4 GB RAM · 100 GB disk');
  });

  it('resolves preset id from resources, defaulting to medium', () => {
    expect(presetIdForResources({ cpu: '1', memory: '2048', disk: '51200' })).toBe('small');
    expect(presetIdForResources({ cpu: '4', memory: '8192', disk: '204800' })).toBe('large');
    expect(presetIdForResources(undefined)).toBe('medium');
    expect(presetIdForResources({ cpu: '8', memory: '16384', disk: '409600' })).toBe('medium');
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
