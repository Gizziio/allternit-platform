export const COMPUTER_USE_TOOL = {
    name: 'computer',
    description: 'Control the mouse and keyboard, and capture screenshots to interact with the computer.',
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
    },
    metadata: {
        category: 'vision',
        isDestructive: true,
        requiresVision: true
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
    gatewayUrl;
    constructor(gatewayUrl) {
        this.gatewayUrl = gatewayUrl || process.env.Allternit_COMPUTER_USE_URL || "http://localhost:3010";
    }
    getTool() {
        return {
            ...COMPUTER_USE_TOOL,
            execute: this.execute.bind(this)
        };
    }
    async execute(args) {
        try {
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
                throw new Error(`Computer Use gateway error: ${response.statusText}`);
            }
            const data = await response.json();
            return data.summary || `Action ${args.action} completed.`;
        }
        catch (error) {
            return `Error executing computer action: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
