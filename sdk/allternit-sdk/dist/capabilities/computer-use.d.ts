import type { ToolDefinition } from '../tools/types.js';
export type ComputerUseAction = 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'triple_click' | 'left_mouse_down' | 'left_mouse_up' | 'screenshot' | 'cursor_position' | 'scroll' | 'hold_key' | 'wait';
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
export declare const COMPUTER_USE_TOOL: ToolDefinition;
export declare class ComputerUseCapability {
    private readonly gatewayUrl;
    private readonly fetchImpl;
    private readonly displayWidthPx;
    private readonly displayHeightPx;
    private readonly displayNumber?;
    constructor(options?: string | ComputerUseOptions);
    getTool(): ToolDefinition;
    execute(args: ComputerUseInput): Promise<string | Array<Record<string, unknown>>>;
}
