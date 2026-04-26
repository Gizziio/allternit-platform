/**
 * Browser Tool Schema
 * Ported from OpenClaw dist/agents/tools/browser-tool.schema.js
 */

export const BROWSER_ACTIONS = [
  'status',
  'start',
  'stop',
  'profiles',
  'tabs',
  'open',
  'focus',
  'close',
  'snapshot',
  'screenshot',
  'navigate',
  'console',
  'pdf',
  'upload',
  'dialog',
  'act',
  'start_recording',
  'stop_recording',
  'recording_status',
] as const;

export type BrowserAction = typeof BROWSER_ACTIONS[number];

export interface BrowserToolParams {
  action: BrowserAction;
  target?: 'sandbox' | 'host' | 'node';
  node?: string;
  profile?: string;
  targetId?: string;
  targetUrl?: string;
  url?: string;
  snapshotFormat?: 'ai' | 'aria';
  refs?: 'aria' | 'role';
  mode?: 'efficient';
  labels?: boolean;
  maxChars?: number;
  limit?: number;
  interactive?: boolean;
  compact?: boolean;
  depth?: number;
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  ref?: string;
  element?: string;
  request?: {
    kind: string;
    ref?: string;
    text?: string;
    [key: string]: unknown;
  };
  timeoutMs?: number;
  level?: string;
  paths?: string[];
  inputRef?: string;
  accept?: boolean;
  promptText?: string;
  // Recording parameters
  recordingId?: string;
  format?: 'gif' | 'webm' | 'mp4';
  fps?: number;
  quality?: number;
  maxDurationSecs?: number;
  save?: boolean;
}

export const BrowserToolSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: BROWSER_ACTIONS,
      description: 'Browser action to perform',
    },
    target: {
      type: 'string',
      enum: ['sandbox', 'host', 'node'],
      description: 'Target browser location',
    },
    node: {
      type: 'string',
      description: 'Node ID for node target',
    },
    profile: {
      type: 'string',
      description: 'Browser profile (chrome, allternit)',
    },
    targetId: {
      type: 'string',
      description: 'Tab target ID',
    },
    targetUrl: {
      type: 'string',
      description: 'Target URL for open/navigate',
    },
    snapshotFormat: {
      type: 'string',
      enum: ['ai', 'aria'],
      description: 'Snapshot format',
    },
    refs: {
      type: 'string',
      enum: ['aria', 'role'],
      description: 'Reference mode for elements',
    },
    mode: {
      type: 'string',
      enum: ['efficient'],
      description: 'Snapshot mode',
    },
    labels: {
      type: 'boolean',
      description: 'Include labels in snapshot',
    },
    maxChars: {
      type: 'number',
      description: 'Maximum characters in snapshot',
    },
    limit: {
      type: 'number',
      description: 'Element limit for snapshot',
    },
    interactive: {
      type: 'boolean',
      description: 'Include only interactive elements',
    },
    compact: {
      type: 'boolean',
      description: 'Compact snapshot format',
    },
    depth: {
      type: 'number',
      description: 'Maximum depth for snapshot',
    },
    fullPage: {
      type: 'boolean',
      description: 'Capture full page in screenshot',
    },
    type: {
      type: 'string',
      enum: ['png', 'jpeg'],
      description: 'Screenshot image type',
    },
    request: {
      type: 'object',
      description: 'Action request for act',
    },
    timeoutMs: {
      type: 'number',
      description: 'Timeout in milliseconds',
    },
    // Recording parameters
    recordingId: {
      type: 'string',
      description: 'Recording session ID',
    },
    format: {
      type: 'string',
      enum: ['gif', 'webm', 'mp4'],
      description: 'Recording format',
    },
    fps: {
      type: 'number',
      description: 'Frames per second',
    },
    quality: {
      type: 'number',
      description: 'Recording quality (1-100)',
    },
    maxDurationSecs: {
      type: 'number',
      description: 'Maximum recording duration in seconds',
    },
    save: {
      type: 'boolean',
      description: 'Save recording when stopping',
    },
  },
  required: ['action'],
};
