"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// ============================================================================
// MATRIX LOGO BOOT - Phase 1 Technical Initialization
// ============================================================================
// Animated 3D block assembly representing system boot sequence
// Blocks materialize from data streams, forming the A2R mark
// ============================================================================

interface MatrixLogoBootProps {
  showContent: boolean;
}

// 3D block configuration - the A shape with depth layers
const BLOCKS = [
  // Left column (rising)
  { x: -2, y: 2, z: 20, delay: 0.0, color: '#8B7355' },
  { x: -2, y: 1, z: 10, delay: 0.1, color: '#A08060' },
  { x: -2, y: 0, z: 0, delay: 0.2, color: SAND[600] },
  
  // Peak (center top)
  { x: 0, y: -1.5, z: 30, delay: 0.3, color: SAND[500] },
  
  // Right column (descending)
  { x: 2, y: 0, z: 0, delay: 0.4, color: SAND[600] },
  { x: 2, y: 1, z: 10, delay: 0.5, color: '#A08060' },
  { x: 2, y: 2, z: 20, delay: 0.6, color: '#8B7355' },
  
  // Crossbar (accent)
  { x: 0, y: 0.5, z: 40, delay: 0.7, color: '#E6C9A8', accent: true },
  
  // Structural extensions (tech feel)
  { x: -3, y: 2.5, z: 15, delay: 0.8, color: '#6B5344', ray: true },
  { x: 3, y: 2.5, z: 15, delay: 0.9, color: '#6B5344', ray: true },
];

export function MatrixLogoBoot({ showContent }: MatrixLogoBootProps) {
  return (
    <div style={containerStyle}>
      {/* 3D Logo Container */}
      <motion.div
        style={logoContainerStyle}
        initial={{ rotateX: 25, rotateY: -15 }}
        animate={{ 
          rotateX: [25, 20, 25],
          rotateY: [-15, -10, -15],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut" as const
        }}
      >
        {/* Blocks */}
        {BLOCKS.map((block, index) => (
          <Block key={index} block={block} showContent={showContent} />
        ))}
        
        {/* Data stream particles */}
        <DataStreams showContent={showContent} />
        
        {/* Glow center */}
        <motion.div
          style={centerGlowStyle}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut" as const
          }}
        />
      </motion.div>

      {/* Text content */}
      <motion.div
        style={textContainerStyle}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.h1
          style={titleStyle}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
        >
          A2R Platform
        </motion.h1>
        <motion.p style={subtitleStyle}>
          Initializing system core...
        </motion.p>
      </motion.div>

      {/* Tech details */}
      <motion.div
        style={techDetailsStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 0.4 : 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <span style={techTextStyle}>KERNEL v2.4.1</span>
        <span style={techDividerStyle}>|</span>
        <span style={techTextStyle}>LOADING MODULES</span>
      </motion.div>
    </div>
  );
}

// ============================================================================
// BLOCK COMPONENT
// ============================================================================

interface BlockProps {
  block: typeof BLOCKS[0];
  showContent: boolean;
}

