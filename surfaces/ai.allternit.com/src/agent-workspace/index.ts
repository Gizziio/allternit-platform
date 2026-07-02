// @ts-nocheck
export type { AllternitNativeState, WorkspaceAPI } from './types';
export type { WebSocketStatus, WebSocketMessage, MessageHandler, StatusHandler, WorkspaceWebSocketOptions } from './websocket';
export { WorkspaceWebSocket } from './websocket';
export { default as useWorkspaceWebSocket } from './useWorkspaceWebSocket';
export { default as useAllternitStream } from './useAllternitStream';
export { createHttpWorkspace, type HttpWorkspaceAPI, type HttpClientOptions } from './http-client';
export { createWasmWorkspace, type WasmWorkspaceAPI } from './wasm-wrapper';
import { createHttpWorkspace } from './http-client';

export enum Backend {
  HTTP = 'http',
  WASM = 'wasm',
}

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  condition: string;
  action: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version?: string;
}

export interface Identity {
  id: string;
  name: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface TaskGraph {
  tasks: Task[];
  edges: { from: string; to: string }[];
}

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
}

export interface CreateMemoryInput {
  content: string;
}

export function createWorkspace(
  path: string,
  options?: Record<string, unknown>
): Promise<WorkspaceAPI> {
  const serverUrl = (options?.serverUrl as string | undefined) ?? '';
  const auth = options?.auth as { username: string; password: string } | undefined;
  return createHttpWorkspace(path, serverUrl, auth);
}
