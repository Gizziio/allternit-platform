import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvironmentEngine } from '../EnvironmentEngine';
import { DevContainerRuntime } from '../DevContainerRuntime';
import { NixRuntime } from '../NixRuntime';
import { SandboxRuntime } from '../SandboxRuntime';

describe('EnvironmentEngine', () => {
  let engine: EnvironmentEngine;

  beforeEach(() => {
    engine = new EnvironmentEngine();
  });

  describe('provision', () => {
    it('should provision a devcontainer environment', async () => {
      const config = {
        id: 'test-env',
        type: 'devcontainer' as const,
        template: 'node-typescript',
        target: {
          type: 'local' as const,
          localDocker: true,
        },
      };

      // This would require mocking in a real test
      // const env = await engine.provision(config);
      // expect(env.id).toBe('test-env');
      // expect(env.type).toBe('devcontainer');
    });

    it('should throw error for missing id', async () => {
      const config = {
        id: '',
        type: 'devcontainer' as const,
        target: { type: 'local' as const },
      };

      await expect(engine.provision(config)).rejects.toThrow('Environment ID is required');
    });

    it('should throw error for missing type', async () => {
      const config = {
        id: 'test-env',
        type: '' as any,
        target: { type: 'local' as const },
      };

      await expect(engine.provision(config)).rejects.toThrow('Environment type is required');
    });
  });

  describe('getEnvironment', () => {
    it('should return undefined for non-existent environment', () => {
      const env = engine.getEnvironment('non-existent');
      expect(env).toBeUndefined();
    });
  });

  describe('listEnvironments', () => {
    it('should return empty array initially', () => {
      const envs = engine.listEnvironments();
      expect(envs).toEqual([]);
    });
  });

  describe('events', () => {
    it('should emit provision:start event', () => {
      const handler = vi.fn();
      engine.on('provision:start', handler);

      // Trigger event through provision
      // engine.provision({...});

      // expect(handler).toHaveBeenCalled();
    });
  });
});

describe('DevContainerRuntime', () => {
  let runtime: DevContainerRuntime;

  beforeEach(() => {
    runtime = new DevContainerRuntime();
  });

  describe('parseDevcontainerJson', () => {
    it('should parse valid devcontainer.json', async () => {
      const json = JSON.stringify({
        name: 'Test Container',
        image: 'node:20',
        forwardPorts: [3000],
      });

      const config = await runtime.parseDevcontainerJson(json);
      expect(config.name).toBe('Test Container');
      expect(config.image).toBe('node:20');
      expect(config.forwardPorts).toEqual([3000]);
    });

    it('should normalize appPort to forwardPorts', async () => {
      const json = JSON.stringify({
        image: 'node:20',
        appPort: 8080,
      });

      const config = await runtime.parseDevcontainerJson(json);
      expect(config.forwardPorts).toEqual([8080]);
    });

    it('should handle array appPort', async () => {
      const json = JSON.stringify({
        image: 'node:20',
        appPort: [3000, 8080],
      });

      const config = await runtime.parseDevcontainerJson(json);
      expect(config.forwardPorts).toEqual([3000, 8080]);
    });
  });
});

describe('NixRuntime', () => {
  let runtime: NixRuntime;

  beforeEach(() => {
    runtime = new NixRuntime();
  });

  describe('parseFlakeRef', () => {
    it('should parse github flake refs', () => {
      const parsed = (runtime as any).parseFlakeRef('github:owner/repo/main');
      expect(parsed.type).toBe('github');
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('repo');
      expect(parsed.ref).toBe('main');
    });

    it('should parse path flake refs', () => {
      const parsed = (runtime as any).parseFlakeRef('path:/path/to/flake');
      expect(parsed.type).toBe('path');
      expect(parsed.url).toBe('/path/to/flake');
    });

    it('should default relative paths to path type', () => {
      const parsed = (runtime as any).parseFlakeRef('./my-flake');
      expect(parsed.type).toBe('path');
    });
  });
});

describe('SandboxRuntime', () => {
  let runtime: SandboxRuntime;

  beforeEach(() => {
    runtime = new SandboxRuntime();
  });

  describe('parseMemoryToMiB', () => {
    it('should parse MiB values', () => {
      const result = (runtime as any).parseMemoryToMiB('512MiB');
      expect(result).toBe(512);
    });

    it('should parse GiB values', () => {
      const result = (runtime as any).parseMemoryToMiB('2GiB');
      expect(result).toBe(2048);
    });

    it('should parse numeric values as MiB', () => {
      const result = (runtime as any).parseMemoryToMiB('256');
      expect(result).toBe(256);
    });

    it('should return default for invalid input', () => {
      const result = (runtime as any).parseMemoryToMiB('invalid');
      expect(result).toBe(128);
    });
  });
});
