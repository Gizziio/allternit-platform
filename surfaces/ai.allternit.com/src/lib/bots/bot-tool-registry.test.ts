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
  it('small preset matches the atomic-create defaults (2 vCPU / 4 GB / 20 GB)', () => {
    const small = BOT_DESKTOP_PRESETS.find((p) => p.id === 'small');
    expect(small?.resources).toEqual({ cpu: '2', memory: '4096', disk: '20480' });
  });

  it('every preset is inside the backend allow-lists', () => {
    const VALID_CPU = ['2', '4', '8'];
    const VALID_MEMORY = ['4096', '8192', '16384', '32768', '65536'];
    const VALID_DISK = ['20480', '40960', '81920'];
    for (const preset of BOT_DESKTOP_PRESETS) {
      expect(VALID_CPU, `${preset.id} cpu`).toContain(preset.resources.cpu);
      expect(VALID_MEMORY, `${preset.id} memory`).toContain(preset.resources.memory);
      expect(VALID_DISK, `${preset.id} disk`).toContain(preset.resources.disk);
    }
  });

  it('describes resources in GB', () => {
    expect(describeDesktopResources({ cpu: '8', memory: '16384', disk: '81920' })).toBe(
      '8 vCPU · 16 GB RAM · 80 GB disk',
    );
    expect(describeDesktopResources(undefined)).toBe('2 vCPU · 4 GB RAM · 20 GB disk');
  });

  it('resolves preset id from resources, defaulting to small', () => {
    expect(presetIdForResources({ cpu: '2', memory: '4096', disk: '20480' })).toBe('small');
    expect(presetIdForResources({ cpu: '4', memory: '8192', disk: '40960' })).toBe('medium');
    expect(presetIdForResources({ cpu: '8', memory: '16384', disk: '81920' })).toBe('large');
    expect(presetIdForResources(undefined)).toBe('small');
    expect(presetIdForResources({ cpu: '8', memory: '16384', disk: '409600' })).toBe('small');
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
