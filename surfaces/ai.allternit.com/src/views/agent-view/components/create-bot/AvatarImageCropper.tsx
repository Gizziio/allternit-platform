"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export const CROPPED_AVATAR_SIZE = 512;
export const MIN_SOURCE_SIZE = 256;

interface AvatarImageCropperProps {
  /** Original uploaded image as a data URL. */
  sourceDataUrl: string;
  /** Called with the final square data URL (512×512) when the user confirms. */
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Conform an uploaded image into a bot-avatar-safe square: the user drags to
 * position and zooms so the subject fills a circular/rounded avatar. Output is
 * downscaled to 512×512 so bot lists and mail/inbox assets stay lightweight.
 */
export function AvatarImageCropper({ sourceDataUrl, onConfirm, onCancel }: AvatarImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [tooSmall, setTooSmall] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const PREVIEW = 240;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      sourceRef.current = img;
      const startZoom = Math.max(1, Math.min(PREVIEW / Math.min(img.width, img.height), 3));
      setMinZoom(Math.max(1, Math.min(PREVIEW / Math.min(img.width, img.height), startZoom)));
      setZoom(startZoom);
      setOffset({ x: 0, y: 0 });
      setTooSmall(Math.min(img.width, img.height) < MIN_SOURCE_SIZE);
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = sourceRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { zoom: z, offset: off } = stateRef.current;
    const fit = Math.min(PREVIEW / img.width, PREVIEW / img.height);
    const scale = fit * z;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    ctx.drawImage(img, (PREVIEW - w) / 2 + off.x, (PREVIEW - h) / 2 + off.y, w, h);
  }, []);

  useEffect(() => {
    draw();
  }, [zoom, offset, draw]);

  const clampOffset = useCallback((x: number, y: number) => {
    const img = sourceRef.current;
    if (!img) return { x, y };
    const fit = Math.min(PREVIEW / img.width, PREVIEW / img.height);
    const scale = fit * stateRef.current.zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    const maxX = Math.max(0, (w - PREVIEW) / 2);
    const maxY = Math.max(0, (h - PREVIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const next = clampOffset(
      dragStartRef.current.ox + (e.clientX - dragStartRef.current.x),
      dragStartRef.current.oy + (e.clientY - dragStartRef.current.y),
    );
    setOffset(next);
  };

  const renderCropped = (): string | null => {
    const img = sourceRef.current;
    if (!img) return null;
    const fit = Math.min(PREVIEW / img.width, PREVIEW / img.height);
    const scale = fit * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    const sx = ((PREVIEW - w) / 2 + offset.x) / scale;
    const sy = ((PREVIEW - h) / 2 + offset.y) / scale;
    const sSize = PREVIEW / scale;

    const out = document.createElement("canvas");
    out.width = CROPPED_AVATAR_SIZE;
    out.height = CROPPED_AVATAR_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      Math.max(0, sx), Math.max(0, sy),
      Math.min(sSize, img.width), Math.min(sSize, img.height),
      0, 0, CROPPED_AVATAR_SIZE, CROPPED_AVATAR_SIZE,
    );
    return out.toDataURL("image/webp", 0.9);
  };

  return (
    <div className="space-y-3">
      <div
        className="relative mx-auto touch-none overflow-hidden rounded-2xl border border-[var(--border-default)] select-none"
        style={{ width: PREVIEW, height: PREVIEW, cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <canvas ref={canvasRef} width={PREVIEW} height={PREVIEW} className="block" />
        {/* Circular mask hint — avatars render round. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35), inset 0 0 0 999px rgba(0,0,0,0.25)" }}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[var(--text-secondary)]">Zoom</span>
        <input
          type="range"
          min={minZoom}
          max={Math.max(minZoom * 3, 4)}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
          aria-label="Zoom"
        />
      </div>

      {tooSmall && (
        <p className="text-[12px] text-[var(--status-warning)]">
          This image is small — the avatar may look blurry. 512×512 or larger works best.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-[var(--border-default)] px-3.5 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            const cropped = renderCropped();
            if (cropped) onConfirm(cropped);
          }}
          className="h-9 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] hover:opacity-90"
        >
          Use this crop
        </button>
      </div>
    </div>
  );
}
