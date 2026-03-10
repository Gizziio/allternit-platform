/**
 * A2rchitect Super-Agent OS - Presentation Remote Control
 * 
 * Remote control interface for presentations with:
 * - QR code for mobile remote
 * - Keyboard shortcuts
 * - Timer
 * - Notes view
 * - Laser pointer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSidecarStore } from '../stores/useSidecarStore';
import type { PresentationState } from '../types/programs';

interface PresentationRemoteProps {
  programId: string;
  onClose: () => void;
}

// ============================================================================
// QR Code Generator (simplified)
// ============================================================================

function generateQRCodeSVG(url: string): string {
  // Simplified QR code representation
  // In production, use a library like qrcode
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="white"/>
    <rect x="10" y="10" width="25" height="25" fill="black"/>
    <rect x="65" y="10" width="25" height="25" fill="black"/>
    <rect x="10" y="65" width="25" height="25" fill="black"/>
    <rect x="15" y="15" width="15" height="15" fill="white"/>
    <rect x="70" y="15" width="15" height="15" fill="white"/>
    <rect x="15" y="70" width="15" height="15" fill="white"/>
    <rect x="18" y="18" width="9" height="9" fill="black"/>
    <rect x="73" y="18" width="9" height="9" fill="black"/>
    <rect x="18" y="73" width="9" height="9" fill="black"/>
    ${Array.from({ length: 20 }, (_, i) => 
      `<rect x="${40 + (i % 5) * 8}" y="${40 + Math.floor(i / 5) * 8}" width="6" height="6" fill="black"/>`
    ).join('')}
  </svg>`;
}

// ============================================================================
// Timer Component
// ============================================================================

const Timer: React.FC = () => {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`text-2xl font-mono font-bold ${seconds > 1800 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
        {formatTime(seconds)}
      </div>
      <button
        onClick={() => setIsRunning(!isRunning)}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
      >
        {isRunning ? '⏸️' : '▶️'}
      </button>
      <button
        onClick={() => setSeconds(0)}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
      >
        🔄
      </button>
    </div>
  );
};

// ============================================================================
// Remote Control Panel
// ============================================================================

export const PresentationRemote: React.FC<PresentationRemoteProps> = ({ 
  programId, 
  onClose 
}) => {
  const store = useSidecarStore();
  const state = store.programs[programId]?.state as PresentationState;
  const [activeTab, setActiveTab] = useState<'controls' | 'notes' | 'settings'>('controls');
  const [showQR, setShowQR] = useState(false);

  if (!state) return null;

  const currentSlide = state.slides[state.currentSlideIndex];
  const totalSlides = state.slides.length;
  const progress = totalSlides > 0 ? ((state.currentSlideIndex + 1) / totalSlides) * 100 : 0;

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= totalSlides) return;
    
    store.updateProgramState<PresentationState>(programId, (prev) => ({
      ...prev,
      currentSlideIndex: index,
    }));
  }, [programId, store, totalSlides]);

  const nextSlide = useCallback(() => {
    goToSlide(state.currentSlideIndex + 1);
  }, [goToSlide, state.currentSlideIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(state.currentSlideIndex - 1);
  }, [goToSlide, state.currentSlideIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(totalSlides - 1);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, totalSlides, onClose]);

  const remoteUrl = `https://a2r.remote/s/${programId}`;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Presenter Remote</h2>
          <span className="text-sm text-gray-400">
            {state.title}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <Timer />
          <button
            onClick={() => setShowQR(!showQR)}
            className="px-3 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm"
          >
            {showQR ? 'Hide QR' : 'Show QR'}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['controls', 'notes', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === tab 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Left: Slide Preview */}
        <div className="w-1/2 p-6 border-r border-gray-700 flex flex-col">
          <div className="flex-1 bg-gray-800 rounded-lg flex items-center justify-center p-8 overflow-hidden">
            {currentSlide ? (
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">
                  Slide {state.currentSlideIndex + 1} of {totalSlides}
                </div>
                <div className="text-2xl font-bold mb-4">
                  {currentSlide.type === 'title' ? currentSlide.content : currentSlide.type}
                </div>
                {currentSlide.type !== 'title' && (
                  <div className="text-gray-300 max-h-64 overflow-hidden">
                    {currentSlide.content.substring(0, 200)}
                    {currentSlide.content.length > 200 && '...'}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">No slides</div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-1/2 p-6">
          {activeTab === 'controls' && (
            <div className="h-full flex flex-col">
              {/* Navigation controls */}
              <div className="flex-1 flex items-center justify-center gap-8">
                <button
                  onClick={prevSlide}
                  disabled={state.currentSlideIndex === 0}
                  className="w-20 h-20 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center text-3xl"
                >
                  ←
                </button>
                
                <div className="text-center">
                  <div className="text-5xl font-bold mb-2">
                    {state.currentSlideIndex + 1}
                  </div>
                  <div className="text-gray-400">/ {totalSlides}</div>
                </div>
                
                <button
                  onClick={nextSlide}
                  disabled={state.currentSlideIndex === totalSlides - 1}
                  className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center text-3xl"
                >
                  →
                </button>
              </div>

              {/* Quick jump */}
              <div className="mt-8">
                <div className="text-sm text-gray-400 mb-2">Quick Jump</div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {state.slides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => goToSlide(idx)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium ${
                        idx === state.currentSlideIndex
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code */}
              {showQR && (
                <div className="mt-8 p-4 bg-white rounded-lg text-center">
                  <div 
                    className="w-32 h-32 mx-auto"
                    dangerouslySetInnerHTML={{ 
                      __html: generateQRCodeSVG(remoteUrl) 
                    }}
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Scan to use phone as remote
                  </p>
                  <p className="text-xs text-gray-400">{remoteUrl}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="h-full">
              <h3 className="text-lg font-medium mb-4">Speaker Notes</h3>
              {currentSlide?.notes ? (
                <div className="bg-gray-800 rounded-lg p-4 text-gray-300">
                  {currentSlide.notes}
                </div>
              ) : (
                <div className="text-gray-500 italic">No notes for this slide</div>
              )}

              {/* Upcoming slides */}
              {state.currentSlideIndex < totalSlides - 1 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Up Next</h4>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-500">
                      Slide {state.currentSlideIndex + 2}
                    </div>
                    <div className="text-gray-300">
                      {state.slides[state.currentSlideIndex + 1].content.substring(0, 100)}...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Settings</h3>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Show timer</span>
                  <input type="checkbox" defaultChecked className="rounded" />
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Show progress bar</span>
                  <input type="checkbox" defaultChecked className="rounded" />
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Enable laser pointer</span>
                  <input type="checkbox" className="rounded" />
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Auto-advance (5s)</span>
                  <input type="checkbox" className="rounded" />
                </label>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Keyboard Shortcuts</h4>
                <div className="text-sm text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Next slide</span>
                    <span className="font-mono">→ ↓ Space</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Previous slide</span>
                    <span className="font-mono">← ↑</span>
                  </div>
                  <div className="flex justify-between">
                    <span>First/Last slide</span>
                    <span className="font-mono">Home / End</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Close remote</span>
                    <span className="font-mono">ESC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresentationRemote;
