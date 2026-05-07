import type { Tool } from '../harness/types.js';
import { AllternitClient } from '../dist/gen/allternit-client.js';

export const COMPUTER_TOOL: Tool = {
  name: 'computer',
  description: 'Control the mouse and keyboard, and capture screenshots.',
  input_schema: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['key', 'type', 'mouse_move', 'left_click', 'left_click_drag', 'right_click', 'middle_click', 'double_click', 'screenshot', 'cursor_position'],
        description: 'The computer action to perform'
      },
      text: { type: 'string', description: 'Text to type for the "type" and "key" actions' },
      coordinate: { 
        type: 'array', 
        items: { type: 'number' },
        description: 'The (x, y) coordinates for mouse actions (normalized to 1024x768)' 
      }
    },
    required: ['action']
  }
};

export class ComputerCapability {
  private gatewayUrl: string;

  constructor(private client: AllternitClient, gatewayUrl?: string) {
    this.gatewayUrl = gatewayUrl || process.env.Allternit_COMPUTER_USE_URL || "http://localhost:3010";
  }

  public getTool(): Tool {
    return COMPUTER_TOOL;
  }

  /**
   * Execute computer action via the Computer Use gateway
   */
  public async execute(args: { action: string; text?: string; coordinate?: [number, number] }): Promise<string> {
    try {
      // Coordinate Scaling logic (Placeholder: assumes gateway handles normalized coordinates)
      const response = await fetch(`${this.gatewayUrl}/v1/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: args.action,
          parameters: {
            text: args.text,
            coordinate: args.coordinate
          },
          family: 'desktop'
        })
      });

      if (!response.ok) {
        throw new Error(`Gateway error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.summary || `Action ${args.action} completed.`;
    } catch (error) {
      return `Error executing computer action: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public getPromptAddendum(): string {
    return `
COMPUTER USE:
- You can control the computer's mouse and keyboard.
- Use "computer" tool for interactions and "screenshot" action to see the screen.
- Coordinates are normalized to 1024x768.
`;
  }
}
