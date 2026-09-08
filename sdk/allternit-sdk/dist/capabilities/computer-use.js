export const COMPUTER_20250124_ACTIONS = [
    'key', 'type', 'mouse_move', 'left_click', 'left_click_drag',
    'right_click', 'middle_click', 'double_click', 'triple_click',
    'left_mouse_down', 'left_mouse_up', 'screenshot', 'cursor_position',
    'scroll', 'hold_key', 'wait',
];
/** The 20251124 action set adds `zoom`; the tool must also be created with
 * `enableZoom: true` so the model is allowed to emit that action. */
export const COMPUTER_20251124_ACTIONS = [...COMPUTER_20250124_ACTIONS, 'zoom'];
function buildComputerInputSchema(version) {
    const actions = version === '20251124' ? COMPUTER_20251124_ACTIONS : COMPUTER_20250124_ACTIONS;
    return {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: [...actions],
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
            ...(version === '20251124' ? {
                region: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 4,
                    maxItems: 4,
                    description: 'The absolute [x1, y1, x2, y2] pixel region for the "zoom" action (top-left and bottom-right corners)'
                },
            } : {}),
            scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Direction for scroll' },
            scroll_amount: { type: 'integer', description: 'Number of scroll ticks' },
            duration: { type: 'number', description: 'Duration in seconds for hold_key and wait' },
        },
        required: ['action']
    };
}
export const COMPUTER_USE_TOOL = {
    name: 'computer',
    description: 'Control the mouse and keyboard, and capture screenshots to interact with the computer.',
    input_schema: buildComputerInputSchema('20250124'),
    metadata: {
        category: 'vision',
        isDestructive: true,
        requiresVision: true,
        // Vendor-neutral Allternit branding (design decision D3). `anthropicType`
        // is the legacy upstream-compat adapter, kept during the transition.
        allternitToolType: 'computer',
        computerToolVersion: '20250124',
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
    gatewayUrl;
    fetchImpl;
    displayWidthPx;
    displayHeightPx;
    displayNumber;
    toolVersion;
    enableZoom;
    constructor(options = {}) {
        const normalized = typeof options === 'string' ? { gatewayUrl: options } : options;
        this.gatewayUrl = normalized.gatewayUrl || process.env.ALLTERNIT_COMPUTER_USE_URL || process.env.Allternit_COMPUTER_USE_URL || 'http://127.0.0.1:8760';
        this.fetchImpl = normalized.fetch ?? globalThis.fetch;
        this.displayWidthPx = normalized.displayWidthPx ?? 1024;
        this.displayHeightPx = normalized.displayHeightPx ?? 768;
        this.displayNumber = normalized.displayNumber;
        this.toolVersion = normalized.toolVersion ?? '20250124';
        this.enableZoom = normalized.enableZoom ?? false;
    }
    getTool() {
        return {
            ...COMPUTER_USE_TOOL,
            input_schema: buildComputerInputSchema(this.toolVersion),
            metadata: {
                ...COMPUTER_USE_TOOL.metadata,
                allternitToolType: 'computer',
                computerToolVersion: this.toolVersion,
                anthropicType: `computer_${this.toolVersion}`,
                display_width_px: this.displayWidthPx,
                display_height_px: this.displayHeightPx,
                ...(this.displayNumber === undefined ? {} : { display_number: this.displayNumber }),
                ...(this.toolVersion === '20251124' && this.enableZoom ? { enable_zoom: true } : {}),
            },
            execute: this.execute.bind(this)
        };
    }
    async execute(args) {
        try {
            const response = await this.fetchImpl(`${this.gatewayUrl}/v1/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: args.action,
                    parameters: {
                        text: args.text,
                        coordinate: args.coordinate,
                        region: args.region,
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
            const data = await response.json();
            if (args.action === 'screenshot') {
                const screenshot = typeof data.screenshot === 'string' ? data.screenshot : typeof data.data === 'string' ? data.data : undefined;
                if (!screenshot)
                    throw new Error('Computer Use gateway returned no screenshot data');
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
        }
        catch (error) {
            return `Error executing computer action: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
