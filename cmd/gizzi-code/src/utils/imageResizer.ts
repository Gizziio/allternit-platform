/**
 * Image Resizer Utilities
 */

export interface ImageResizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export async function resizeImage(
  buffer: Buffer,
  options: ImageResizeOptions
): Promise<Buffer> {
  // Placeholder implementation
  return buffer
}

export function createImageMetadataText(
  dimensions: { width: number; height: number },
  size: number
): string {
  return `Image (${dimensions.width}x${dimensions.height}, ${formatFileSize(size)})`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { ImageResizeError, compressImageBlock, compressImageBuffer, compressImageBufferWithTokenLimit, detectImageFormatFromBase64, detectImageFormatFromBuffer, maybeResizeAndDownsampleImageBlock, maybeResizeAndDownsampleImageBuffer } from "../shared/utils/imageResizer.js";
export type { ImageBlockWithDimensions, ImageDimensions, ResizeResult } from "../shared/utils/imageResizer.js";
