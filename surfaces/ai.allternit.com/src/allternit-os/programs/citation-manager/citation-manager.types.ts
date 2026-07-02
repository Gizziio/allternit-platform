export interface BrowserScreenshotOptions {
  url: string;
  fullPage?: boolean;
  selector?: string;
  width?: number;
  height?: number;
  waitFor?: number;
  hideSelectors?: string[];
}

export interface ScreenshotResult {
  id: string;
  url: string;
  screenshot: string;
  timestamp: string;
  title?: string;
  selector?: string;
  metadata?: {
    viewport: { width: number; height: number };
    userAgent: string;
    captureTime: number;
  };
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

export interface AnnotatedScreenshot extends ScreenshotResult {
  annotations: Annotation[];
}
