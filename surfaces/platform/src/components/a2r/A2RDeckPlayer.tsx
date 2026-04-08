/**
 * AllternitDeckPlayer.tsx
 * 
 * A2R-native presentation deck wrapping Reveal.js.
 * PowerPoint-style slides with A2R theming.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/reveal.css';
import {
  CaretLeft,
  CaretRight,
  SquaresFour,
  Play,
  DownloadSimple,
  ShareNetwork,
  DotsThreeOutline,
  MonitorPlay,
  Presentation,
  Palette,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
  id: string;
  type: 'title' | 'content' | 'split' | 'image' | 'quote' | 'code';
  title: string;
  content?: string[];
  subtitle?: string;
  imageUrl?: string;
  code?: string;
  language?: string;
  background?: string;
}

interface AllternitDeckPlayerProps {
  /** Array of slides */
  slides: Slide[];
  /** Deck title */
  title?: string;
  /** Current slide index (controlled) */
  currentSlide?: number;
  /** Callback when slide changes */
  onSlideChange?: (index: number) => void;
  /** Optional className */
  className?: string;
  /** Theme name */
  theme?: 'a2r-dark' | 'a2r-light' | 'a2r-amber';
  /** Show/hide toolbar */
  showToolbar?: boolean;
  /** Enable presenter mode */
  enablePresenterMode?: boolean;
}

/**
 * A2R Deck Player
 * 
 * Wraps Reveal.js with A2R-native theming and branding.
 * All user-facing labels say "A2R Deck" not "Reveal.js".
 */
