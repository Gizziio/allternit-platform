"use client";

import React, { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';

interface StarburstLogoProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "asleep";
  size?: number;
  className?: string;
  energy?: number;
}

/**
 * StarburstLogo - A 2D "hand-drawn" starburst persona
 * Inspired by Claude's aesthetic and the user-provided screenshot.
 * Uses SVG for crisp 2D rendering and organic animation.
 */
export const StarburstLogo = memo(({
  state,
  size = 64,
  className,
  energy = 0,
}: StarburstLogoProps) => {
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  // Generate the rays once to keep them stable
  const rays = useMemo(() => {
    const count = 18; // More rays for a fuller "burst" look
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      // High irregularity in ray lengths for "hand-drawn" look
      const lengthVariance = 0.6 + Math.random() * 0.6; 
      // Angle jitter to avoid perfect symmetry
      const angleJitter = (Math.random() - 0.5) * 0.2;
      // Variable stroke width for hand-drawn feel
      const strokeWidth = 4 + Math.random() * 4;
      return { angle: angle + angleJitter, variance: lengthVariance, strokeWidth };
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
          "overflow-visible",
          isThinking && "animate-spin-slow",
          isListening && "animate-pulse-subtle"
        )}
        style={{
          // Use the coral color from the screenshot: #D97757
          color: '#D97757',
          animationDuration: isThinking ? '12s' : '3s'
        }}
      >
        <g 
          transform="translate(50, 50)"
          style={{
            transform: isSpeaking ? `scale(${1 + energy * 0.4})` : 'scale(1)',
            transition: 'transform 0.1s ease-out'
          }}
        >
          {rays.map((ray, i) => {
            const baseLength = 40;
            // Rays change length/jitter slightly when thinking
            const stateScale = isThinking ? (0.95 + Math.sin(Date.now() / 150 + i) * 0.05) : 1;
            const length = baseLength * ray.variance * stateScale;
            
            const x2 = Math.cos(ray.angle) * length;
            const y2 = Math.sin(ray.angle) * length;

            return (
              <line
                key={i}
                x1="0"
                y1="0"
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={ray.strokeWidth}
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-700 ease-in-out",
                  !isThinking && "animate-ray-breathe"
                )}
                style={{
                  animationDelay: `${i * 150}ms`,
                  opacity: 0.85
                }}
              />
            );
          })}
          
          {/* Small central core to ground the convergence */}
          <circle cx="0" cy="0" r="3" fill="currentColor" opacity="0.9" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes ray-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-ray-breathe {
          animation: ray-breathe 3s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.8; filter: brightness(1.2); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
});

StarburstLogo.displayName = "StarburstLogo";
