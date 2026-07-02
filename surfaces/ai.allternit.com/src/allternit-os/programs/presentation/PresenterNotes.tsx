"use client";

import React from 'react';
import type { PresentationSlide } from '../../types/programs';

interface PresenterNotesProps {
  slide: PresentationSlide;
  nextSlide?: PresentationSlide;
}

export const PresenterNotes: React.FC<PresenterNotesProps> = ({ slide, nextSlide }) => {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
      <div className="flex justify-between">
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase mb-2">
            Speaker Notes
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {slide.notes || 'No notes for this slide'}
          </p>
        </div>
        {nextSlide && (
          <div className="w-48 ml-4 pl-4 border-l border-yellow-200 dark:border-yellow-800">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Up Next</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
              {nextSlide.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
