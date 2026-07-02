"use client";

import React, { useState, useRef } from 'react';
import type { Annotation } from './citation-manager.types';

interface AnnotationCanvasProps {
  screenshot: string;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation?: (id: string, text: string) => void;
  onRemoveAnnotation?: (id: string) => void;
  readOnly?: boolean;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ 
  screenshot, 
  annotations, 
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation,
  readOnly 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDrawing(true);
    setStartPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || readOnly) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setCurrentRect({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || readOnly) return;
    
    if (currentRect.width > 20 && currentRect.height > 20) {
      const annotation: Annotation = {
        id: `anno-${Date.now()}`,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        text: '',
        color: '#ffeb3b',
      };
      onAddAnnotation(annotation);
    }

    setIsDrawing(false);
    setCurrentRect(null);
  };

  return (
    <div 
      ref={canvasRef}
      className="relative select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img 
        src={screenshot} 
        alt="Screenshot"
        className="w-full"
        draggable={false}
      />
      
      {/* Existing annotations */}
      {annotations.map((anno) => (
        <div
          key={anno.id}
          className="absolute border-2 border-yellow-400 bg-yellow-400/20 group cursor-default"
          style={{
            left: anno.x,
            top: anno.y,
            width: anno.width,
            height: anno.height,
          }}
        >
          {anno.text && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-zinc-900 text-white text-xs rounded shadow-lg max-w-[200px] z-10">
              {anno.text}
            </div>
          )}
          {!readOnly && onRemoveAnnotation && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveAnnotation(anno.id); }}
              className="absolute -top-2 -right-2 size-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {/* Current drawing rect */}
      {currentRect && (
        <div
          className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{
            left: currentRect.x,
            top: currentRect.y,
            width: currentRect.width,
            height: currentRect.height,
          }}
        />
      )}
    </div>
  );
};
