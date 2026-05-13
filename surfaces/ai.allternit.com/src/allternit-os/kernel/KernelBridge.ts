/**
 * allternit Super-Agent OS - Kernel Bridge
 * 
 * Connects the Utility Pane to the 1-kernel Brain Runtime.
 * Supports multiple backends:
 * - WebSocket: Direct connection to kernel gateway
 * - Electron IPC: Via main process to daemon socket
 * - Mock: Development/testing mode
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type {
  KernelProgramCommand,
  KernelProgramEvent,
  StreamingChunk,
  ResearchDocState,
  DataGridState,
  PresentationState,
  OrchestratorState,
  AllternitProgramState,
} from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export type KernelBackend = 'websocket' | 'electron' | 'mock';

export interface KernelBridgeOptions {
  /** Backend type */
  backend?: KernelBackend;
  /** WebSocket endpoint (for WebSocket backend) */
  endpoint?: string;
  /** Connection state callback */
  onConnectionChange?: (connected: boolean) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Debug logging */
  debug?: boolean;
}

export interface KernelBridge {
  connect(): void;
  disconnect(): void;
  sendCommand(command: KernelProgramCommand): void;
  isConnected(): boolean;
}

// ============================================================================
// Electron IPC Bridge
// ============================================================================

export class KernelElectronBridge implements KernelBridge {
  private connected = false;
  private messageHandler: ((event: KernelProgramEvent) => void) | null = null;
  private options: KernelBridgeOptions;

  constructor(options: KernelBridgeOptions) {
    this.options = options;
  }

  connect(): void {
    if (!window.electron?.kernel) {
      console.error('[KernelElectronBridge] Electron IPC not available');
      this.options.onError?.(new Error('Electron IPC not available'));
      return;
    }

    this.connected = true;
    this.log('Connected via Electron IPC');
    this.options.onConnectionChange?.(true);

    // Set up message handler
    this.messageHandler = (event: KernelProgramEvent) => {
      this.handleKernelEvent(event);
    };
    
    window.electron.kernel.onMessage(this.messageHandler);
  }

  disconnect(): void {
    this.connected = false;
    this.log('Disconnected');
    this.options.onConnectionChange?.(false);
    
    if (window.electron?.kernel && this.messageHandler) {
      window.electron.kernel.offMessage(this.messageHandler);
    }
  }

  sendCommand(command: KernelProgramCommand): void {
    if (!this.connected || !window.electron?.kernel) {
      this.log('Not connected, command dropped:', command);
      return;
    }

    this.log('Sending command:', command.command);
    window.electron.kernel.sendCommand(command);
  }

  isConnected(): boolean {
    return this.connected && !!window.electron?.kernel;
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug('[KernelElectronBridge]', ...args);
    }
  }

  private handleKernelEvent(event: KernelProgramEvent): void {
    const store = useSidecarStore.getState();

    switch (event.event) {
      case 'state-update':
        if (event.programId) {
          store.setProgramState(event.programId, event.payload as AllternitProgramState);
        }
        break;

      case 'stream-chunk':
        if (event.programId) {
          store.appendStreamChunk(event.programId, event.payload as StreamingChunk);
        }
        break;

      case 'complete':
        if (event.programId) {
          store.updateProgramState(event.programId, (state: ResearchDocState | DataGridState | PresentationState) => ({
            ...state,
            isGenerating: false,
          }));
          store.endStream(event.programId);
        }
        break;

      case 'error':
        console.error('[KernelElectronBridge] Program error:', event.payload);
        store.emitEvent({
          type: 'program.error',
          programId: event.programId,
          payload: event.payload,
        });
        break;
    }
  }
}

// ============================================================================
// WebSocket Implementation
// ============================================================================

