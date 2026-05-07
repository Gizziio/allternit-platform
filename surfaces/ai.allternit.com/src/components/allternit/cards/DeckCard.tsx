/**
 * DeckCard.tsx
 * 
 * Compact Allternit Deck card for chat thread.
 * Shows slide preview with "Open Full" option to expand to sidecar.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Presentation,
  ArrowsOut,
  CaretLeft,
  CaretRight,
  Play,
  Stack,
  Clock,
  Users,
  Eye,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
  id: string;
  number: number;
  title?: string;
  content: string;
  layout: 'title' | 'content' | 'two-column' | 'image' | 'quote';
  background?: string;
}

interface DeckCardProps {
  id: string;
  title: string;
  slides: Slide[];
  currentSlide?: number;
  metadata?: {
    author?: string;
    createdAt?: Date;
    estimatedDuration?: number;
    template?: string;
    totalViews?: number;
  };
  isLoading?: boolean;
  progress?: number;
  onOpenFull?: () => void;
  onPresent?: () => void;
  className?: string;
}

/**
 * Allternit Deck Card
 * 
 * Inline preview of an Allternit Deck presentation in the chat thread.
 * Shows current slide thumbnail with navigation.
 * "Open Full" expands to full Reveal.js player in sidecar.
 */
export function DeckCard({
  id,
  title,
  slides,
  currentSlide: initialSlide = 0,
  metadata,
  isLoading = false,
  progress = 100,
  onOpenFull,
  onPresent,
  className,
}: DeckCardProps) {
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  
  const slide = slides[currentSlide];
  const hasPrev = currentSlide > 0;
  const hasNext = currentSlide < slides.length - 1;

  const handlePrev = () => {
    if (hasPrev) setCurrentSlide(prev => prev - 1);
  };

  const handleNext = () => {
    if (hasNext) setCurrentSlide(prev => prev + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-[680px] rounded-xl overflow-hidden border border-[#333] bg-[#1a1a1a]",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#D4956A]/10 flex items-center justify-center">
            <Presentation className="w-4 h-4 text-[#D4956A]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#ECECEC]">
              Allternit Deck
            </h3>
            <div className="flex items-center gap-2 text-xs text-[#666]">
              <span className="flex items-center gap-1">
                <Stack size={12} />
                {slides.length} slides
              </span>
              {metadata?.estimatedDuration && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {metadata.estimatedDuration} min
                </span>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#333] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#D4956A]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-[#666]">{Math.round(progress)}%</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onPresent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPresent}
                className="h-7 text-[#888] hover:text-[#ECECEC] hover:bg-[#333]"
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs">Present</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFull}
              className="h-7 text-[#888] hover:text-[#ECECEC] hover:bg-[#333]"
            >
              <ArrowsOut className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Open Full</span>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[#ECECEC] mb-3">
          {title}
        </h2>

        {/* Slide Preview */}
        <div className="relative mb-4">
          {/* Slide Container */}
          <div 
            className="aspect-video rounded-lg overflow-hidden border border-[#333] bg-[#0a0a0a] relative"
            style={{ background: slide?.background || 'var(--surface-panel)' }}
          >
            {/* Slide Content */}
            <div className="absolute inset-0 p-6 flex flex-col justify-center">
              {slide?.layout === 'title' ? (
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-[#ECECEC] mb-2">
                    {slide.title}
                  </h3>
                  <p className="text-sm text-[#888]">
                    {slide.content}
                  </p>
                </div>
              ) : slide?.layout === 'content' ? (
                <div>
                  <h3 className="text-lg font-semibold text-[#ECECEC] mb-3">
                    {slide.title}
                  </h3>
                  <p className="text-sm text-[#b8b8b8] leading-relaxed line-clamp-4">
                    {slide.content}
                  </p>
                </div>
              ) : slide?.layout === 'two-column' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#D4956A] mb-2">
                      {slide.title}
                    </h3>
                  </div>
                  <div className="text-sm text-[#b8b8b8] line-clamp-4">
                    {slide.content}
                  </div>
                </div>
              ) : slide?.layout === 'image' ? (
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-lg bg-[#D4956A]/20 mx-auto mb-2 flex items-center justify-center">
                      <Eye className="w-8 h-8 text-[#D4956A]" />
                    </div>
                    <p className="text-sm text-[#888]">{slide.title}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <blockquote className="text-lg text-[#b8b8b8] italic">
                    "{slide?.content?.slice(0, 100)}..."
                  </blockquote>
                  <cite className="text-sm text-[#D4956A] mt-2 block">
                    — {slide?.title}
                  </cite>
                </div>
              )}
            </div>

            {/* Slide Number */}
            <div className="absolute bottom-3 right-3 text-xs text-[#666]">
              {currentSlide + 1} / {slides.length}
            </div>
          </div>

          {/* Navigation */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-2 pointer-events-none">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className={cn(
                "w-8 h-8 rounded-full bg-[#1e1e1e]/80 border border-[#333] flex items-center justify-center pointer-events-auto transition-colors",
                hasPrev 
                  ? "text-[#ECECEC] hover:bg-[#D4956A] hover:border-[#D4956A]" 
                  : "text-[#666] opacity-50 cursor-not-allowed"
              )}
            >
              <CaretLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext}
              className={cn(
                "w-8 h-8 rounded-full bg-[#1e1e1e]/80 border border-[#333] flex items-center justify-center pointer-events-auto transition-colors",
                hasNext 
                  ? "text-[#ECECEC] hover:bg-[#D4956A] hover:border-[#D4956A]" 
                  : "text-[#666] opacity-50 cursor-not-allowed"
              )}
            >
              <CaretRight size={16} />
            </button>
          </div>
        </div>

        {/* Thumbnail Strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {slides.slice(0, 6).map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              className={cn(
                "flex-shrink-0 w-16 aspect-video rounded border overflow-hidden transition-all",
                currentSlide === idx
                  ? "border-[#D4956A] ring-1 ring-[#D4956A]"
                  : "border-[#333] hover:border-[#666]"
              )}
            >
              <div 
                className="w-full h-full bg-[#0a0a0a] p-1"
                style={{ background: s.background || 'var(--surface-panel)' }}
              >
                <div className="text-[6px] text-[#666] line-clamp-2 text-center">
                  {s.title || `Slide ${idx + 1}`}
                </div>
              </div>
            </button>
          ))}
          {slides.length > 6 && (
            <div className="flex-shrink-0 w-16 aspect-video rounded border border-[#333] bg-[#1e1e1e] flex items-center justify-center text-xs text-[#666]">
              +{slides.length - 6}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#333]">
          <div className="flex items-center gap-3 text-xs text-[#666]">
            {metadata?.author && (
              <span className="flex items-center gap-1">
                <Users size={12} />
                {metadata.author}
              </span>
            )}
            {metadata?.createdAt && (
              <span>{formatDate(metadata.createdAt)}</span>
            )}
          </div>
          
          <span className="text-xs text-[#666]">
            {metadata?.totalViews !== undefined && (
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {formatViews(metadata.totalViews)} views
              </span>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

export default DeckCard;
