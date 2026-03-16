/**
 * Gateway Canvas Commands
 * Ported from OpenClaw gateway tool implementations
 *
 * Commands:
 * - canvas.present   : Show canvas with optional URL/placement
 * - canvas.hide      : Hide canvas
 * - canvas.navigate  : Navigate to URL
 * - canvas.eval      : Execute JavaScript
 * - canvas.snapshot  : Capture screenshot
 * - canvas.a2ui.push : Push A2UI JSONL payload
 * - canvas.a2ui.reset: Reset A2UI state
 */

export interface NodeInvokeRequest {
  nodeId: string;
  command: string;
  params?: unknown;
  idempotencyKey?: string;
}

export interface NodeInvokeResponse {
  payload?: unknown;
  error?: string;
}

export interface CanvasPresentParams {
  url?: string;
  placement?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

export interface CanvasNavigateParams {
  url: string;
}

export interface CanvasEvalParams {
  javaScript: string;
}

export interface CanvasSnapshotParams {
  format?: 'png' | 'jpeg';
  maxWidth?: number;
  quality?: number;
  delayMs?: number;
}

export interface CanvasA2UIPushParams {
  jsonl: string;
}

export interface CanvasCommandContext {
  invoke: (command: string, params?: unknown) => Promise<unknown>;
}

export function createCanvasCommands(ctx: CanvasCommandContext) {
  return {
    // Present canvas (show with optional URL and placement)
    async present(params: CanvasPresentParams): Promise<NodeInvokeResponse> {
      try {
        const result = await ctx.invoke('canvas.present', {
          url: params.url,
          placement: params.placement,
        });
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // Hide canvas
    async hide(): Promise<NodeInvokeResponse> {
      try {
        const result = await ctx.invoke('canvas.hide', {});
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // Navigate to URL
    async navigate(params: CanvasNavigateParams): Promise<NodeInvokeResponse> {
      try {
        const result = await ctx.invoke('canvas.navigate', {
          url: params.url,
        });
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // Execute JavaScript in canvas
    async eval(params: CanvasEvalParams): Promise<NodeInvokeResponse> {
      try {
        const result = await ctx.invoke('canvas.eval', {
          javaScript: params.javaScript,
        });
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // Capture canvas screenshot
    async snapshot(params: CanvasSnapshotParams = {}): Promise<NodeInvokeResponse> {
      try {
        const result = await ctx.invoke('canvas.snapshot', {
          format: params.format ?? 'png',
          maxWidth: params.maxWidth,
          quality: params.quality,
          delayMs: params.delayMs,
        });
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // A2UI commands
    a2ui: {
      // Push JSONL UI payload
      async push(params: CanvasA2UIPushParams): Promise<NodeInvokeResponse> {
        try {
          const result = await ctx.invoke('canvas.a2ui.pushJSONL', {
            jsonl: params.jsonl,
          });
          return { payload: result };
        } catch (error) {
          return { error: String(error) };
        }
      },

      // Reset A2UI state
      async reset(): Promise<NodeInvokeResponse> {
        try {
          const result = await ctx.invoke('canvas.a2ui.reset', {});
          return { payload: result };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },
  };
}

// Command registry for Gateway
export const CANVAS_COMMANDS = {
  'canvas.present': {
    description: 'Show canvas with optional URL and placement',
    parameters: {
      url: { type: 'string', optional: true },
      placement: {
        type: 'object',
        optional: true,
        properties: {
          x: { type: 'number', optional: true },
          y: { type: 'number', optional: true },
          width: { type: 'number', optional: true },
          height: { type: 'number', optional: true },
        },
      },
    },
  },
  'canvas.hide': {
    description: 'Hide canvas',
    parameters: {},
  },
  'canvas.navigate': {
    description: 'Navigate canvas to URL',
    parameters: {
      url: { type: 'string', required: true },
    },
  },
  'canvas.eval': {
    description: 'Execute JavaScript in canvas',
    parameters: {
      javaScript: { type: 'string', required: true },
    },
  },
  'canvas.snapshot': {
    description: 'Capture canvas screenshot',
    parameters: {
      format: { type: 'string', enum: ['png', 'jpeg'], optional: true },
      maxWidth: { type: 'number', optional: true },
      quality: { type: 'number', optional: true },
      delayMs: { type: 'number', optional: true },
    },
  },
  'canvas.a2ui.pushJSONL': {
    description: 'Push A2UI JSONL payload to canvas',
    parameters: {
      jsonl: { type: 'string', required: true },
    },
  },
  'canvas.a2ui.reset': {
    description: 'Reset A2UI state',
    parameters: {},
  },
};
