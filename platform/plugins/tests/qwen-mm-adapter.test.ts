import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { QwenMMPluginAdapter } from '../src/adapters/qwen-mm.js';
import {
  validateCapabilityManifest,
  validateMarketplaceManifest,
  QwenMMValidationError,
} from '../src/adapters/qwen-mm.schema.js';
import { PluginRegistry } from '../src/registry.js';
import type { PluginContext } from '../src/plugin.js';

const FIXTURE_PATH = path.resolve(
  import.meta.dirname,
  'fixtures',
  'qwen-mm-capability.json',
);

describe('QwenMMPluginAdapter', () => {
  describe('manifest loading', () => {
    it('loads and validates a valid capability manifest', async () => {
      const adapter = await QwenMMPluginAdapter.fromManifestPath(FIXTURE_PATH);
      expect(adapter.id).toBe('qwen-mm-core');
      expect(adapter.name).toBe('Qwen MM: core');
      expect(adapter.version).toBe('1.0.1');
      expect(adapter.getTools()).toHaveLength(2);
      expect(adapter.getTools()[0].name).toBe('read_file');
    });

    it('activates and registers tools in the plugin context', async () => {
      const adapter = await QwenMMPluginAdapter.fromManifestPath(FIXTURE_PATH);
      const registeredTools: any[] = [];
      const logs: string[] = [];

      const context: PluginContext = {
        config: {},
        log: (msg: string) => logs.push(msg),
        warn: () => {},
        error: () => {},
        registerCommand: () => {},
        registerView: () => {},
        registerTool: (tool) => registeredTools.push(tool),
        on: () => {},
        emit: () => {},
      };

      await adapter.activate(context);
      expect(adapter.isActive()).toBe(true);
      expect(registeredTools).toHaveLength(2);
      expect(registeredTools[0].id).toBe('qwen-mm-core:read_file');
      expect(registeredTools[1].id).toBe('qwen-mm-core:crop_image');
      expect(logs.some((l) => l.includes('Registered 2 tool(s)'))).toBe(true);

      await adapter.deactivate();
      expect(adapter.isActive()).toBe(false);
    });

    it('invokes a tool through the context and returns structured result', async () => {
      const adapter = await QwenMMPluginAdapter.fromManifestPath(FIXTURE_PATH);
      const registeredTools: any[] = [];

      const context: PluginContext = {
        config: {},
        log: () => {},
        warn: () => {},
        error: () => {},
        registerCommand: () => {},
        registerView: () => {},
        registerTool: (tool) => registeredTools.push(tool),
        on: () => {},
        emit: () => {},
      };

      await adapter.activate(context);

      const result = await registeredTools[0].execute({ path: '/tmp/test.png', format: 'auto' });
      expect(result).toEqual({
        tool: 'read_file',
        params: { path: '/tmp/test.png', format: 'auto' },
        status: 'invoked',
      });
    });
  });

  describe('manifest validation', () => {
    it('rejects an invalid capability manifest with missing fields', () => {
      expect(() => validateCapabilityManifest({ name: 'core' })).toThrow(QwenMMValidationError);
      expect(() => validateCapabilityManifest({ name: 'core' })).toThrow(/version/);
    });

    it('rejects a capability manifest with non-array tools', () => {
      expect(() =>
        validateCapabilityManifest({
          name: 'core',
          version: '1.0.0',
          description: 'test',
          tools: 'not-an-array',
          server: { command: 'uvx', args: [] },
        }),
      ).toThrow(QwenMMValidationError);
    });

    it('rejects a capability manifest with a tool missing required fields', () => {
      expect(() =>
        validateCapabilityManifest({
          name: 'core',
          version: '1.0.0',
          description: 'test',
          tools: [{ name: 'read_file' }],
          server: { command: 'uvx', args: [] },
        }),
      ).toThrow(/description/);
    });

    it('rejects a marketplace manifest with invalid plugin entries', () => {
      expect(() =>
        validateMarketplaceManifest({
          name: 'qwen-mm-plugins',
          owner: { name: 'QwenLM', url: 'https://github.com/QwenLM' },
          metadata: { description: 'test', version: '1.0.0' },
          plugins: [{ name: 'bad-entry' }],
        }),
      ).toThrow(/description/);
    });
  });

  describe('registry integration', () => {
    it('registerQwenMMPlugin loads, registers, and activates the adapter', async () => {
      const registry = new PluginRegistry();
      await registry.registerQwenMMPlugin(FIXTURE_PATH);

      const plugin = registry.get('qwen-mm-core');
      expect(plugin).toBeDefined();
      expect(plugin!.isActive()).toBe(true);

      const tool = registry.getTool('qwen-mm-core:read_file');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('read_file');
    });

    it('fails when manifest path does not exist', async () => {
      const registry = new PluginRegistry();
      await expect(registry.registerQwenMMPlugin('/nonexistent/manifest.json')).rejects.toThrow();
    });
  });

  describe('server command', () => {
    it('exposes the MCP server command with merged env', async () => {
      const adapter = await QwenMMPluginAdapter.fromManifestPath(FIXTURE_PATH);
      const server = adapter.getServerCommand();
      expect(server.command).toBe('uvx');
      expect(server.args).toEqual(['qwen-mm-plugins-core']);
      expect(server.env.DASHSCOPE_BASE_URL).toBe('https://dashscope.aliyuncs.com');
    });
  });
});
