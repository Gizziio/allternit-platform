/**
 * Apple Virtualization Driver Tests
 */

import {
  AppleVFDriver,
  VMConfig,
  VMStatus,
  PlatformError,
  VMConfigError,
  VMLifecycleError,
  createAppleVFDriver,
  quickCreateVM,
} from './apple-vf';

// Mock environment for testing
process.env.Allternit_MOCK_VIRTUALIZATION = '1';

describe('AppleVFDriver', () => {
  let driver: AppleVFDriver;

  beforeEach(() => {
    if (process.platform === 'darwin') {
      driver = new AppleVFDriver();
    }
  });

  afterEach(async () => {
    if (driver) {
      await driver.cleanup();
    }
  });

  describe('Platform Compatibility', () => {
    it('should throw PlatformError on non-macOS platforms', () => {
      if (process.platform !== 'darwin') {
        expect(() => new AppleVFDriver()).toThrow(PlatformError);
      }
    });

    it('should return platform capabilities on macOS', () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const caps = driver.getPlatformCapabilities();
      expect(caps).toHaveProperty('macosVersion');
      expect(caps).toHaveProperty('virtualizationAvailable');
      expect(caps).toHaveProperty('isAppleSilicon');
      expect(caps).toHaveProperty('rosettaAvailable');
      expect(caps).toHaveProperty('maxCPUs');
      expect(caps).toHaveProperty('maxMemory');
    });

    it('should validate platform compatibility', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const result = await driver.validatePlatform();
      expect(result).toHaveProperty('compatible');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('VM Configuration', () => {
    const validConfig: VMConfig = {
      id: 'test-vm-001',
      name: 'Test VM',
      kernelPath: '/tmp/vmlinux',
      initrdPath: '/tmp/initrd.img',
      rootfsPath: '/tmp/rootfs.ext4',
      cpuCount: 2,
      memorySize: 2 * 1024 * 1024 * 1024, // 2GB
    };

    it('should throw VMConfigError for missing id', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config = { ...validConfig, id: '' };
      await expect(driver.createVM(config)).rejects.toThrow(VMConfigError);
    });

    it('should throw VMConfigError for missing name', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config = { ...validConfig, name: '' };
      await expect(driver.createVM(config)).rejects.toThrow(VMConfigError);
    });

    it('should throw VMConfigError for invalid CPU count', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config = { ...validConfig, cpuCount: 0 };
      await expect(driver.createVM(config)).rejects.toThrow(VMConfigError);

      const config2 = { ...validConfig, cpuCount: 100 };
      await expect(driver.createVM(config2)).rejects.toThrow(VMConfigError);
    });

    it('should throw VMConfigError for invalid memory size', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config = { ...validConfig, memorySize: 100 };
      await expect(driver.createVM(config)).rejects.toThrow(VMConfigError);
    });

    it('should create VM with valid configuration', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      // Note: In real tests, these files would need to exist
      // For mock mode, we can use any path
      const vm = await driver.createVM(validConfig);
      expect(vm).toBeDefined();
      expect(vm.config.id).toBe(validConfig.id);
      expect(vm.config.name).toBe(validConfig.name);
      expect(vm.status).toBe(VMStatus.STOPPED);
      expect(vm.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('VM Lifecycle', () => {
    const mockConfig: VMConfig = {
      id: 'lifecycle-test',
      name: 'Lifecycle Test VM',
      kernelPath: '/tmp/vmlinux',
      initrdPath: '/tmp/initrd.img',
      rootfsPath: '/tmp/rootfs.ext4',
      cpuCount: 2,
      memorySize: 2 * 1024 * 1024 * 1024,
    };

    it('should emit events during VM lifecycle', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const events: string[] = [];
      driver.on('vm:created', () => events.push('created'));
      driver.on('vm:configured', () => events.push('configured'));
      driver.on('vm:starting', () => events.push('starting'));
      driver.on('vm:started', () => events.push('started'));
      driver.on('vm:stopping', () => events.push('stopping'));
      driver.on('vm:stopped', () => events.push('stopped'));
      driver.on('vm:destroying', () => events.push('destroying'));
      driver.on('vm:destroyed', () => events.push('destroyed'));

      const vm = await driver.createVM(mockConfig);
      await driver.startVM(vm);
      await driver.stopVM(vm);
      await driver.destroyVM(vm);

      expect(events).toContain('created');
      expect(events).toContain('configured');
      expect(events).toContain('starting');
      expect(events).toContain('started');
      expect(events).toContain('stopping');
      expect(events).toContain('stopped');
      expect(events).toContain('destroying');
      expect(events).toContain('destroyed');
    });

    it('should track VM status through lifecycle', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      expect(driver.getVMStatus(vm)).toBe(VMStatus.STOPPED);

      await driver.startVM(vm);
      expect(driver.getVMStatus(vm)).toBe(VMStatus.RUNNING);

      await driver.stopVM(vm);
      expect(driver.getVMStatus(vm)).toBe(VMStatus.STOPPED);
    });

    it('should get VM by id', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      const retrieved = driver.getVM(mockConfig.id);
      expect(retrieved).toBe(vm);
    });

    it('should list all VMs', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const initialCount = driver.getVMs().length;
      await driver.createVM(mockConfig);
      expect(driver.getVMs().length).toBe(initialCount + 1);
    });
  });

  describe('Command Execution', () => {
    const mockConfig: VMConfig = {
      id: 'cmd-test',
      name: 'Command Test VM',
      kernelPath: '/tmp/vmlinux',
      initrdPath: '/tmp/initrd.img',
      rootfsPath: '/tmp/rootfs.ext4',
      cpuCount: 2,
      memorySize: 2 * 1024 * 1024 * 1024,
    };

    it('should execute command and return result', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      await driver.startVM(vm);

      const result = await driver.executeCommand(vm, 'uname -a');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');

      await driver.stopVM(vm);
    });

    it('should throw VMLifecycleError for stopped VM', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      // Don't start the VM

      await expect(driver.executeCommand(vm, 'echo test'))
        .rejects.toThrow(VMLifecycleError);
    });
  });

  describe('Log Streaming', () => {
    const mockConfig: VMConfig = {
      id: 'log-test',
      name: 'Log Test VM',
      kernelPath: '/tmp/vmlinux',
      initrdPath: '/tmp/initrd.img',
      rootfsPath: '/tmp/rootfs.ext4',
      cpuCount: 2,
      memorySize: 2 * 1024 * 1024 * 1024,
    };

    it('should stream console logs', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);

      const logs: string[] = [];
      for await (const line of driver.streamLogs(vm)) {
        logs.push(line);
      }

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should get buffered console logs', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      const logs = driver.getConsoleLogs(vm);
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create driver via factory function', () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const d = createAppleVFDriver();
      expect(d).toBeInstanceOf(AppleVFDriver);
    });

    it('should create VM via quickCreateVM', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config: VMConfig = {
        id: 'quick-test',
        name: 'Quick Test VM',
        kernelPath: '/tmp/vmlinux',
        initrdPath: '/tmp/initrd.img',
        rootfsPath: '/tmp/rootfs.ext4',
        cpuCount: 2,
        memorySize: 2 * 1024 * 1024 * 1024,
      };

      const vm = await quickCreateVM(config);
      expect(vm).toBeDefined();
      expect(vm.config.id).toBe(config.id);
    });
  });

  describe('Pause/Resume', () => {
    const mockConfig: VMConfig = {
      id: 'pause-test',
      name: 'Pause Test VM',
      kernelPath: '/tmp/vmlinux',
      initrdPath: '/tmp/initrd.img',
      rootfsPath: '/tmp/rootfs.ext4',
      cpuCount: 2,
      memorySize: 2 * 1024 * 1024 * 1024,
    };

    it('should pause and resume VM', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);
      await driver.startVM(vm);

      expect(driver.getVMStatus(vm)).toBe(VMStatus.RUNNING);

      await driver.pauseVM(vm);
      expect(driver.getVMStatus(vm)).toBe(VMStatus.PAUSED);

      await driver.resumeVM(vm);
      expect(driver.getVMStatus(vm)).toBe(VMStatus.RUNNING);

      await driver.stopVM(vm);
    });

    it('should throw VMLifecycleError when pausing stopped VM', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const vm = await driver.createVM(mockConfig);

      await expect(driver.pauseVM(vm))
        .rejects.toThrow(VMLifecycleError);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all VMs', async () => {
      if (process.platform !== 'darwin') {
        return;
      }

      const config1: VMConfig = {
        id: 'cleanup-1',
        name: 'Cleanup Test 1',
        kernelPath: '/tmp/vmlinux',
        initrdPath: '/tmp/initrd.img',
        rootfsPath: '/tmp/rootfs.ext4',
        cpuCount: 1,
        memorySize: 1024 * 1024 * 1024,
      };

      const config2: VMConfig = {
        id: 'cleanup-2',
        name: 'Cleanup Test 2',
        kernelPath: '/tmp/vmlinux',
        initrdPath: '/tmp/initrd.img',
        rootfsPath: '/tmp/rootfs.ext4',
        cpuCount: 1,
        memorySize: 1024 * 1024 * 1024,
      };

      await driver.createVM(config1);
      await driver.createVM(config2);

      expect(driver.getVMs().length).toBeGreaterThanOrEqual(2);

      await driver.cleanup();

      expect(driver.getVMs().length).toBe(0);
    });
  });
});
