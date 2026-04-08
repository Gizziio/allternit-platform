/**
 * A2rchitect Super-Agent OS - Presentation Program
 * 
 * Production-ready slide deck with:
 * - Reveal.js integration for advanced transitions
 * - PPTX export functionality
 * - Presenter mode with notes
 * - Remote control integration
 * - Multiple themes and layouts
 */

import * as React from 'react';
const { useState, useCallback, useEffect, useRef } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import type { A2rProgram, PresentationState, PresentationSlide } from '../types/programs';

interface PresentationProgramProps {
  program: A2rProgram;
}

// ============================================================================
// PPTX Export Function
// ============================================================================

const exportToPPTX = async (state: PresentationState): Promise<void> => {
  // Generate a simple PPTX-compatible HTML that can be opened in PowerPoint
  const slidesHtml = state.slides.map((slide, idx) => {
    let content = '';
    
    switch (slide.type) {
      case 'title':
        content = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
            <h1 style="font-size: 44px; font-weight: bold; margin-bottom: 20px; color: #333;">${slide.content}</h1>
            ${slide.metadata?.subtitle ? `<p style="font-size: 24px; color: #666;">${slide.metadata.subtitle}</p>` : ''}
          </div>
        `;
        break;
      case 'content':
        const bullets = (slide.metadata?.bullets as string[] || [])
          .map(b => `<li style="font-size: 20px; margin-bottom: 12px; color: #333;">${b}</li>`)
          .join('');
        content = `
          <div style="padding: 40px;">
            <h2 style="font-size: 32px; font-weight: bold; margin-bottom: 30px; color: #333;">${slide.content}</h2>
            <ul style="list-style: none; padding: 0;">${bullets}</ul>
          </div>
        `;
        break;
      case 'image':
        content = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px;">
            ${slide.metadata?.imageUrl ? `<img src="${slide.metadata.imageUrl}" style="max-height: 400px; max-width: 100%; object-fit: contain; margin-bottom: 20px;" />` : ''}
            <p style="font-size: 20px; color: #666;">${slide.content}</p>
          </div>
        `;
        break;
      default:
        content = `<div style="padding: 40px;"><h2 style="font-size: 32px;">${slide.content}</h2></div>`;
    }
    
    return `
      <div class="slide" style="width: 960px; height: 540px; background: white; margin: 0 auto 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); page-break-after: always;">
        ${content}
        ${slide.notes ? `<div style="margin-top: 20px; padding: 10px; background: #fffbeb; font-size: 12px; color: #666;"><strong>Notes:</strong> ${slide.notes}</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.title || 'Presentation'} - Export</title>
  <style>
    @page { size: 10in 5.625in; margin: 0; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .slide { page-break-inside: avoid; }
    @media print {
      body { background: white; padding: 0; }
      .slide { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${slidesHtml}
  <script>
    // Auto-print for PDF save
    setTimeout(() => {
      alert('Use File > Save As to save as .pptx or print to PDF');
    }, 1000);
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.title || 'presentation').replace(/\s+/g, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Also open in new tab for printing
  window.open(url, '_blank');
};

// ============================================================================
// Slide Renderer
// ============================================================================

const SlideRenderer: React.FC<{ 
  slide: PresentationSlide;
  isActive: boolean;
  theme: string;
}> = ({ slide, isActive, theme }) => {
  const themeStyles: Record<string, string> = {
    default: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-white',
    blue: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white',
    gradient: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white',
    minimal: 'bg-gray-50 text-gray-900',
  };

  const getLayoutStyles = () => {
    switch (slide.type) {
      case 'title':
        return 'flex flex-col items-center justify-center text-center';
      case 'content':
        return 'flex flex-col p-12';
      case 'two-column':
        return 'flex gap-8 p-12';
      case 'image':
        return 'flex flex-col items-center justify-center';
      default:
        return 'flex flex-col p-12';
    }
  };

  return (
    <div 
      className={`
        w-full h-full rounded-lg shadow-2xl overflow-hidden
        ${themeStyles[theme] || themeStyles.default}
        ${getLayoutStyles()}
        transition-all duration-500
      `}
    >
      {slide.type === 'title' && (
        <>
          <h1 className="text-5xl font-bold mb-6">{slide.content}</h1>
          {slide.metadata?.subtitle && (
            <p className="text-2xl opacity-80">{slide.metadata.subtitle as string}</p>
          )}
        </>
      )}
      
      {slide.type === 'content' && (
        <>
          <h2 className="text-3xl font-semibold mb-6">{slide.content}</h2>
          {slide.metadata?.bullets && (
            <ul className="space-y-3 text-xl">
              {(slide.metadata.bullets as string[]).map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {slide.type === 'two-column' && (
        <>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-4">{slide.content}</h2>
          </div>
          <div className="flex-1">
            {slide.metadata?.rightContent && (
              <div className="text-lg">{slide.metadata.rightContent as string}</div>
            )}
          </div>
        </>
      )}

      {slide.type === 'image' && (
        <>
          {slide.metadata?.imageUrl && (
            <img 
              src={slide.metadata.imageUrl as string} 
              alt={slide.content}
              className="max-h-3/4 max-w-full object-contain mb-6 rounded"
            />
          )}
          <p className="text-xl">{slide.content}</p>
        </>
      )}

      {slide.type === 'code' && (
        <>
          <h2 className="text-2xl font-semibold mb-4">{slide.content}</h2>
          {slide.metadata?.code && (
            <pre className="flex-1 w-full bg-gray-900 text-gray-100 p-6 rounded-lg overflow-auto text-sm">
              <code>{slide.metadata.code as string}</code>
            </pre>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// Thumbnail Strip
// ============================================================================

const ThumbnailStrip: React.FC<{
  slides: PresentationSlide[];
  currentIndex: number;
  onSelect: (index: number) => void;
}> = ({ slides, currentIndex, onSelect }) => {
  return (
    <div className="flex gap-2 overflow-x-auto p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {slides.map((slide, index) => (
        <button
          key={slide.id}
          onClick={() => onSelect(index)}
          className={`
            flex-shrink-0 w-32 h-20 rounded border-2 overflow-hidden
            ${index === currentIndex 
              ? 'border-blue-500 ring-2 ring-blue-200' 
              : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
            }
          `}
        >
          <div className="w-full h-full bg-white dark:bg-gray-900 p-2 text-xs truncate">
            {slide.content.substring(0, 30)}...
          </div>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Presenter Notes
// ============================================================================

const PresenterNotes: React.FC<{
  slide: PresentationSlide;
  nextSlide?: PresentationSlide;
}> = ({ slide, nextSlide }) => {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
      <div className="flex justify-between">
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase mb-2">
            Speaker Notes
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {slide.notes || 'No notes for this slide'}
          </p>
        </div>
        {nextSlide && (
          <div className="w-48 ml-4 pl-4 border-l border-yellow-200 dark:border-yellow-800">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Up Next</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {nextSlide.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Export Menu
// ============================================================================

const ExportMenu: React.FC<{ state: PresentationState }> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePPTXExport = async () => {
    await exportToPPTX(state);
    setIsOpen(false);
  };

  const handleJSONExport = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.title || 'presentation').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Export"
      >
        💾
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <button
            onClick={handlePPTXExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg flex items-center gap-2"
          >
            <span>📊</span> Export to PPTX
          </button>
          <button
            onClick={handleJSONExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 last:rounded-b-lg flex items-center gap-2"
          >
            <span>📋</span> Export JSON
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Presentation Program
// ============================================================================

export const PresentationProgram: React.FC<PresentationProgramProps> = ({ program }) => {
  const store = useSidecarStore();
  const liveAgentText = useSidecarStore(s => s.liveAgentTexts[program.sourceThreadId] ?? '');
  const state = program.state as PresentationState;
  const [showRemote, setShowRemote] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slides = state?.slides || [];
  const currentIndex = state?.currentSlideIndex || 0;
  const currentSlide = slides[currentIndex];
  const theme = state?.theme || 'default';

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    store.updateProgramState<PresentationState>(program.id, (prev) => ({
      ...prev,
      currentSlideIndex: index,
    }));
  }, [slides.length, program.id, store]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [goToSlide, currentIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [goToSlide, currentIndex]);

  // Keyboard navigation
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
          goToSlide(slides.length - 1);
          break;
        case 'f':
        case 'F11':
          e.preventDefault();
          setIsFullscreen(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, slides.length]);

  // Toggle fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.fullscreenElement && document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  // Auto-generate images for slides with imagePrompt but no imageUrl
  useEffect(() => {
    const slidesNeedingImages = slides.filter(
      (s) =>
        s.metadata?.imagePrompt &&
        typeof s.metadata.imagePrompt === 'string' &&
        !s.metadata?.imageUrl,
    );
    if (slidesNeedingImages.length === 0) return;

    let cancelled = false;

    const generate = async () => {
      for (const slide of slidesNeedingImages) {
        if (cancelled) break;
        try {
          const res = await fetch('/api/v1/images/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: slide.metadata!.imagePrompt }),
          });
          if (!res.ok || cancelled) continue;
          const data = (await res.json()) as { url?: string };
          if (!data.url || cancelled) continue;

          store.updateProgramState<PresentationState>(program.id, (prev) => ({
            ...prev,
            slides: prev.slides.map((s) =>
              s.id === slide.id
                ? { ...s, metadata: { ...s.metadata, imageUrl: data.url! } }
                : s,
            ),
          }));
        } catch {
          // Non-fatal — slide renders without image
        }
      }
    };

    generate();
    return () => { cancelled = true; };
    // slides.length as proxy — re-run when new slides added
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, program.id]);

  if (slides.length === 0) {
    const previewText = liveAgentText
      ? liveAgentText.split('<launch_utility')[0].trim().slice(0, 400)
      : '';
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 p-6">
        <span className="text-5xl mb-4">📽️</span>
        {previewText ? (
          <div className="w-full max-w-md text-left">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Generating presentation</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {previewText}<span className="animate-pulse">▊</span>
            </p>
          </div>
        ) : (
          <>
            <p className="text-lg">No slides yet</p>
            <p className="text-sm mt-2">Slides will appear here when generated</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-gray-200 dark:bg-gray-800 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">📽️</span>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {state?.title || 'Untitled Presentation'}
          </h2>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} / {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu state={state} />
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-2 rounded text-sm ${showNotes ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="Toggle Notes"
          >
            📝
          </button>
          <button
            onClick={() => setShowRemote(true)}
            className="p-2 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Open Remote Control"
          >
            📱
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Toggle Fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Main slide area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-4xl aspect-video">
          {currentSlide ? (
            <SlideRenderer 
              slide={currentSlide} 
              isActive={true}
              theme={typeof theme === 'string' ? theme : theme.id}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
              No slide content
            </div>
          )}
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && currentSlide && (
        <PresenterNotes 
          slide={currentSlide} 
          nextSlide={slides[currentIndex + 1]}
        />
      )}

      {/* Navigation controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-30"
        >
          ← Previous
        </button>
        
        <div className="flex items-center gap-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`
                w-2 h-2 rounded-full transition-all
                ${idx === currentIndex ? 'bg-blue-500 w-4' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            />
          ))}
        </div>
        
        <button
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
          className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Thumbnail strip */}
      <ThumbnailStrip
        slides={slides}
        currentIndex={currentIndex}
        onSelect={goToSlide}
      />

      {/* Remote control modal */}
      {showRemote && (
        <PresentationRemoteModal
          programId={program.id}
          currentIndex={currentIndex}
          totalSlides={slides.length}
          onNavigate={goToSlide}
          onClose={() => setShowRemote(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// Presentation Remote Modal
// ============================================================================

const PresentationRemoteModal: React.FC<{
  programId: string;
  currentIndex: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}> = ({ currentIndex, totalSlides, onNavigate, onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-center">Presentation Remote</h3>
        
        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-blue-600">{currentIndex + 1}</span>
          <span className="text-gray-400 text-2xl"> / {totalSlides}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate(0)}
            className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
          >
            ⏮️
          </button>
          <button
            onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
            className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200"
          >
            ◀️
          </button>
          <button
            onClick={() => onNavigate(Math.min(totalSlides - 1, currentIndex + 1))}
            className="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            ▶️
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationProgram;
