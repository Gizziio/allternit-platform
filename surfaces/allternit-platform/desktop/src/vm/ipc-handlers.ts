/**
 * VM IPC Handlers
 *
 * Electron IPC handlers for VM management in the main process.
 * Bridges renderer process requests to the DesktopVMManager.
 *
 * @module ipc-handlers
 * @example
 * ```typescript
 * // In main process
 * import { registerVMIPCHandlers } from './ipc-handlers';
 * import { DesktopVMManager } from './manager';
 *
 * const vmManager = new DesktopVMManager();
 * await vmManager.initialize();
 *
 * registerVMIPCHandlers(vmManager);
 * ```
 */

import { ipcMain, IpcMainInvokeEvent } from "electron";
import { DesktopVMManager, VMManagerError } from "./manager.js";
import { VMOptions, StopOptions, ExecuteOptions } from "./types.js";

/**
 * IPC response wrapper
 */
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Wrap a result in IPC response format
 */
function successResponse<T>(data: T): IPCResponse<T> {
  return { success: true, data };
}

/**
 * Wrap an error in IPC response format
 */
function errorResponse(error: unknown): IPCResponse {
  if (error instanceof VMManagerError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: false,
    error: String(error),
  };
}

/**
 * Register all VM IPC handlers
 * @param vmManager - Desktop VM Manager instance
 */
