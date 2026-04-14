/**
 * Screenshot Capture via CDP
 * Ported from OpenClaw dist/browser/screenshot.js
 */

import { CDPClient } from './client.js';

export interface ScreenshotOptions {
  wsUrl: string;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale?: number;
  };
}

export async function captureScreenshot(options: ScreenshotOptions): Promise<Buffer> {
  const { wsUrl, fullPage = false, format = 'png', quality, clip } = options;
  
  const client = await CDPClient.connect(wsUrl);
  
  try {
    // Enable required domains
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    
    let screenshotParams: any = {
      format,
      fromSurface: true,
    };
    
    if (format === 'jpeg' && quality) {
      screenshotParams.quality = quality;
    }
    
    if (fullPage) {
      // Get page metrics for full page
      const { result } = await client.send('Runtime.evaluate', {
        expression: `
          JSON.stringify({
            width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
            height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
          })
        `,
      });
      
      const metrics = JSON.parse(result.value);
      
      // Set viewport to full page
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: metrics.width,
        height: metrics.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      
      screenshotParams.clip = {
        x: 0,
        y: 0,
        width: metrics.width,
        height: metrics.height,
        scale: 1,
      };
    } else if (clip) {
      screenshotParams.clip = clip;
    }
    
    // Capture screenshot
    const { data } = await client.send('Page.captureScreenshot', screenshotParams);
    
    // Reset device metrics if changed
    if (fullPage) {
      await client.send('Emulation.clearDeviceMetricsOverride');
    }
    
    return Buffer.from(data, 'base64');
  } finally {
    client.close();
  }
}

export interface NormalizeOptions {
  maxSide?: number;
  maxBytes?: number;
  quality?: number;
}

export async function normalizeScreenshot(
  buffer: Buffer,
  options: NormalizeOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const { maxSide = 2048, maxBytes = 5 * 1024 * 1024 } = options;
  
  // If buffer is already small enough, return as-is
  if (buffer.byteLength <= maxBytes) {
    return { buffer, contentType: 'image/png' };
  }
  
  // Try to compress using sharp if available
  try {
    const sharp = await import('sharp');
    
    let image = sharp.default(buffer);
    const metadata = await image.metadata();
    
    // Resize if needed
    if (metadata.width && metadata.height) {
      const maxDim = Math.max(metadata.width, metadata.height);
      if (maxDim > maxSide) {
        image = image.resize(maxSide, maxSide, { fit: 'inside' });
      }
    }
    
    // Try PNG first
    let output = await image.png({ compressionLevel: 9 }).toBuffer();
    
    // If still too large, try JPEG
    if (output.byteLength > maxBytes) {
      output = await image.jpeg({ quality: 85, progressive: true }).toBuffer();
    }
    
    return {
      buffer: output,
      contentType: output.byteLength > maxBytes ? 'image/jpeg' : 'image/png',
    };
  } catch {
    // Sharp not available, return original
    return { buffer, contentType: 'image/png' };
  }
}
