/**
 * Base Visual Capture Provider
 */

import type {
  VisualArtifact,
  VisualArtifactType,
  ImageData,
  VisualAnnotation,
} from "../types";

export interface CaptureContext {
  sessionId: string;
  verificationId: string;
  cwd: string;
  files?: string[];
  patches?: Array<{ path: string; before?: string; after: string }>;
  testFiles?: string[];
  [key: string]: unknown;
}

export interface CaptureOptions {
  outputDir: string;
  viewport?: { width: number; height: number };
  includeBase64?: boolean;
  maxDimensions?: { width: number; height: number };
  quality?: number;
}

export abstract class VisualCaptureProvider {
  abstract readonly type: VisualArtifactType;
  abstract readonly name: string;
  abstract readonly supported: boolean;
  
  protected options: CaptureOptions;
  
  constructor(options: CaptureOptions) {
    this.options = options;
  }
  
  abstract checkAvailability(): Promise<boolean>;
  abstract capture(context: CaptureContext): Promise<VisualArtifact[]>;
  
  protected generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected async createImageData(
    path: string,
    format: ImageData["format"]
  ): Promise<ImageData> {
    const fs = await import("fs/promises");
    const stats = await fs.stat(path);
    const dimensions = await this.getImageDimensions(path);
    
    const imageData: ImageData = {
      path,
      format,
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: stats.size,
    };
    
    if (this.options.includeBase64) {
      const buffer = await fs.readFile(path);
      imageData.base64 = buffer.toString("base64");
    }
    
    return imageData;
  }
  
  protected async getImageDimensions(path: string): Promise<{ width: number; height: number }> {
    return { width: 1920, height: 1080 };
  }
  
  protected createAnnotation(
    label: string,
    note: string,
    options?: Partial<VisualAnnotation>
  ): VisualAnnotation {
    return { label, note, ...options };
  }
}
