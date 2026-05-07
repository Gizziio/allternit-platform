/**
 * DrawToEditCanvas
 * 
 * Canvas-based image mask editor for AI inpainting.
 * Users draw on images to specify areas for AI modification.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PaintBrush,
  Eraser,
  ArrowCounterClockwise,
  ArrowClockwise,
  Trash,
  DownloadSimple,
  X,
  Sparkle,
  Minus,
  Plus,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DrawToEditCanvasProps {
  imageUrl: string;
  title?: string;
  onGenerate: (maskDataUrl: string, prompt: string) => Promise<void>;
  onClose: () => void;
}

interface DrawPoint {
  x: number;
  y: number;
}

export function DrawToEditCanvas({
  imageUrl,
  title = 'Edit Image',
  onGenerate,
  onClose,
}: DrawToEditCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Initialize canvas when image loads
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !canvasRef.current) return;
    
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
    
    // Clear canvas (transparent = no mask)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state
    saveHistory();
  }, []);

  // Save current state to history
  const saveHistory = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Remove any future states if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    
    // Limit history to 20 states
    if (newHistory.length > 20) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  // Clear mask
  const handleClear = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, [saveHistory]);

  // Get mouse/touch position relative to canvas
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent): DrawPoint | null => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    // Scale to canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // Start drawing
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPosition(e);
    if (!pos || !canvasRef.current) return;
    
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    // Set brush style
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    
    if (mode === 'draw') {
      // Red semi-transparent mask
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    } else {
      // Erase (make transparent)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
      ctx.globalCompositeOperation = 'destination-out';
    }
  }, [getPosition, brushSize, mode]);

  // Continue drawing
  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getPosition(e);
    if (!pos || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPosition]);

  // End drawing
  const handleEnd = useCallback(() => {
    if (!isDrawing || !canvasRef.current) return;
    
    setIsDrawing(false);
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
    }
    
    saveHistory();
  }, [isDrawing, saveHistory]);

  // Generate edited image
  const handleGenerate = async () => {
    if (!canvasRef.current || !prompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      // Get mask as data URL
      const maskDataUrl = canvasRef.current.toDataURL('image/png');
      
      // Call parent generation function
      await onGenerate(maskDataUrl, prompt);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download mask
  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `${title || 'mask'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-[var(--border-subtle)] flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-[var(--bg-primary)] flex items-center justify-center p-8">
            <div className="relative">
              {/* Original image */}
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Original"
                className="max-w-full max-h-[70vh] object-contain"
                onLoad={handleImageLoad}
              />
              
              {/* Drawing canvas overlay */}
              <canvas
                ref={canvasRef}
                className={cn(
                  "absolute inset-0 cursor-crosshair",
                  !imageLoaded && "opacity-0"
                )}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              />
              
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-[var(--text-tertiary)] text-sm">
                    Loading image...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - controls */}
          <div className="w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col">
            {/* Brush controls */}
            <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Brush Mode
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={mode === 'draw' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('draw')}
                  className={cn(
                    "flex-1",
                    mode === 'draw' && "bg-[var(--accent-primary)] text-[var(--bg-primary)]"
                  )}
                >
                  <PaintBrush className="w-4 h-4 mr-2" />
                  Draw
                </Button>
                <Button
                  variant={mode === 'erase' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('erase')}
                  className={cn(
                    "flex-1",
                    mode === 'erase' && "bg-[var(--accent-primary)] text-[var(--bg-primary)]"
                  )}
                >
                  <Eraser className="w-4 h-4 mr-2" />
                  Erase
                </Button>
              </div>

              {/* Brush size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                  <span>Brush Size</span>
                  <span>{brushSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus size={16} />
                  </Button>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full appearance-none cursor-pointer"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
                    className="h-8 w-8 p-0"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* History controls */}
            <div className="p-4 border-b border-[var(--border-subtle)] space-y-2">
              <div className="text-sm font-medium text-[var(--text-primary)]">
                History
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="flex-1 text-[var(--text-tertiary)] disabled:opacity-30"
                >
                  <ArrowCounterClockwise className="w-4 h-4 mr-2" />
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="flex-1 text-[var(--text-tertiary)] disabled:opacity-30"
                >
                  <ArrowClockwise className="w-4 h-4 mr-2" />
                  Redo
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="w-full text-[var(--text-tertiary)] hover:text-red-500"
              >
                <Trash className="w-4 h-4 mr-2" />
                Clear Mask
              </Button>
            </div>

            {/* Prompt input */}
            <div className="p-4 border-b border-[var(--border-subtle)] flex-1">
              <div className="text-sm font-medium text-[var(--text-primary)] mb-2">
                Edit Prompt
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to change...&#10;&#10;Example: &quot;Make this a latte&quot; or &quot;Remove the background&quot;"
                className="w-full h-32 p-3 text-sm bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>

            {/* Action buttons */}
            <div className="p-4 space-y-2">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:opacity-90"
              >
                <Sparkle className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDownload}
                className="w-full text-[var(--text-tertiary)]"
              >
                <DownloadSimple className="w-4 h-4 mr-2" />
                Download Mask
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 border-t border-[var(--border-subtle)] flex items-center justify-between px-6 text-xs text-[var(--text-tertiary)]">
          <span>
            Draw on the image to mark areas for editing
          </span>
          {imageLoaded && (
            <span>
              {imageSize.width} × {imageSize.height}px
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
