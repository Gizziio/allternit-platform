"use client";

import { useState, useCallback } from "react";

export interface CaptureResult {
  success: boolean;
  url: string;
  mode: string;
  meta?: {
    title: string;
    description: string;
    colorCount: number;
    headingCount: number;
    imageCount: number;
    linkCount: number;
  };
  figmaTree?: unknown;
  error?: string;
}

export function useBrowserCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);

  const capture = useCallback(async (url: string, mode: "quick" | "deep" = "quick"): Promise<CaptureResult> => {
    setIsCapturing(true);
    try {
      const res = await fetch("/api/browser/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode }),
      });
      const data = await res.json();
      const result: CaptureResult = {
        success: res.ok && data.success,
        url,
        mode,
        meta: data.meta,
        figmaTree: data.figmaTree,
        error: data.error,
      };
      setLastResult(result);
      return result;
    } catch (err) {
      const result: CaptureResult = {
        success: false,
        url,
        mode,
        error: err instanceof Error ? err.message : "Capture failed",
      };
      setLastResult(result);
      return result;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return { capture, isCapturing, lastResult, clearResult };
}
