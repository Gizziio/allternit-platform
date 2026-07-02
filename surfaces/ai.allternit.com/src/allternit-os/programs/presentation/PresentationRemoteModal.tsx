"use client";

import React from 'react';

interface PresentationRemoteModalProps {
  programId: string;
  currentIndex: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

export const PresentationRemoteModal: React.FC<PresentationRemoteModalProps> = ({ 
  currentIndex, 
  totalSlides, 
  onNavigate, 
  onClose 
}) => {
  return (
    <div role="button" tabIndex={0} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div role="button" tabIndex={0} 
        className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-center">Presentation Remote</h3>
        
        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-blue-600">{currentIndex + 1}</span>
          <span className="text-zinc-400 text-2xl"> / {totalSlides}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button"
            onClick={() => onNavigate(0)}
            className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200"
          >
            ⏮️
          </button>
          <button type="button"
            onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
            className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200"
          >
            ◀️
          </button>
          <button type="button"
            onClick={() => onNavigate(Math.min(totalSlides - 1, currentIndex + 1))}
            className="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            ▶️
          </button>
        </div>

        <div className="mt-6 text-center">
          <button type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
