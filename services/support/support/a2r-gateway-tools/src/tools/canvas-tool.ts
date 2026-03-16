/**
 * Canvas Tool for Agents
 * Ported from OpenClaw dist/agents/tools/canvas-tool.js
 * 
 * Actions:
 * - present    : Show canvas
 * - hide       : Hide canvas
 * - navigate   : Navigate to URL
 * - eval       : Execute JavaScript
 * - snapshot   : Capture screenshot
 * - a2ui_push  : Push A2UI JSONL
 * - a2ui_reset : Reset A2UI
 */

import type { ToolDefinition, ToolResult } from '../../types/index.js';

const CANVAS_ACTIONS = [
  'present',
  'hide',
  'navigate',
  'eval',
  'snapshot',
  'a2ui_push',
  'a2ui_reset',
] as const;

export interface CanvasToolParams {
  action: typeof CANVAS_ACTIONS[number];
  // present
  target?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // navigate
  url?: string;
  // eval
  javaScript?: string;
  // snapshot
  outputFormat?: 'png' | 'jpeg';
  maxWidth?: number;
  quality?: number;
  delayMs?: number;
  // a2ui_push
  jsonl?: string;
  jsonlPath?: string;
}

export interface CanvasToolContext {
  callGatewayTool: (tool: string, params: unknown) => Promise<unknown>;
  readFile?: (path: string) => Promise<string>;
}

export function createCanvasTool(ctx: CanvasToolContext) {
  return {
    name: 'canvas',
    label: 'Canvas',
    description: [
      'Control node canvases (present/hide/navigate/eval/snapshot/A2UI).',
      'Use snapshot to capture the rendered UI.',
      'Use a2ui_push to render dynamic UI from JSONL payload.',
    ].join(' '),
    parameters: {
      action: {
        type: 'string',
        enum: CANVAS_ACTIONS,
        description: 'Canvas action to perform',
        required: true,
      },
      target: {
        type: 'string',
        description: 'Target URL for present action',
        optional: true,
      },
      x: { type: 'number', description: 'X position', optional: true },
      y: { type: 'number', description: 'Y position', optional: true },
      width: { type: 'number', description: 'Width', optional: true },
      height: { type: 'number', description: 'Height', optional: true },
      url: { type: 'string', description: 'URL for navigate action', optional: true },
      javaScript: { type: 'string', description: 'JavaScript code for eval action', optional: true },
      outputFormat: { type: 'string', enum: ['png', 'jpeg'], optional: true },
      maxWidth: { type: 'number', optional: true },
      quality: { type: 'number', optional: true },
      delayMs: { type: 'number', optional: true },
      jsonl: { type: 'string', description: 'JSONL payload for A2UI', optional: true },
      jsonlPath: { type: 'string', description: 'Path to JSONL file', optional: true },
    },

    async execute(args: CanvasToolParams): Promise<ToolResult> {
      const { action } = args;

      switch (action) {
        case 'present': {
          const placement = {
            x: typeof args.x === 'number' ? args.x : undefined,
            y: typeof args.y === 'number' ? args.y : undefined,
            width: typeof args.width === 'number' ? args.width : undefined,
            height: typeof args.height === 'number' ? args.height : undefined,
          };

          const invokeParams: Record<string, unknown> = {};
          if (typeof args.target === 'string' && args.target.trim()) {
            invokeParams.url = args.target.trim();
          }
          if (Object.values(placement).some(v => v !== undefined)) {
            invokeParams.placement = placement;
          }

          await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.present',
            params: invokeParams,
          });

          return {
            content: [{ type: 'text', text: 'Canvas presented' }],
            details: { ok: true },
          };
        }

        case 'hide': {
          await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.hide',
            params: {},
          });

          return {
            content: [{ type: 'text', text: 'Canvas hidden' }],
            details: { ok: true },
          };
        }

        case 'navigate': {
          if (!args.url) {
            throw new Error('url is required for navigate action');
          }

          await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.navigate',
            params: { url: args.url },
          });

          return {
            content: [{ type: 'text', text: `Navigated to ${args.url}` }],
            details: { ok: true },
          };
        }

        case 'eval': {
          if (!args.javaScript) {
            throw new Error('javaScript is required for eval action');
          }

          const result = await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.eval',
            params: { javaScript: args.javaScript },
          });

          const evalResult = (result as any)?.payload?.result;
          
          if (evalResult) {
            return {
              content: [{ type: 'text', text: String(evalResult) }],
              details: { result: evalResult },
            };
          }

          return {
            content: [{ type: 'text', text: 'Executed' }],
            details: { ok: true },
          };
        }

        case 'snapshot': {
          const format = args.outputFormat ?? 'png';

          const result = await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.snapshot',
            params: {
              format,
              maxWidth: args.maxWidth,
              quality: args.quality,
              delayMs: args.delayMs,
            },
          });

          const payload = (result as any)?.payload;

          return {
            content: [
              { type: 'text', text: `Canvas snapshot captured (${format})` },
            ],
            details: { ...payload, format },
          };
        }

        case 'a2ui_push': {
          let jsonl = '';

          if (typeof args.jsonl === 'string' && args.jsonl.trim()) {
            jsonl = args.jsonl;
          } else if (typeof args.jsonlPath === 'string' && args.jsonlPath.trim()) {
            if (!ctx.readFile) {
              throw new Error('readFile not available');
            }
            jsonl = await ctx.readFile(args.jsonlPath.trim());
          }

          if (!jsonl.trim()) {
            throw new Error('jsonl or jsonlPath is required');
          }

          await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.a2ui.pushJSONL',
            params: { jsonl },
          });

          return {
            content: [{ type: 'text', text: 'A2UI payload pushed' }],
            details: { ok: true },
          };
        }

        case 'a2ui_reset': {
          await ctx.callGatewayTool('node.invoke', {
            command: 'canvas.a2ui.reset',
            params: {},
          });

          return {
            content: [{ type: 'text', text: 'A2UI reset' }],
            details: { ok: true },
          };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}

export const CanvasToolSchema = {
  name: 'canvas',
  label: 'Canvas',
  description: 'Control node canvases (present/hide/navigate/eval/snapshot/A2UI). Use snapshot to capture the rendered UI.',
  parameters: {
    action: {
      type: 'string',
      enum: CANVAS_ACTIONS,
      required: true,
    },
    target: { type: 'string', optional: true },
    x: { type: 'number', optional: true },
    y: { type: 'number', optional: true },
    width: { type: 'number', optional: true },
    height: { type: 'number', optional: true },
    url: { type: 'string', optional: true },
    javaScript: { type: 'string', optional: true },
    outputFormat: { type: 'string', enum: ['png', 'jpeg'], optional: true },
    maxWidth: { type: 'number', optional: true },
    quality: { type: 'number', optional: true },
    delayMs: { type: 'number', optional: true },
    jsonl: { type: 'string', optional: true },
    jsonlPath: { type: 'string', optional: true },
  },
};
