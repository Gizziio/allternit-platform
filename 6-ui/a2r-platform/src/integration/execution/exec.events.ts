import { create } from 'zustand';
import { TraceFrame, RunResult, ToolCall } from './exec.types';

type EventHandler<T> = (data: T) => void;

interface ExecutionEvents {
  onRunStart: EventHandler<{ runId: string }>;
  onRunUpdate: EventHandler<RunResult>;
  onRunComplete: EventHandler<RunResult>;
  onTraceFrame: EventHandler<TraceFrame>;
  onToolCall: EventHandler<ToolCall>;
  onLog: EventHandler<{ runId: string; level: string; message: string; timestamp: number }>;
}

/**
 * Execution Event Bus
 * 
 * Simple pub/sub for execution events.
 */
class ExecutionEventBus {
  private listeners: Partial<Record<keyof ExecutionEvents, Set<any>>> = {};

  on<K extends keyof ExecutionEvents>(event: K, handler: ExecutionEvents[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof ExecutionEvents>(event: K, handler: ExecutionEvents[K]) {
    this.listeners[event]?.delete(handler);
  }

  emit<K extends keyof ExecutionEvents>(event: K, data: Parameters<ExecutionEvents[K]>[0]) {
    this.listeners[event]?.forEach(handler => handler(data));
  }
}

export const execEvents = new ExecutionEventBus();
