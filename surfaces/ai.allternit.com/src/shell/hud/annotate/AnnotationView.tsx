"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const COLORS = [
  { label: "Black", value: "#000000" },
  { label: "White", value: "#ffffff" },
  { label: "Red", value: "#ef4444" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
];

export function AnnotationView(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(COLORS[3].value);
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const isDrawingRef = useRef(false);

  const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      isDrawingRef.current = true;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [color, strokeWidth, getPoint]
  );

  const continueStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const { x, y } = getPoint(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [getPoint]
  );

  const endStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const save = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    try {
      await window.allternit?.shell?.hud?.annotation?.save(dataUrl);
    } catch (err) {
      console.error("[AnnotationView] save failed", err);
    }
  }, []);

  const close = useCallback(() => {
    window.allternit?.shell?.hud?.annotation?.close();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    const offClear = window.allternit?.shell?.hud?.annotation?.onClear?.(clearCanvas);
    return () => offClear?.();
  }, [clearCanvas]);

  const fg = "hsl(var(--foreground, 30 10% 10%))";
  const bg = "hsl(var(--background, 30 50% 97%) / 0.8)";
  const border = "hsl(var(--border, 30 10% 80%) / 0.3)";
  const accent = "var(--accent-primary, #d4b08c)";
  const accentFg = "var(--accent-primary-foreground, #1a1916)";

  return (
    <div className="fixed inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block touch-none cursor-crosshair"
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      />
      <div
        className="fixed left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full shadow-lg border backdrop-blur-md"
        style={{ backgroundColor: bg, borderColor: border, color: fg }}
      >
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              onClick={() => setColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c.value ? "scale-110 border-current" : "border-transparent"
              }`}
              style={{ backgroundColor: c.value, color: c.value === "#ffffff" ? "#000000" : c.value }}
            />
          ))}
        </div>
        <div className="w-px h-6 bg-current opacity-20" />
        <label className="flex items-center gap-2 text-xs font-medium" style={{ color: fg }}>
          Width
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24"
            style={{ accentColor: accent }}
          />
        </label>
        <div className="w-px h-6 bg-current opacity-20" />
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          style={{ color: fg }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={save}
          className="text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          style={{ color: fg }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={close}
          className="text-xs font-semibold px-3 py-1.5 rounded-md transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent, color: accentFg }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
