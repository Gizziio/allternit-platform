"use client";

import React, { useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

interface OrganicOrbProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "asleep";
  size?: number;
  className?: string;
  energy?: number;
}

export const OrganicOrb = memo(({
  state,
  size = 64,
  className,
  energy = 0,
}: OrganicOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let time = 0;
    const centerX = size / 2;
    const centerY = size / 2;

    const isListening = state === "listening";
    const isSpeaking = state === "speaking";
    const isThinking = state === "thinking";

    const drawOrb = () => {
      ctx.clearRect(0, 0, size, size);

      // Background glow
      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, size / 2
      );

      if (isListening) {
        glowGradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.2)');
        glowGradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
      } else if (isSpeaking) {
        glowGradient.addColorStop(0, 'rgba(244, 114, 182, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.2)');
        glowGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
      } else if (isThinking) {
        glowGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(236, 72, 153, 0.2)');
        glowGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      } else {
        glowGradient.addColorStop(0, 'rgba(167, 139, 250, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.15)');
        glowGradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
      }

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, size, size);

      // Draw organic blob
      const baseRadius = size / 4;
      const pulseAmount = (isListening || isSpeaking || isThinking)
        ? (size / 13) + energy * (size / 10) 
        : (size / 40);
      const points = 64;
      const noiseScale = (isListening || isSpeaking || isThinking) ? 0.8 : 0.3;

      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noise1 = Math.sin(angle * 3 + time * 2) * noiseScale;
        const noise2 = Math.sin(angle * 5 - time * 1.5) * noiseScale * 0.5;
        const noise3 = Math.cos(angle * 7 + time * 3) * noiseScale * 0.3;
        const pulse = Math.sin(time * 3) * (pulseAmount / baseRadius);
        const radius = baseRadius * (1 + noise1 + noise2 + noise3 + pulse);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }

      ctx.closePath();

      // Create gradient fill
      const orbGradient = ctx.createRadialGradient(
        centerX - (size / 10), centerY - (size / 10), 0,
        centerX, centerY, baseRadius + pulseAmount
      );

      if (isListening) {
        orbGradient.addColorStop(0, '#34d399');
        orbGradient.addColorStop(0.3, '#60a5fa');
        orbGradient.addColorStop(0.6, '#a78bfa');
        orbGradient.addColorStop(1, '#f472b6');
      } else if (isSpeaking) {
        orbGradient.addColorStop(0, '#f472b6');
        orbGradient.addColorStop(0.3, '#a78bfa');
        orbGradient.addColorStop(0.6, '#60a5fa');
        orbGradient.addColorStop(1, '#34d399');
      } else if (isThinking) {
        orbGradient.addColorStop(0, '#a855f7');
        orbGradient.addColorStop(0.4, '#ec4899');
        orbGradient.addColorStop(1, '#8b5cf6');
      } else {
        orbGradient.addColorStop(0, '#60a5fa');
        orbGradient.addColorStop(0.4, '#a78bfa');
        orbGradient.addColorStop(1, '#f472b6');
      }

      ctx.fillStyle = orbGradient;
      ctx.fill();

      // Inner glow
      const innerGlow = ctx.createRadialGradient(
        centerX - (size / 13), centerY - (size / 13), 0,
        centerX, centerY, baseRadius
      );
      innerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      innerGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = innerGlow;
      ctx.fill();

      // Outer rings
      if ((isListening || isSpeaking || isThinking) && size > 32) {
        const ringColor = isListening ? 'rgba(52, 211, 153' : isSpeaking ? 'rgba(244, 114, 182' : 'rgba(168, 85, 247';
        const ringRadius = baseRadius + pulseAmount + (size / 20) + Math.sin(time * 4) * (size / 40);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${ringColor}, ${0.3 + Math.sin(time * 2) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      time += 0.02;
      animationRef.current = requestAnimationFrame(drawOrb);
    };

    drawOrb();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, energy, size]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-visible", className)} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="block pointer-events-none" />
    </div>
  );
});

OrganicOrb.displayName = "OrganicOrb";
