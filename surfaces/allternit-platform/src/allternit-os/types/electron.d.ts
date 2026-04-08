/**
 * A2rchitect Super-Agent OS - Electron API Type Definitions
 * 
 * Unified type declarations for the window.electron API.
 * This file provides type definitions for all Electron IPC channels
 * used by the A2rOS system.
 */

import type { DriveEntry, FileUpload } from '../services/FileSystemService';
import type { KernelProgramCommand, KernelProgramEvent } from './programs';

// ============================================================================
// File System API
// ============================================================================

export interface ElectronFileSystemAPI {
  listEntries: (path: string) => Promise<DriveEntry[]>;
  getEntry: (path: string) => Promise<DriveEntry>;
  createFolder: (path: string) => Promise<DriveEntry>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array) => Promise<DriveEntry>;
  deleteEntry: (path: string) => Promise<void>;
  moveEntry: (from: string, to: string) => Promise<DriveEntry>;
  getStats: () => Promise<{ totalSpace: number; usedSpace: number }>;
}

// ============================================================================
// Kernel API
// ============================================================================

export interface ElectronKernelAPI {
  sendCommand: (command: KernelProgramCommand) => void;
  onMessage: (handler: (event: KernelProgramEvent) => void) => void;
  offMessage: (handler: (event: KernelProgramEvent) => void) => void;
  execute?: (request: {
    code: string;
    timeout: number;
    libraries: string[];
    env?: Record<string, string>;
    workingDir?: string;
  }) => Promise<PythonExecutionResult>;
}

// ============================================================================
// Python Execution API
// ============================================================================

export interface PythonExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  outputPath?: string;
  executionTime: number;
  exitCode: number;
}

export interface ElectronPythonAPI {
  execute: (request: {
    code: string;
    timeout: number;
    libraries: string[];
    env?: Record<string, string>;
    workingDir?: string;
  }) => Promise<PythonExecutionResult>;
}

// ============================================================================
// Browser Automation API
// ============================================================================

export interface BrowserCaptureResult {
  screenshot: string;
  title: string;
  viewport: { width: number; height: number };
  userAgent: string;
  captureTime: number;
}

export interface BrowserVerifyResult {
  accessible: boolean;
  statusCode?: number;
  error?: string;
}

export interface ElectronBrowserAPI {
  capture: (options: {
    url: string;
    fullPage?: boolean;
    selector?: string;
    viewport?: { width: number; height: number };
    hideSelectors?: string[];
  }) => Promise<BrowserCaptureResult>;
  verify: (url: string) => Promise<BrowserVerifyResult>;
}

// ============================================================================
// Unified Electron API
// ============================================================================

declare global {
  interface Window {
    electron?: {
      /** File system operations */
      fs?: ElectronFileSystemAPI;
      /** Kernel IPC bridge */
      kernel?: ElectronKernelAPI;
      /** Python code execution */
      python?: ElectronPythonAPI;
      /** Browser automation */
      browser?: ElectronBrowserAPI;
    };
  }
}

export {};
