import type { ToolRegistry } from '../tools/registry.js';
export interface PowerPointSlideInput {
    path: string;
    title?: string;
    content?: string;
}
export interface PowerPointCreateResult {
    path: string;
    slideCount: number;
}
export interface PowerPointAddSlideResult {
    path: string;
    slideCount: number;
}
/**
 * Minimal PowerPoint skill that builds valid .pptx files without requiring
 * external presentation libraries.
 */
export declare class PowerPointSkill {
    readonly name = "allternit/powerpoint";
    readonly version = "0.1.0";
    readonly description = "Create and edit .pptx presentations";
    register(registry: ToolRegistry): void;
}
