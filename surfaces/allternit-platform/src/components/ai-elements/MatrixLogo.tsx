"use client";

import React, { useMemo, memo } from 'react';
import { motion, MotionConfig, useSpring, useMotionValue, useTransform, useMotionTemplate } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MatrixLogoProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "asleep" | "compacting";
  size?: number;
  className?: string;
  energy?: number;
}

/**
 * MatrixLogo - The "Spatial technical" Persona
 * 
 * Features:
 * - True 3D spatial depth layers.
 * - Magnetic interaction: blocks lift and attract toward the mouse.
 * - Technical Rays: Dynamic structural extensions.
 * - Specialized states: Thinking (Technical Scan), Compacting (High-speed compression).
 */
export const MatrixLogo = memo(({
  state,
  size = 64,
  className,
  energy: rawEnergy = 0,
}: MatrixLogoProps) => {
  const energy = Math.max(0, Math.min(1, rawEnergy));
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isCompacting = state === "compacting";
  const isAsleep = state === "asleep";
  const isSmall = size <= 48;

  // Global mouse tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 120 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [isSmall ? 10 : 20, isSmall ? -10 : -20]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [isSmall ? -10 : -20, isSmall ? 10 : 20]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // The "A" construct with depth metadata
  const blocks = useMemo(() => [
    { x: -2, y: 2, z: 20 }, { x: -2, y: 1, z: 10 }, { x: -2, y: 0, z: 0 }, { x: -1, y: -1, z: 15 },
    { x: 0, y: -2, z: 30 }, 
    { x: 1, y: -1, z: 15 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 10 }, { x: 2, y: 2, z: 20 },
    { x: -1, y: 0, z: 5 }, { x: 1, y: 0, z: 5 },
    { x: 0, y: 1, z: 40, accent: true },
  ], []);

  // Structural extensions (Technical Rays)
  const extensions = useMemo(() => {
    const s = isSmall ? 0.4 : 0.7; // Reduced from 0.6 : 1
    return [
      { x1: 50, y1: 50, x2: 50, y2: 50 - (30 * s), opacity: 0.2, angle: 0 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (30 * s), opacity: 0.2, angle: 180 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (25 * s), opacity: 0.15, angle: 90 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (25 * s), opacity: 0.15, angle: -90 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (20 * s), opacity: 0.1, angle: 45 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (20 * s), opacity: 0.1, angle: 135 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (20 * s), opacity: 0.1, angle: -45 },
      { x1: 50, y1: 50, x2: 50, y2: 50 - (20 * s), opacity: 0.1, angle: -135 },
    ].map(ext => ({
      ...ext,
      // Ensure y2 is always a defined number for Framer Motion animations
      y2: ext.y2 ?? 50
    }));
  }, [isSmall]);

  return (
    <MotionConfig reducedMotion="user">
    <div
      className={cn("relative flex items-center justify-center cursor-pointer", className)}
      style={{
        width: size,
        height: size,
        perspective: isSmall ? "600px" : "1200px",
        transformStyle: "preserve-3d"
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        animate={state}
        style={{
          width: '100%',
          height: '100%',
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Structural Extensions (Integrated Rays) */}
        <motion.div 
          className="absolute inset-0"
          style={{ transform: `translateZ(${isSmall ? -15 : -30}px)`, color: 'var(--accent-primary)' }}
          animate={isCompacting ? { rotate: 360 } : isThinking ? { rotate: 360 } : isListening ? { rotate: 360 } : { rotate: 0 }}
          transition={isCompacting ? { repeat: Infinity, duration: 0.8, ease: "linear" } : isThinking ? { repeat: Infinity, duration: 8, ease: "linear" } : isListening ? { repeat: Infinity, duration: 4, ease: "linear" } : { type: "spring" }}
        >
          <svg viewBox="0 0 100 100" className="size-full overflow-visible">
            {extensions.map((ext, i) => (
              <motion.g key={i} transform={`rotate(${ext.angle}, 50, 50)`}>
                <motion.line
                  x1={ext.x1} y1={ext.y1} x2={ext.x2} y2={ext.y2}
                  stroke="currentColor"
                  strokeWidth={isSmall ? "1" : "0.5"}
                  initial={{ y2: ext.y2, opacity: ext.opacity, strokeDashoffset: 0 }}
                  animate={{
                    opacity: isCompacting ? [0.1, 1, 0.1] : isThinking ? [ext.opacity, 0.6, ext.opacity] : isListening ? [ext.opacity * 0.5, ext.opacity * 1.4, ext.opacity * 0.5] : isAsleep ? ext.opacity * 0.15 : ext.opacity,
                    y2: isCompacting ? 48 : isSpeaking ? ext.y2 - (energy * (isSmall ? 4 : 8)) : ext.y2,
                    strokeDasharray: isCompacting ? "2 1" : isThinking ? ["4 2", "1 4", "4 2"] : "none",
                    strokeDashoffset: isCompacting ? [0, -10] : 0
                  }}
                  transition={{
                    duration: isCompacting ? 0.2 : 0.4,
                    strokeDashoffset: isCompacting ? { repeat: Infinity, duration: 0.2, ease: "linear" } : { duration: 0.3 }
                  }}
                />
                <motion.rect
                  x="49.5" y={ext.y2 - 1} width={isSmall ? 2 : 1} height={isSmall ? 2 : 1}
                  fill="currentColor"
                  initial={{ opacity: 0.4, y: 0 }}
                  animate={{
                    opacity: isCompacting ? [0.6, 1, 0.6] : isThinking ? [0.2, 1, 0.2] : 0.4,
                    scale: isCompacting ? [1, 4, 1] : isSpeaking ? [1, 2, 1] : 1,
                    y: isCompacting ? [0, 48, 0] : 0
                  }}
                  transition={isCompacting ? { repeat: Infinity, duration: 0.3, ease: "easeInOut" } : {}}
                />
              </motion.g>
            ))}
          </svg>
        </motion.div>

        {/* The Blocks (Living Construct) */}
        {blocks.map((b, i) => (
          <Block 
            key={i} 
            data={b} 
            mouseX={mouseX} 
            mouseY={mouseY} 
            state={state}
            energy={energy}
            isSmall={isSmall}
          />
        ))}

        {/* Center Core Light */}
        <motion.div
          className="absolute size-1 bg-[#D4B08C] rounded-full"
          style={{
            transform: `translateZ(${isSmall ? 30 : 60}px)`,
            boxShadow: `0 0 ${15 + energy * (isSmall ? 20 : 40)}px #D4B08C`
          }}
          animate={isCompacting ? {
            scale: [1, 10, 1],
            opacity: [0.2, 1, 0.2],
            boxShadow: [`0 0 10px #D4B08C`, `0 0 80px #D4B08C`, `0 0 10px #D4B08C`]
          } : isThinking ? {
            opacity: [0.4, 1, 0.4],
            scale: [1, 2.5, 1]
          } : isListening ? {
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.8, 1],
            boxShadow: [`0 0 8px #D4B08C`, `0 0 22px #D4B08C`, `0 0 8px #D4B08C`]
          } : isSpeaking ? {
            opacity: [0.6, 1, 0.6],
            scale: [1, 2, 1]
          } : state === "asleep" ? {
            opacity: [0.1, 0.25, 0.1],
            scale: [0.8, 1, 0.8]
          } : { opacity: 0.8 }}
          transition={{ repeat: Infinity, duration: isCompacting ? 0.2 : isListening ? 1.4 : isSpeaking ? 0.7 : state === "asleep" ? 4 : 1.2 }}
        />
      </motion.div>
    </div>
    </MotionConfig>
  );
});

/**
 * Individual technical block with magnetic hover and 3D response
 */
const Block = ({ data, mouseX, mouseY, state, energy, isSmall }: any) => {
  const isSpeaking = state === "speaking";

  const blockSize = isSmall ? 8 : 10;
  const gap = isSmall ? 1 : 2;
  const x = data.x * (blockSize + gap);
  const y = data.y * (blockSize + gap);

  // Magnetic lift calculation — v12 callback form (array form removed in Framer Motion v12)
  const dist = useTransform(() => {
    const mx = mouseX.get();
    const my = mouseY.get();
    const dx = (data.x / 3) - mx;
    const dy = (data.y / 3) - my;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance * 2.5);
  });

  const springConfig = { damping: 15, stiffness: 200 };

  const zLift = useSpring(useTransform(dist, [0, 1], [isSmall ? data.z / 2 : data.z, isSmall ? (data.z / 2) + 20 : data.z + 50]), springConfig);
  const brightness = useTransform(dist, [0, 1], [0.8, 1.8]);
  const magneticScale = useTransform(dist, [0, 1], [1, 1.25]);
  // Reactive filter string — useMotionTemplate keeps it live as dist changes
  const filterStyle = useMotionTemplate`brightness(${brightness})`;

  return (
    <motion.div
      animate={state}
      style={{
        position: 'absolute',
        width: blockSize,
        height: blockSize,
        x: x,
        y: y,
        z: zLift,
        left: `calc(50% - ${blockSize / 2}px)`,
        top: `calc(50% - ${blockSize / 2}px)`,
        backgroundColor: 'var(--accent-primary)',
        opacity: data.accent ? 0.7 : 1,
        transformStyle: "preserve-3d",
        // Variants no longer animate scale, so magnetic scale is safe here.
        // Speaking accent block gets energy-driven scale override.
        scale: (isSpeaking && data.accent) ? 1 + energy * 1.8 : magneticScale,
        filter: filterStyle,
      }}
      variants={{
        idle: {
          opacity: [0.85, 1, 0.85],
          transition: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: Math.abs(data.x + data.y) * 0.1 }
        },
        listening: {
          // Orbit-ring: blocks lift in a ripple from outer to inner — z via translateZ in transform
          opacity: [0.7, 1, 0.7],
          transition: {
            repeat: Infinity,
            duration: 1.6,
            ease: "easeInOut",
            delay: Math.sqrt(data.x*data.x + data.y*data.y) * 0.15
          }
        },
        thinking: {
          rotateY: [0, 180, 360],
          opacity: [1, 0.6, 1],
          transition: {
            repeat: Infinity,
            duration: 3,
            delay: Math.sqrt(data.x*data.x + data.y*data.y) * 0.2
          }
        },
        speaking: {
          // Frequency bands: pulse by Y row (like audio bars)
          opacity: [0.6, 1, 0.6],
          transition: {
            repeat: Infinity,
            duration: 0.7,
            ease: "easeInOut",
            delay: Math.abs(data.y) * 0.12
          }
        },
        asleep: {
          // Heartbeat: very slow dim pulse
          opacity: [0.2, 0.38, 0.2],
          transition: {
            repeat: Infinity,
            duration: 4,
            ease: "easeInOut",
            delay: Math.abs(data.x * data.y) * 0.05
          }
        },
        compacting: {
          x: [x, 0, x],
          y: [y, 0, y],
          rotateZ: [0, 180, 360],
          opacity: [1, 0.3, 1],
          transition: {
            repeat: Infinity,
            duration: 0.8,
            ease: "circInOut",
            delay: Math.abs(data.x + data.y) * 0.05
          }
        }
      }}
    >
      <div className="absolute inset-0 bg-[#D4B08C]/30" style={{ transform: `rotateY(90deg) translateZ(${blockSize / 2}px)` }} />
      <div className="absolute inset-0 bg-[#D4B08C]/15" style={{ transform: `rotateX(90deg) translateZ(${blockSize / 2}px)` }} />
      
      <motion.div 
        className="absolute inset-0 bg-white"
        style={{ opacity: useTransform(dist, [0.4, 1], [0, 0.4]) }}
      />
    </motion.div>
  );
};

MatrixLogo.displayName = "MatrixLogo";
