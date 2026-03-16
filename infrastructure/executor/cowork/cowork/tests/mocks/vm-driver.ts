/**
 * Mock VM Driver for Testing
 */

import type {
  VMDriver,
  VM,
  VMConfig,
  VMStatus,
  ExecutionResult,
  ExecutionOptions,
} from "../../drivers/types";

export interface MockVMDriverOptions {
  simulateDelay?: number;
  shouldFailStart?: boolean;
  shouldFailExecute?: boolean;
}

export class MockVMDriver implements VMDriver {
  private options: MockVMDriverOptions;
  private vms = new Map<string, MockVM>();
  private platform: string;

  constructor(options: MockVMDriverOptions = {}, platform = "darwin") {
    this.options = options;
    this.platform = platform;
  }

  getPlatform(): string {
    return this.platform;
  }

  async checkRequirements(): Promise<{ available: boolean; reason?: string }> {
    if (this.options.shouldFailStart) {
      return { available: false, reason: "Mock: Driver disabled for testing" };
    }
    return { available: true };
  }

  async createVM(config: VMConfig): Promise<VM> {
    const vm: MockVM = {
      id: config.id,
      name: config.name,
      config,
      status: "created",
      pid: undefined,
      startTime: undefined,
      state: "stopped",
    };
    this.vms.set(config.id, vm);
    return vm;
  }

  async startVM(vm: VM): Promise<void> {
    const mockVM = this.vms.get(vm.id);
    if (!mockVM) throw new Error(`VM ${vm.id} not found`);

    if (this.options.shouldFailStart) {
      throw new Error("Mock: VM start failed");
    }

    if (this.options.simulateDelay) {
      await new Promise((r) => setTimeout(r, this.options.simulateDelay));
    }

    mockVM.status = "running";
    mockVM.state = "running";
    mockVM.pid = Math.floor(Math.random() * 10000) + 1000;
    mockVM.startTime = new Date();
  }

  async stopVM(vm: VM, timeout?: number): Promise<void> {
    const mockVM = this.vms.get(vm.id);
    if (!mockVM) throw new Error(`VM ${vm.id} not found`);

    mockVM.status = "stopped";
    mockVM.state = "stopped";
    mockVM.pid = undefined;
  }

  async destroyVM(vm: VM): Promise<void> {
    this.vms.delete(vm.id);
  }

  async pauseVM(vm: VM): Promise<void> {
    const mockVM = this.vms.get(vm.id);
    if (mockVM) {
      mockVM.state = "paused";
    }
  }

  async resumeVM(vm: VM): Promise<void> {
    const mockVM = this.vms.get(vm.id);
    if (mockVM) {
      mockVM.state = "running";
    }
  }

  async getVMStatus(vm: VM): Promise<VMStatus> {
    const mockVM = this.vms.get(vm.id);
    if (!mockVM) throw new Error(`VM ${vm.id} not found`);

    return {
      state: mockVM.state,
      pid: mockVM.pid,
      uptime: mockVM.startTime
        ? Date.now() - mockVM.startTime.getTime()
        : undefined,
      cpuUsage: Math.random() * 50,
      memoryUsage: Math.random() * 4 * 1024 * 1024 * 1024,
    };
  }

  async executeCommand(
    vm: VM,
    command: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    if (this.options.shouldFailExecute) {
      throw new Error("Mock: Command execution failed");
    }

    // Simulate command execution
    const exitCode = command.includes("fail") ? 1 : 0;
    const stdout = `Mock execution: ${command}\nExit code: ${exitCode}`;
    const stderr = exitCode !== 0 ? "Error: Command failed" : "";

    if (this.options.simulateDelay) {
      await new Promise((r) => setTimeout(r, this.options.simulateDelay));
    }

    return {
      exitCode,
      stdout,
      stderr,
      duration: this.options.simulateDelay || 0,
    };
  }

  streamLogs(vm: VM): AsyncGenerator<string> {
    const mockVM = this.vms.get(vm.id);
    if (!mockVM) throw new Error(`VM ${vm.id} not found`);

    return (async function* () {
      yield "Mock VM boot log...\n";
      yield "Kernel initialized\n";
      yield "System ready\n";
    })();
  }

  // Test helpers
  getMockVM(id: string): MockVM | undefined {
    return this.vms.get(id);
  }

  getAllVMs(): MockVM[] {
    return Array.from(this.vms.values());
  }

  simulateVMFailure(id: string, error: Error): void {
    const vm = this.vms.get(id);
    if (vm) {
      vm.state = "error";
      (vm as any).error = error;
    }
  }
}

interface MockVM extends VM {
  state: VMState;
}

type VMState =
  | "created"
  | "starting"
  | "running"
  | "paused"
  | "stopped"
  | "error";
