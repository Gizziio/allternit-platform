"use client";

import React, { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';

interface ArchitectLogoProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "asleep";
  size?: number;
  className?: string;
  energy?: number;
}

/**
 * ArchitectLogo - A technical, geometric persona for Allternit.
 * Moves away from hand-drawn aesthetics toward precision and structure.
 * Uses rectilinear blocks and technical crosshairs.
 */
export const ArchitectLogo = memo(({
  state,
  size = 64,
  className,
  energy: rawEnergy = 0,
}: ArchitectLogoProps) => {
  const energy = Math.max(0, Math.min(1, rawEnergy));
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  // Technical "construct" elements
  const elements = useMemo(() => {
    const count = 12;
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      // Precision variance
      const lengthMult = 0.7 + (i % 3 === 0 ? 0.5 : 0.2);
      const width = i % 2 === 0 ? 4 : 8;
      return { angle, lengthMult, width };
    });
  }, []);

  return (
    <div 
      className={cn("relative flex items-center justify-center overflow-visible", className)} 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={cn(
          "overflow-visible transition-transform duration-1000",
          isThinking && "animate-blueprint-spin"
        )}
      >
        {/* Technical Grid / Background structure (Subtle) */}
        <g opacity="0.1" className={isThinking ? "animate-pulse" : ""}>
          <circle cx="50" cy="50" r="40" stroke="currentColor" fill="none" strokeWidth="0.5" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="0.5" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.5" />
        </g>

        <g transform="translate(50, 50)">
          {/* Rectilinear "Construct" Elements */}
          {elements.map((el, i) => {
            const baseLength = 25; // Reduced from 35
            // Precise expansion when speaking
            const expansion = isSpeaking ? (1 + energy * 0.3) : 1; // Reduced from 0.5
            const length = baseLength * el.lengthMult * expansion;
            
            // Thinking state: blocks slide in and out like a sequencer
            const slide = isThinking ? Math.sin(Date.now() / 100 + i) * 5 : 0;
            
            return (
              <g key={i} transform={`rotate(${(el.angle * 180) / Math.PI})`}>
                <rect
                  x="2"
                  y={-el.width / 2}
                  width={length}
                  height={el.width}
                  fill="currentColor"
                  className={cn(
                    "transition-all duration-300 ease-out",
                    !isThinking && "animate-element-breathe"
                  )}
                  style={{
                    animationDelay: `${i * 80}ms`,
                    transform: `translateX(${slide}px)`,
                    opacity: isListening ? 1 : 0.85
                  }}
                />
              </g>
            );
          })}
          
          {/* Central Technical Core - Crosshair Square */}
          <rect x="-6" y="-6" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="-2" y="-2" width="4" height="4" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
});

ArchitectLogo.displayName = "ArchitectLogo";