function Block({ block, showContent }: BlockProps) {
  const { x, y, z, delay, color, accent, ray } = block;
  
  const size = accent ? 28 : ray ? 12 : 22;
  const depth = accent ? 20 : ray ? 40 : 16;
  
  return (
    <motion.div
      style={{
        ...blockBaseStyle,
        width: size,
        height: size,
        left: `calc(50% + ${x * 24}px - ${size / 2}px)`,
        top: `calc(50% + ${y * 22}px - ${size / 2}px)`,
        transform: `translateZ(${z}px)`,
      }}
      initial={{ 
        opacity: 0, 
        scale: 0,
        z: z + 100,
      }}
      animate={showContent ? { 
        opacity: 1, 
        scale: 1,
        z: z,
      } : { opacity: 0, scale: 0, z: z + 100 }}
      transition={{
        delay: delay,
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1] as const,
      }}
    >
      {/* Block faces for 3D effect */}
      <div style={{ ...faceStyle, ...frontFaceStyle, background: color, width: size, height: size }} />
      <div style={{ ...faceStyle, ...backFaceStyle, background: color, width: size, height: size, opacity: 0.6 }} />
      <div style={{ ...faceStyle, ...topFaceStyle, background: color, width: size, height: depth, opacity: 0.8 }} />
      <div style={{ ...faceStyle, ...rightFaceStyle, background: color, width: depth, height: size, opacity: 0.7 }} />
      
      {/* Glow for accent blocks */}
      {accent && (
        <motion.div
          style={{
            ...accentGlowStyle,
            width: size,
            height: size,
          }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(230, 201, 168, 0.4)',
              '0 0 40px rgba(230, 201, 168, 0.6)',
              '0 0 20px rgba(230, 201, 168, 0.4)',
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// DATA STREAMS - Animated particles flowing upward
// ============================================================================

function DataStreams({ showContent }: { showContent: boolean }) {
  const streams = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (i % 6 - 2.5) * 30,
    delay: i * 0.1,
    duration: 1.5 + Math.random() * 0.5,
  }));

  return (
    <div style={streamsContainerStyle}>
      {streams.map(stream => (
        <motion.div
          key={stream.id}
          style={{
            ...streamStyle,
            left: `calc(50% + ${stream.x}px)`,
          }}
          initial={{ opacity: 0, y: 100, height: 0 }}
          animate={showContent ? {
            opacity: [0, 0.6, 0],
            y: [100, -80],
            height: [0, 30, 0],
          } : { opacity: 0, y: 100, height: 0 }}
          transition={{
            delay: stream.delay + 0.5,
            duration: stream.duration,
            repeat: Infinity,
            repeatDelay: 0.5,
            ease: "easeOut" as const,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '32px',
};

const logoContainerStyle: React.CSSProperties = {
  width: 200,
  height: 200,
  position: 'relative',
  transformStyle: 'preserve-3d',
  perspective: 800,
};

const blockBaseStyle: React.CSSProperties = {
  position: 'absolute',
  transformStyle: 'preserve-3d',
};

const faceStyle: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '3px',
};

const frontFaceStyle: React.CSSProperties = {
  transform: 'translateZ(8px)',
  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)',
};

const backFaceStyle: React.CSSProperties = {
  transform: 'translateZ(-8px)',
};

const topFaceStyle: React.CSSProperties = {
  transform: 'rotateX(-90deg) translateZ(8px)',
  transformOrigin: 'top',
};

const rightFaceStyle: React.CSSProperties = {
  transform: 'rotateY(90deg) translateZ(8px)',
  transformOrigin: 'right',
};

const accentGlowStyle: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '3px',
  pointerEvents: 'none',
};

const centerGlowStyle: React.CSSProperties = {
  position: 'absolute',
  width: 80,
  height: 80,
  borderRadius: '50%',
  background: `radial-gradient(circle, ${SAND[500]}4c 0%, transparent 70%)`,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%) translateZ(50px)',
  pointerEvents: 'none',
};

const streamsContainerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  transformStyle: 'preserve-3d',
};

const streamStyle: React.CSSProperties = {
  position: 'absolute',
  width: '2px',
  background: 'linear-gradient(to top, transparent, `${SAND[500]}99`, transparent)',
  borderRadius: '1px',
  top: '50%',
};

const textContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 600,
  color: SAND[500],
  letterSpacing: '0.15em',
  margin: 0,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textShadow: '0 0 30px `${SAND[500]}4c`',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: `${SAND[500]}99`,
  letterSpacing: '0.08em',
  margin: 0,
  fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
};

const techDetailsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginTop: '8px',
};

const techTextStyle: React.CSSProperties = {
  fontSize: '10px',
  color: `${SAND[500]}80`,
  letterSpacing: '0.1em',
  fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
};

const techDividerStyle: React.CSSProperties = {
  fontSize: '10px',
  color: `${SAND[500]}4c`,
};

export default MatrixLogoBoot;
