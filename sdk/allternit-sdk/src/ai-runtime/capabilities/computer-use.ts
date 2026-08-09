import type { ToolDefinition } from '../tools/types.js';

export type ComputerUseAction =
  | 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag'
  | 'right_click' | 'middle_click' | 'double_click' | 'triple_click'
  | 'left_mouse_down' | 'left_mouse_up' | 'screenshot' | 'cursor_position'
  | 'scroll' | 'hold_key' | 'wait';

export interface ComputerUseInput {
  action: ComputerUseAction;
  text?: string;
  coordinate?: [number, number];
  scroll_direction?: 'up' | 'down' | 'left' | 'right';
  scroll_amount?: number;
  duration?: number;
}

export interface ComputerUseOptions {
  gatewayUrl?: string;
  fetch?: typeof globalThis.fetch;
  displayWidthPx?: number;
  displayHeightPx?: number;
  displayNumber?: number;
}

export const COMPUTER_USE_TOOL: ToolDefinition = {
  name: 'computer',
  description: 'Control the mouse and keyboard, and capture screenshots to interact with the computer.',
  input_schema: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['key', 'type', 'mouse_move', 'left_click', 'left_click_drag', 'right_click', 'middle_click', 'double_click', 'triple_click', 'left_mouse_down', 'left_mouse_up', 'screenshot', 'cursor_position', 'scroll', 'hold_key', 'wait'],
        description: 'The computer action to perform'
      },
      text: { type: 'string', description: 'Text to type for the "type" and "key" actions' },
      coordinate: { 
        type: 'array', 
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'The absolute [x, y] pixel coordinates for mouse actions'
      },
      scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Direction for scroll' },
      scroll_amount: { type: 'integer', description: 'Number of scroll ticks' },
      duration: { type: 'number', description: 'Duration in seconds for hold_key and wait' },
    },
    required: ['action']
  },
  metadata: {
    category: 'vision',
    isDestructive: true,
    requiresVision: true,
    anthropicType: 'computer_20250124',
    display_width_px: 1024,
    display_height_px: 768,
  },
  preExecute: async (args) => {
    // Standard safety check - mouse/keyboard actions might need approval if destructive
    const restricted = ['left_click', 'key', 'type'];
    if (restricted.includes(args.action)) {
      return { proceed: true }; // In a real app, this would check policy
    }
    return { proceed: true };
  }
};

export class ComputerUseCapability {
  private readonly gatewayUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly displayWidthPx: number;
  private readonly displayHeightPx: number;
  private readonly displayNumber?: number;

  constructor(options: string | ComputerUseOptions = {}) {
    const normalized = typeof options === 'string' ? { gatewayUrl: options } : options;
    this.gatewayUrl = normalized.gatewayUrl || process.env.ALLTERNIT_COMPUTER_USE_URL || process.env.Allternit_COMPUTER_USE_URL || 'http://127.0.0.1:8760';
    this.fetchImpl = normalized.fetch ?? globalThis.fetch;
    this.displayWidthPx = normalized.displayWidthPx ?? 1024;
    this.displayHeightPx = normalized.displayHeightPx ?? 768;
    this.displayNumber = normalized.displayNumber;
  }

  public getTool(): ToolDefinition {
    return {
      ...COMPUTER_USE_TOOL,
      metadata: {
        ...COMPUTER_USE_TOOL.metadata,
        display_width_px: this.displayWidthPx,
        display_height_px: this.displayHeightPx,
        ...(this.displayNumber === undefined ? {} : { display_number: this.displayNumber }),
      },
      execute: this.execute.bind(this)
    };
  }

  public async execute(args: ComputerUseInput): Promise<string | Array<Record<string, unknown>>> {
    try {
      const response = await this.fetchImpl(`${this.gatewayUrl}/v1/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: args.action,
          parameters: {
            text: args.text,
            coordinate: args.coordinate,
            scroll_direction: args.scroll_direction,
            scroll_amount: args.scroll_amount,
            duration: args.duration,
          },
          family: 'desktop'
        })
      });

      if (!response.ok) {
        throw new Error(`Computer Use gateway error: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      if (args.action === 'screenshot') {
        const screenshot = typeof data.screenshot === 'string' ? data.screenshot : typeof data.data === 'string' ? data.data : undefined;
        if (!screenshot) throw new Error('Computer Use gateway returned no screenshot data');
        return [{
          type: 'image',
          source: {
            type: 'base64',
            media_type: typeof data.media_type === 'string' ? data.media_type : 'image/png',
            data: screenshot.replace(/^data:image\/[^;]+;base64,/, ''),
          },
        }];
      }
      return typeof data.summary === 'string' ? data.summary : `Action ${args.action} completed.`;
    } catch (error) {
      return `Error executing computer action: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
