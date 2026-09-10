/**
 * Pixel target for the RFB client. Implementations keep an RGBA shadow
 * buffer so CopyRect encoding is a pure in-memory copy (no canvas readback).
 */
export interface RfbSurface {
    /** Called when the framebuffer dimensions change (ServerInit / DesktopSize). */
    resize(width: number, height: number): void;
    /**
     * Draw one rectangle of RGBA pixels (4 bytes per pixel, row-major,
     * alpha forced to 255) with top-left corner at (x, y).
     */
    drawRect(x: number, y: number, width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): void;
    /** Copy the rectangle (sx, sy, w, h) to (dx, dy) — RFB CopyRect encoding. */
    copyRect(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void;
    /** Flush buffered changes to the visible canvas (if buffered). */
    commit(): void;
}
/**
 * In-memory recording surface used by tests (and usable headless anywhere).
 * Pixels land in `pixels`, a width*height*4 RGBA buffer.
 */
export declare class MemorySurface implements RfbSurface {
    width: number;
    height: number;
    pixels: Uint8ClampedArray<ArrayBuffer>;
    resizeCalls: Array<{
        width: number;
        height: number;
    }>;
    commitCount: number;
    resize(width: number, height: number): void;
    drawRect(x: number, y: number, width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): void;
    copyRect(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void;
    commit(): void;
    /** Test helper: RGBA tuple at (x, y). */
    pixelAt(x: number, y: number): [number, number, number, number];
}
/**
 * Browser canvas surface. Batches pixels into one ImageData committed to the
 * 2D context, and keeps the same buffer as the CopyRect readback source.
 */
export declare function createCanvasSurface(canvas: HTMLCanvasElement): RfbSurface;