export class KernelWebSocketBridge implements KernelBridge {
  private ws: WebSocket | null = null;
  private options: Required<KernelBridgeOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: KernelBridgeOptions) {
    this.options = {
      backend: 'websocket',
      endpoint: 'ws://127.0.0.1:8080/kernel',
      onConnectionChange: () => {},
      onError: () => {},
      debug: false,
      ...options,
    };
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug('[KernelWebSocketBridge]', ...args);
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.log('Connecting to', this.options.endpoint);
      this.ws = new WebSocket(this.options.endpoint);
      
      this.ws.onopen = () => {
        this.log('Connected');
        this.reconnectAttempts = 0;
        this.options.onConnectionChange?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const kernelEvent: KernelProgramEvent = JSON.parse(event.data);
          this.handleKernelEvent(kernelEvent);
        } catch (err) {
          console.error('[KernelWebSocketBridge] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.log('Disconnected');
        this.options.onConnectionChange?.(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[KernelWebSocketBridge] WebSocket error:', error);
        this.options.onError?.(new Error('WebSocket connection failed'));
      };
    } catch (err) {
      this.options.onError?.(err as Error);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  sendCommand(command: KernelProgramCommand): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.log('Not connected, command queued');
      return;
    }
    this.ws.send(JSON.stringify(command));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private attemptReconnect(): void {
    const maxAttempts = 5;
    if (this.reconnectAttempts >= maxAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    
    this.log(`Reconnecting in ${delay}ms… (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleKernelEvent(event: KernelProgramEvent): void {
    const store = useSidecarStore.getState();

    switch (event.event) {
      case 'state-update':
        if (event.programId) {
          store.setProgramState(event.programId, event.payload as AllternitProgramState);
        }
        break;

      case 'stream-chunk':
        if (event.programId) {
          store.appendStreamChunk(event.programId, event.payload as StreamingChunk);
        }
        break;

      case 'complete':
        if (event.programId) {
          store.updateProgramState(event.programId, (state: ResearchDocState | DataGridState | PresentationState) => ({
            ...state,
            isGenerating: false,
          }));
          store.endStream(event.programId);
        }
        break;

      case 'error':
        console.error('[KernelWebSocketBridge] Program error:', event.payload);
        store.emitEvent({
          type: 'program.error',
          programId: event.programId,
          payload: event.payload,
        });
        break;
    }
  }
}

// ============================================================================
// Explicit unavailable fallback
// ============================================================================

export class KernelMockBridge implements KernelBridge {
  private connected = false;
  private options: KernelBridgeOptions;

  constructor(options: KernelBridgeOptions = {}) {
    this.options = options;
  }

  connect(): void {
    this.connected = false;
    const error = new Error('Kernel runtime unavailable. Configure Electron IPC or a kernel WebSocket endpoint.');
    this.log(error.message);
    this.options.onConnectionChange?.(false);
    this.options.onError?.(error);
  }

  disconnect(): void {
    this.connected = false;
    this.options.onConnectionChange?.(false);
  }

  sendCommand(command: KernelProgramCommand): void {
    void command;
    this.options.onError?.(new Error('Kernel command rejected because no runtime bridge is connected.'));
  }

  isConnected(): boolean {
    return this.connected;
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug('[KernelMockBridge]', ...args);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createKernelBridge(options: KernelBridgeOptions): KernelBridge {
  const backend = options.backend ?? detectBackend();
  
  switch (backend) {
    case 'electron':
      return new KernelElectronBridge(options);
    case 'websocket':
      return new KernelWebSocketBridge(options);
    case 'mock':
    default:
      return new KernelMockBridge(options);
  }
}

function detectBackend(): KernelBackend {
  if (typeof window !== 'undefined' && window.electron?.kernel) {
    return 'electron';
  }
  if (typeof WebSocket !== 'undefined') {
    return 'websocket';
  }
  return 'mock';
}

// ============================================================================
// React Hook
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseKernelBridgeOptions extends KernelBridgeOptions {
  autoConnect?: boolean;
}

export interface UseKernelBridgeReturn {
  isConnected: boolean;
  sendCommand: (command: KernelProgramCommand) => void;
  connect: () => void;
  disconnect: () => void;
  bridge: KernelBridge | null;
}

export function useKernelBridge(options: UseKernelBridgeOptions = {}): UseKernelBridgeReturn {
  const { autoConnect = true, ...bridgeOptions } = options;
  const bridgeRef = useRef<KernelBridge | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    bridgeRef.current = createKernelBridge({
      ...bridgeOptions,
      onConnectionChange: (connected) => {
        setIsConnected(connected);
        bridgeOptions.onConnectionChange?.(connected);
      },
    });

    if (autoConnect) {
      bridgeRef.current.connect();
    }

    return () => {
      bridgeRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback(() => {
    bridgeRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    bridgeRef.current?.disconnect();
  }, []);

  const sendCommand = useCallback((command: KernelProgramCommand) => {
    bridgeRef.current?.sendCommand(command);
  }, []);

  return {
    isConnected,
    sendCommand,
    connect,
    disconnect,
    bridge: bridgeRef.current,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

export const kernelBridge = createKernelBridge({});
export default kernelBridge;
