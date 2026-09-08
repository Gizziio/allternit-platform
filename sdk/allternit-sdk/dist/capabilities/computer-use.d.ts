import type { ToolDefinition } from '../tools/types.js';
/** Allternit Computer Use tool versions. The action sets mirror the upstream
 * `computer_20250124` / `computer_20251124` shapes that models are trained on. */
export type ComputerToolVersion = '20250124' | '20251124';
export declare const COMPUTER_20250124_ACTIONS: readonly ["key", "type", "mouse_move", "left_click", "left_click_drag", "right_click", "middle_click", "double_click", "triple_click", "left_mouse_down", "left_mouse_up", "screenshot", "cursor_position", "scroll", "hold_key", "wait"];
/** The 20251124 action set adds `zoom`; the tool must also be created with
 * `enableZoom: true` so the model is allowed to emit that action. */
export declare const COMPUTER_20251124_ACTIONS: readonly ["key", "type", "mouse_move", "left_click", "left_click_drag", "right_click", "middle_click", "double_click", "triple_click", "left_mouse_down", "left_mouse_up", "screenshot", "cursor_position", "scroll", "hold_key", "wait", "zoom"];
export type ComputerUseAction = (typeof COMPUTER_20250124_ACTIONS)[number] | (typeof COMPUTER_20251124_ACTIONS)[number];
export interface ComputerUseInput {
    action: ComputerUseAction;
    text?: string;
    coordinate?: [number, number];
    /** 20251124 only: [x1, y1, x2, y2] pixel region for the "zoom" action. */
    region?: [number, number, number, number];
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
    /** Action-set version. Defaults to '20250124'. */
    toolVersion?: ComputerToolVersion;
    /** 20251124 only: advertise the "zoom" action and emit `enable_zoom` metadata. */
    enableZoom?: boolean;
}
export declare const COMPUTER_USE_TOOL: ToolDefinition;
export declare class ComputerUseCapability {
    private readonly gatewayUrl;
    private readonly fetchImpl;
    private readonly displayWidthPx;
    private readonly displayHeightPx;
    private readonly displayNumber?;
    private readonly toolVersion;
    private readonly enableZoom;
    constructor(options?: string | ComputerUseOptions);
    getTool(): ToolDefinition;
    execute(args: ComputerUseInput): Promise<string | Array<Record<string, unknown>>>;
}