export function AllternitDeckPlayer({
  slides,
  title = 'Untitled Presentation',
  currentSlide: controlledSlide,
  onSlideChange,
  className,
  theme = 'a2r-dark',
  showToolbar = true,
  enablePresenterMode = true,
}: AllternitDeckPlayerProps) {
  const deckRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(controlledSlide || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [activeTheme, setActiveTheme] = useState(theme);

  // Initialize Reveal.js
  useEffect(() => {
    if (!deckRef.current) return;

    const deck = new Reveal(deckRef.current, {
      hash: true,
      slideNumber: 'c/t',
      showSlideNumber: 'all',
      transition: 'slide',
      transitionSpeed: 'default',
      backgroundTransition: 'fade',
      controls: false, // We build custom controls
      progress: false, // Custom progress
      center: true,
      width: 1280,
      height: 720,
      margin: 0.04,
    });

    deck.initialize().then(() => {
      revealRef.current = deck;

      // Listen for slide changes
      deck.on('slidechanged', (event: any) => {
        const newIndex = event.indexh;
        setCurrentIndex(newIndex);
        onSlideChange?.(newIndex);
      });

      // Sync with controlled prop
      if (controlledSlide !== undefined) {
        deck.slide(controlledSlide);
      }
    });

    return () => {
      deck.destroy();
    };
  }, []);

  // Sync with controlled prop
  useEffect(() => {
    if (revealRef.current && controlledSlide !== undefined && controlledSlide !== currentIndex) {
      revealRef.current.slide(controlledSlide);
    }
  }, [controlledSlide, currentIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    revealRef.current?.prev();
  }, []);

  const goToNext = useCallback(() => {
    revealRef.current?.next();
  }, []);

  const goToSlide = useCallback((index: number) => {
    revealRef.current?.slide(index);
    setShowGrid(false);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      deckRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Export to PDF (Reveal.js feature)
  const exportPDF = useCallback(() => {
    window.open(`?print-pdf`, '_blank');
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGrid) {
        if (e.key === 'Escape') setShowGrid(false);
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          goToNext();
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGrid, isFullscreen, goToPrevious, goToNext, toggleFullscreen]);

  // Theme classes
  const themeClasses = {
    'a2r-dark': 'a2r-deck-dark',
    'a2r-light': 'a2r-deck-light',
    'a2r-amber': 'a2r-deck-amber',
  };

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333]",
        className
      )}
    >
      {/* A2R Deck Toolbar */}
      {showToolbar && (
        <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e] z-10">
          <div className="flex items-center gap-3">
            <Presentation className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-sm font-medium text-[#ECECEC] truncate max-w-[200px]">
              {title}
            </span>
            <span className="text-xs text-[#666]">
              {slides.length} slides
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme selector */}
            <select
              value={activeTheme}
              onChange={(e) => setActiveTheme(e.target.value as any)}
              className="bg-[#1a1a1a] border border-[#333] text-[#888] text-xs rounded px-2 py-1 outline-none focus:border-[#D4956A]"
            >
              <option value="a2r-dark">A2R Dark</option>
              <option value="a2r-light">A2R Light</option>
              <option value="a2r-amber">A2R Amber</option>
            </select>

            {/* Grid view */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                "h-7 text-[#888] hover:text-[#ECECEC]",
                showGrid && "text-[#D4956A] bg-[#D4956A]/10"
              )}
            >
              <SquaresFour size={16} />
            </Button>

            {/* Present mode */}
            {enablePresenterMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-7 text-[#888] hover:text-[#ECECEC]"
              >
                <MonitorPlay size={16} />
              </Button>
            )}

            {/* Export */}
            <Button
              variant="ghost"
              size="sm"
              onClick={exportPDF}
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <DownloadSimple size={16} />
            </Button>

            {/* Share */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <ShareNetwork size={16} />
            </Button>

            {/* More */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[#888] hover:text-[#ECECEC]"
            >
              <DotsThreeOutline size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Reveal.js Deck */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={deckRef} 
          className={cn("reveal h-full w-full", themeClasses[activeTheme])}
        >
          <div className="slides">
            {slides.map((slide, index) => (
              <section
                key={slide.id}
                data-background={slide.background}
                className={cn(
                  "a2r-slide",
                  slide.type === 'title' && 'a2r-slide-title',
                  slide.type === 'split' && 'a2r-slide-split',
                  slide.type === 'quote' && 'a2r-slide-quote',
                )}
              >
                {renderSlideContent(slide)}
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="h-14 border-t border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e]">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="text-[#888] hover:text-[#ECECEC] disabled:opacity-30"
        >
          <CaretLeft className="w-4 h-4 mr-1" />
          <span className="text-xs">Previous</span>
        </Button>

        {/* Slide indicators */}
        <div className="flex items-center gap-1">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentIndex
                  ? "bg-[#D4956A] w-4"
                  : "bg-[#333] hover:bg-[#444]"
              )}
              title={`Slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[#666]">
            {currentIndex + 1} / {slides.length}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={currentIndex === slides.length - 1}
            className="text-[#888] hover:text-[#ECECEC] disabled:opacity-30"
          >
            <span className="text-xs mr-1">Next</span>
            <CaretRight size={16} />
          </Button>
        </div>
      </div>

      {/* Grid view overlay */}
      {showGrid && (
        <div 
          className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm p-8 overflow-auto"
          onClick={() => setShowGrid(false)}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(index);
                }}
                className={cn(
                  "aspect-video rounded-lg border-2 overflow-hidden transition-all text-left",
                  index === currentIndex
                    ? "border-[#D4956A] bg-[#1a1a1a]"
                    : "border-[#333] bg-[#242424] hover:border-[#444]"
                )}
              >
                <div className="p-4">
                  <div className="text-xs font-medium text-[#666] mb-2">
                    {index + 1}
                  </div>
                  <div className="text-sm font-semibold text-[#ECECEC] truncate">
                    {slide.title}
                  </div>
                  {slide.subtitle && (
                    <div className="text-xs text-[#666] truncate mt-1">
                      {slide.subtitle}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Render slide content based on type
 */
function renderSlideContent(slide: Slide) {
  switch (slide.type) {
    case 'title':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <h1 className="text-5xl font-bold text-[#ECECEC] mb-4">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="text-xl text-[#888]">{slide.subtitle}</p>
          )}
        </div>
      );

    case 'quote':
      return (
        <div className="flex flex-col items-center justify-center h-full p-12">
          <div className="text-6xl text-[#D4956A] mb-6">"</div>
          <blockquote className="text-2xl text-[#ECECEC] italic text-center max-w-3xl">
            {slide.content?.join(' ')}
          </blockquote>
          <div className="text-lg text-[#888] mt-8">— {slide.title}</div>
        </div>
      );

    case 'split':
      return (
        <div className="grid grid-cols-2 gap-8 h-full p-8">
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-[#ECECEC] mb-6">
              {slide.title}
            </h2>
            <ul className="space-y-3">
              {slide.content?.map((item, i) => (
                <li key={i} className="text-[#b8b8b8] flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4956A] mt-2 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-center bg-[#141414] rounded-lg">
            {slide.imageUrl ? (
              <img 
                src={slide.imageUrl} 
                alt="" 
                className="max-w-full max-h-full object-contain rounded-lg" 
              />
            ) : (
              <div className="text-[#444]">Image</div>
            )}
          </div>
        </div>
      );

    case 'code':
      return (
        <div className="flex flex-col h-full p-8">
          <h2 className="text-2xl font-bold text-[#ECECEC] mb-4">
            {slide.title}
          </h2>
          <pre className="flex-1 bg-[#0d0d0d] rounded-lg p-6 overflow-auto">
            <code className="text-sm font-mono text-[#ECECEC]">
              {slide.code}
            </code>
          </pre>
        </div>
      );

    case 'content':
    default:
      return (
        <div className="flex flex-col h-full p-8">
          <h2 className="text-3xl font-bold text-[#ECECEC] mb-8">
            {slide.title}
          </h2>
          <div className="flex-1">
            <ul className="space-y-4">
              {slide.content?.map((item, i) => (
                <li key={i} className="text-[#b8b8b8] text-lg flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#D4956A] mt-2.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }
}

export default AllternitDeckPlayer;
