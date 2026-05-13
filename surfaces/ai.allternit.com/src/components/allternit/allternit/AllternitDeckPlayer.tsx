/**
 * AllternitDeckPlayer Component
 * 
 * High-fidelity presentation player for Allternit AI decks.
 * Wraps Reveal.js with Allternit-native theming and branding.
 * All user-facing labels say "Allternit Deck" not "Reveal.js".
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
// @ts-ignore
import 'reveal.js/dist/theme/black.css';
import { 
  Play, 
  Pause, 
  CaretLeft, 
  CaretRight, 
  Monitor, 
  Layout, 
  X,
  CornersOut,
  CornersIn,
  GridFour,
  DownloadSimple,
} from '@phosphor-icons/react';
import { GlassCard } from '../../design/glass/GlassCard';

interface Slide {
  id: string;
  title: string;
  content: string;
  notes?: string;
  background?: string;
}

interface AllternitDeckPlayerProps {
  slides: Slide[];
  title?: string;
  currentSlide?: number;
  onSlideChange?: (index: number) => void;
  className?: string;
  theme?: 'allternit-dark' | 'allternit-light' | 'allternit-glass';
  showToolbar?: boolean;
  enablePresenterMode?: boolean;
}

export function AllternitDeckPlayer({
  slides,
  title = 'Untitled Presentation',
  currentSlide: controlledSlide,
  onSlideChange,
  className,
  theme = 'allternit-dark',
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
      if (revealRef.current) {
        try {
          revealRef.current.destroy();
        } catch (e) {
          // ignore
        }
        revealRef.current = null;
      }
    };
  }, []);

  // Sync controlled slide index
  useEffect(() => {
    if (revealRef.current && controlledSlide !== undefined && controlledSlide !== currentIndex) {
      revealRef.current.slide(controlledSlide);
    }
  }, [controlledSlide]);

  const totalSlides = slides.length;
  const progress = totalSlides > 0 ? ((currentIndex + 1) / totalSlides) * 100 : 0;

  const handlePrev = () => revealRef.current?.prev();
  const handleNext = () => revealRef.current?.next();
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      deckRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div className={`allternit-deck-container relative w-full h-full bg-[#111] overflow-hidden ${className}`}>
      {/* Deck Main View */}
      <div className="reveal h-full w-full" ref={deckRef}>
        <div className="slides">
          {slides.map((slide) => (
            <section 
              key={slide.id} 
              data-background-color={slide.background || '#111'}
              className="allternit-slide"
            >
              <div className="slide-content p-10">
                <h2 className="text-4xl font-bold text-white mb-8">{slide.title}</h2>
                <div className="text-xl text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: slide.content }} />
              </div>
              {slide.notes && <aside className="notes">{slide.notes}</aside>}
            </section>
          ))}
        </div>
      </div>

      {/* Custom Controls Overlays */}
      <AnimatePresence>
        {showToolbar && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6 pointer-events-none">
            <GlassCard className="p-3 flex items-center justify-between pointer-events-auto shadow-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrev} 
                  disabled={currentIndex === 0}
                  className="size-10 rounded-lg bg-white/5 border-none text-white cursor-pointer flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <CaretLeft size={20} weight="bold" />
                </button>
                <div className="text-sm font-bold text-white tabular-nums px-2">
                  {currentIndex + 1} <span className="opacity-40">/</span> {totalSlides}
                </div>
                <button 
                  onClick={handleNext} 
                  disabled={currentIndex === totalSlides - 1}
                  className="size-10 rounded-lg bg-white/5 border-none text-white cursor-pointer flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <CaretRight size={20} weight="bold" />
                </button>
              </div>

              {/* Progress Track */}
              <div className="flex-1 mx-6 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowGrid(!showGrid)}
                  className={`size-10 rounded-lg border-none cursor-pointer flex items-center justify-center transition-colors ${showGrid ? 'bg-[var(--accent-primary)] text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  title="Slide Grid"
                >
                  <GridFour size={20} />
                </button>
                <button 
                  onClick={toggleFullscreen}
                  className="size-10 rounded-lg bg-white/5 border-none text-white cursor-pointer flex items-center justify-center hover:bg-white/10 transition-colors"
                  title="Fullscreen"
                >
                  {isFullscreen ? <CornersIn size={20} /> : <CornersOut size={20} />}
                </button>
              </div>
            </GlassCard>
          </div>
        )}
      </AnimatePresence>

      {/* Deck Title Header */}
      <div className="absolute top-6 left-6 z-50 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center text-white shadow-lg">
            <Monitor size={18} weight="fill" />
          </div>
          <div>
            <h1 className="m-0 text-sm font-black text-white uppercase tracking-widest">{title}</h1>
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Allternit AI Deck • v1.2</div>
          </div>
        </div>
      </div>
    </div>
  );
}
