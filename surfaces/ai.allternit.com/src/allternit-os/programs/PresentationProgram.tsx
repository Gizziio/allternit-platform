"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSidecarStore } from '../stores/useSidecarStore';
import type { AllternitProgram, PresentationState } from '../types/programs';
import { cn } from "@/lib/utils";

// Modular components
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';
import { SlideRenderer } from './presentation/SlideRenderer';
import { ThumbnailStrip } from './presentation/ThumbnailStrip';
import { PresenterNotes } from './presentation/PresenterNotes';
import { ExportMenu } from './presentation/ExportMenu';
import { PresentationRemoteModal } from './presentation/PresentationRemoteModal';

interface PresentationProgramProps {
  program: AllternitProgram;
}

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
  }, [slides, program.id, store.updateProgramState]);

  if (slides.length === 0) {
    const previewText = liveAgentText
      ? liveAgentText.split('<launch_utility')[0].trim().slice(0, 400)
      : '';
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-zinc-400 p-6">
        <span className="text-5xl mb-4">📽️</span>
        {previewText ? (
          <div className="w-full max-w-md text-left">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Generating presentation</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {previewText}<span className="animate-pulse">▊</span>
            </p>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold">No slides yet</p>
            <p className="text-sm mt-2">Slides will appear here when generated</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full flex flex-col bg-zinc-200 dark:bg-zinc-800",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">📽️</span>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {state?.title || 'Untitled Presentation'}
          </h2>
          <span className="text-xs text-zinc-400">
            {currentIndex + 1} / {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu state={state} />
          <button type="button"
            onClick={() => setShowNotes(!showNotes)}
            className={cn(
              "p-2 rounded text-sm transition-colors",
              showNotes 
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700" 
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title="Toggle Notes"
          >
            📝
          </button>
          <button type="button"
            onClick={() => setShowRemote(true)}
            className="p-2 rounded text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Open Remote Control"
          >
            📱
          </button>
          <button type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Toggle Fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Main slide area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-4xl aspect-video">
          <ProgramErrorBoundary 
            programName="Presentation"
            onReset={() => goToSlide(currentIndex)}
          >
            {currentSlide ? (
              <SlideRenderer 
                slide={currentSlide} 
                isActive={true}
                theme={typeof theme === 'string' ? theme : theme.id}
              />
            ) : (
              <div className="w-full h-full bg-zinc-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400">
                No slide content
              </div>
            )}
          </ProgramErrorBoundary>
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
      <div className="flex items-center justify-center gap-4 p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
        <button type="button"
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium disabled:opacity-30 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          ← Previous
        </button>
        
        <div className="flex items-center gap-1.5">
          {slides.map((s, idx) => (
            <button type="button"
              key={s.id || idx}
              onClick={() => goToSlide(idx)}
              className={cn(
                "size-2 rounded-full transition-all duration-300",
                idx === currentIndex ? "bg-blue-500 w-5" : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400"
              )}
            />
          ))}
        </div>
        
        <button type="button"
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
          className="p-2 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-30 transition-all hover:bg-blue-700 shadow-md"
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

export default PresentationProgram;