export function registerVMIPCHandlers(vmManager: DesktopVMManager): void {
  // ============================================================================
  // VM Lifecycle
  // ============================================================================

  /**
   * Get VM status
   * Returns current VM status information
   */
  ipcMain.handle("vm:get-status", async (): Promise<IPCResponse> => {
    try {
      const status = vmManager.getStatus();
      return successResponse(status);
    } catch (error) {
      return errorResponse(error);
    }
  });

  /**
   * Start VM
   * Creates and starts a new VM instance
   */
  ipcMain.handle(
    "vm:start",
    async (_event: IpcMainInvokeEvent, options?: VMOptions): Promise<IPCResponse> => {
      try {
        const vm = await vmManager.startVM(options);
        return successResponse({
          id: vm.config.id,
          name: vm.config.name,
          status: vm.status,
        });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  /**
   * Stop VM
   * Stops the running VM
   */
  ipcMain.handle(
    "vm:stop",
    async (_event: IpcMainInvokeEvent, options?: StopOptions): Promise<IPCResponse> => {
      try {
        await vmManager.stopVM(options);
        return successResponse({ stopped: true });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  /**
   * Restart VM
   * Restarts the VM
   */
  ipcMain.handle(
    "vm:restart",
    async (_event: IpcMainInvokeEvent, options?: VMOptions): Promise<IPCResponse> => {
      try {
        const vm = await vmManager.restartVM(options);
        return successResponse({
          id: vm.config.id,
          name: vm.config.name,
          status: vm.status,
        });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ============================================================================
  // Command Execution
  // ============================================================================

  /**
   * Execute command in VM
   * Executes a shell command inside the VM
   */
  ipcMain.handle(
    "vm:execute",
    async (
      _event: IpcMainInvokeEvent,
      command: string,
      options?: ExecuteOptions
    ): Promise<IPCResponse> => {
      try {
        const result = await vmManager.execute(command, options);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ============================================================================
  // VM Setup & Images
  // ============================================================================

  /**
   * Setup VM
   * Downloads images and prepares VM environment
   */
  ipcMain.handle(
    "vm:setup",
    async (
      _event: IpcMainInvokeEvent,
      options?: { force?: boolean; version?: string }
    ): Promise<IPCResponse> => {
      try {
        const imagesExist = await vmManager.checkImages();

        if (!imagesExist || options?.force) {
          await vmManager.downloadImages(options?.force);
        }

        return successResponse({
          ready: true,
          imagesDownloaded: true,
        });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  /**
   * Check if VM images exist
   */
  ipcMain.handle("vm:check-images", async (): Promise<IPCResponse> => {
    try {
      const exists = await vmManager.checkImages();
      return successResponse({ exists });
    } catch (error) {
      return errorResponse(error);
    }
  });

  /**
   * Download VM images
   */
  ipcMain.handle(
    "vm:download-images",
    async (_event: IpcMainInvokeEvent, options?: { force?: boolean }): Promise<IPCResponse> => {
      try {
        await vmManager.downloadImages(options?.force);
        return successResponse({ downloaded: true });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ============================================================================
  // Platform Info
  // ============================================================================

  /**
   * Get platform information
   */
  ipcMain.handle("vm:get-platform-info", async (): Promise<IPCResponse> => {
    try {
      const info = vmManager.getPlatformInfo();
      return successResponse(info);
    } catch (error) {
      return errorResponse(error);
    }
  });

  // ============================================================================
  // Event Forwarding
  // ============================================================================

  /**
   * Forward VM events to renderer process
   * Set up event listeners that broadcast to renderer
   */

  // VM lifecycle events
  vmManager.on("vm:initialized", () => {
    broadcastToAllRenderers("vm:status-changed", { event: "initialized" });
  });

  vmManager.on("vm:starting", () => {
    broadcastToAllRenderers("vm:status-changed", { event: "starting" });
  });

  vmManager.on("vm:started", () => {
    broadcastToAllRenderers("vm:status-changed", { event: "started" });
  });

  vmManager.on("vm:stopping", () => {
    broadcastToAllRenderers("vm:status-changed", { event: "stopping" });
  });

  vmManager.on("vm:stopped", () => {
    broadcastToAllRenderers("vm:status-changed", { event: "stopped" });
  });

  vmManager.on("vm:error", ({ error, recoverable }) => {
    broadcastToAllRenderers("vm:status-changed", {
      event: "error",
      error: error instanceof Error ? error.message : String(error),
      recoverable,
    });
  });

  // State change events
  vmManager.on("state:changed", ({ from, to, duration }) => {
    broadcastToAllRenderers("vm:state-changed", { from, to, duration });
  });

  // Download events
  vmManager.on("download:start", ({ imageName }) => {
    broadcastToAllRenderers("vm:download-progress", {
      type: "start",
      imageName,
    });
  });

  vmManager.on("download:progress", (progress) => {
    broadcastToAllRenderers("vm:download-progress", {
      type: "progress",
      ...progress,
    });
  });

  vmManager.on("download:complete", ({ imageName }) => {
    broadcastToAllRenderers("vm:download-progress", {
      type: "complete",
      imageName,
    });
  });

  vmManager.on("download:error", ({ imageName, error }) => {
    broadcastToAllRenderers("vm:download-progress", {
      type: "error",
      imageName,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Health events
  vmManager.on("health:check", (status) => {
    broadcastToAllRenderers("vm:health-check", status);
  });

  vmManager.on("health:healthy", (status) => {
    broadcastToAllRenderers("vm:health-status", { healthy: true, ...status });
  });

  vmManager.on("health:unhealthy", (status) => {
    broadcastToAllRenderers("vm:health-status", { healthy: false, ...status });
  });

  // Execution events
  vmManager.on("execution:start", ({ command }) => {
    broadcastToAllRenderers("vm:execution", { type: "start", command });
  });

  vmManager.on("execution:complete", (result) => {
    broadcastToAllRenderers("vm:execution", { type: "complete", ...result });
  });

  vmManager.on("execution:error", ({ command, error }) => {
    broadcastToAllRenderers("vm:execution", {
      type: "error",
      command,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Socket server events
  vmManager.on("socket:started", ({ path }) => {
    broadcastToAllRenderers("vm:socket-status", { status: "started", path });
  });

  vmManager.on("socket:stopped", () => {
    broadcastToAllRenderers("vm:socket-status", { status: "stopped" });
  });

  vmManager.on("socket:connection", ({ clientId }) => {
    broadcastToAllRenderers("vm:socket-connection", { clientId });
  });
}

/**
 * Broadcast an event to all renderer processes
 * @param channel - IPC channel
 * @param data - Event data
 */
function broadcastToAllRenderers(channel: string, data: unknown): void {
  // This would need access to the BrowserWindow instances
  // Implementation depends on how windows are managed in the main process
  // Typically would iterate over all windows and send via webContents.send

  // Example:
  // const { BrowserWindow } = require('electron');
  // BrowserWindow.getAllWindows().forEach(window => {
  //   window.webContents.send(channel, data);
  // });

  // For now, this is a placeholder that should be integrated with
  // the actual window management in the main process
}

/**
 * Unregister all VM IPC handlers
 */
export function unregisterVMIPCHandlers(): void {
  ipcMain.removeHandler("vm:get-status");
  ipcMain.removeHandler("vm:start");
  ipcMain.removeHandler("vm:stop");
  ipcMain.removeHandler("vm:restart");
  ipcMain.removeHandler("vm:execute");
  ipcMain.removeHandler("vm:setup");
  ipcMain.removeHandler("vm:check-images");
  ipcMain.removeHandler("vm:download-images");
  ipcMain.removeHandler("vm:get-platform-info");
}

export default registerVMIPCHandlers;
