import type { ToolDefinition } from './types.js';
export type PdfSourceType = 'base64' | 'url' | 'path';
export interface PdfSource {
    type: PdfSourceType;
    data?: string;
    url?: string;
    path?: string;
}
export interface PdfHeading {
    level: number;
    text: string;
    page: number;
}
export interface PdfTable {
    page: number;
    rows: number;
    cols: number;
}
export interface PdfProcessResult {
    markdown: string;
    pages: number;
    thumbnails?: string[];
    structure: {
        headings: PdfHeading[];
        tables: PdfTable[];
    };
}
export interface PdfToolOptions {
    /** Maximum number of pages to render as thumbnails. */
    maxThumbnailPages?: number;
    /** Scale factor for thumbnail rendering. */
    thumbnailScale?: number;
    /** Maximum markdown text length before truncation. */
    maxTextLength?: number;
    /** Optional fetch implementation for URL sources. */
    fetch?: typeof globalThis.fetch;
}
export declare class PdfTool {
    private readonly options;
    private readonly fetchImpl;
    constructor(options?: PdfToolOptions);
    definition(): ToolDefinition;
    private execute;
    private resolveSource;
    private fetchUrl;
    private processDocument;
    private detectHeading;
    private renderThumbnail;
}
