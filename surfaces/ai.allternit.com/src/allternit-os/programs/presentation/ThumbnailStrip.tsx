"use client";

import React from 'react';
import type { PresentationSlide } from '../../types/programs';

interface ThumbnailStripProps {
  slides: PresentationSlide[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export const ThumbnailStrip: React.FC<ThumbnailStripProps> = ({ slides, currentIndex, onSelect }) => {
  return (
    <div className="flex gap-2 overflow-x-auto p-4 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
      {slides.map((slide, index) => (
        <button type="button"
          key={slide.id}
          onClick={() => onSelect(index)}
          className={`
            flex-shrink-0 w-32 h-20 rounded border-2 overflow-hidden
            ${index === currentIndex 
              ? 'border-blue-500 ring-2 ring-blue-200' 
              : 'border-zinc-300 dark:border-zinc-600 opacity-60 hover:opacity-100'
            }
          `}
        >
          <div className="w-full h-full bg-white dark:bg-zinc-900 p-2 text-xs truncate">
            {slide.content.substring(0, 30)}...
          </div>
        </button>
      ))}
    </div>
  );
};
