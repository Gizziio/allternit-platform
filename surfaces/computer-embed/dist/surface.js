/**
 * Pixel target for the RFB client. Implementations keep an RGBA shadow
 * buffer so CopyRect encoding is a pure in-memory copy (no canvas readback).
 */
/**
 * In-memory recording surface used by tests (and usable headless anywhere).
 * Pixels land in `pixels`, a width*height*4 RGBA buffer.
 */
export class MemorySurface {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.pixels = new Uint8ClampedArray(0);
        this.resizeCalls = [];
        this.commitCount = 0;
    }
    resize(width, height) {
        this.resizeCalls.push({ width, height });
        const next = new Uint8ClampedArray(width * height * 4);
        // Preserve overlapping content across resizes, like a real framebuffer.
        const copyW = Math.min(width, this.width);
        const copyH = Math.min(height, this.height);
        for (let row = 0; row < copyH; row++) {
            next.set(this.pixels.subarray(row * this.width * 4, row * this.width * 4 + copyW * 4), row * width * 4);
        }
        this.pixels = next;
        this.width = width;
        this.height = height;
    }
    drawRect(x, y, width, height, rgba) {
        for (let row = 0; row < height; row++) {
            const dst = ((y + row) * this.width + x) * 4;
            this.pixels.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), dst);
        }
    }
    copyRect(sx, sy, w, h, dx, dy) {
        const copy = new Uint8ClampedArray(w * h * 4);
        for (let row = 0; row < h; row++) {
            copy.set(this.pixels.subarray(((sy + row) * this.width + sx) * 4, ((sy + row) * this.width + sx + w) * 4), row * w * 4);
        }
        this.drawRect(dx, dy, w, h, copy);
    }
    commit() {
        this.commitCount += 1;
    }
    /** Test helper: RGBA tuple at (x, y). */
    pixelAt(x, y) {
        const i = (y * this.width + x) * 4;
        return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2], this.pixels[i + 3]];
    }
}
/**
 * Browser canvas surface. Batches pixels into one ImageData committed to the
 * 2D context, and keeps the same buffer as the CopyRect readback source.
 */
export function createCanvasSurface(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("2D canvas context is not available");
    let image = null;
    let width = 0;
    let height = 0;
    return {
        resize(w, h) {
            width = w;
            height = h;
            canvas.width = w;
            canvas.height = h;
            image = ctx.createImageData(w, h);
        },
        drawRect(x, y, w, h, rgba) {
            if (!image)
                return;
            for (let row = 0; row < h; row++) {
                const dst = ((y + row) * width + x) * 4;
                image.data.set(rgba.subarray(row * w * 4, (row + 1) * w * 4), dst);
            }
        },
        copyRect(sx, sy, w, h, dx, dy) {
            if (!image)
                return;
            const copy = new Uint8ClampedArray(w * h * 4);
            for (let row = 0; row < h; row++) {
                copy.set(image.data.subarray(((sy + row) * width + sx) * 4, ((sy + row) * width + sx + w) * 4), row * w * 4);
            }
            this.drawRect(dx, dy, w, h, copy);
        },
        commit() {
            if (image)
                ctx.putImageData(image, 0, 0);
        },
    };
}
//# sourceMappingURL=surface.js.map