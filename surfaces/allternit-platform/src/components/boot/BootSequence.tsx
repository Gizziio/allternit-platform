"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SAND } from '@/design/allternit.tokens';

// ============================================================================
// BOOT SEQUENCE - Canvas-Based Cinematic Loading Experience
// ============================================================================
// Phase 1: MatrixLogo (2.5s) - Technical initialization
// Phase 2: Gizzi Action Scenes (3-4s each) - Canvas-rendered animations
// ============================================================================

export interface BootSequenceProps {
  onComplete?: () => void;
}

type Phase = 'matrix' | 'gizzi';
type SceneId = 'powerup' | 'search' | 'connect' | 'tune' | 'ready';

interface Scene {
  id: SceneId;
  title: string;
  subtitle: string;
  duration: number;
}

const SCENES: Scene[] = [
  { id: 'powerup', title: 'Powering Up', subtitle: 'Initializing core systems...', duration: 3000 },
  { id: 'search', title: 'The Search', subtitle: 'Scanning workspace...', duration: 4000 },
  { id: 'connect', title: 'Making Connections', subtitle: 'Establishing links...', duration: 4000 },
  { id: 'tune', title: 'Tuning Up', subtitle: 'Optimizing runtime...', duration: 3000 },
  { id: 'ready', title: 'Ready', subtitle: 'Gizzi is online...', duration: 3000 },
];

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<Phase>('matrix');
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const sceneStartTimeRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  
  // Update ref on each render (no useEffect needed)
  onCompleteRef.current = onComplete;

  // Start content fade-in
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Phase 1 → Phase 2 transition
  useEffect(() => {
    if (phase === 'matrix') {
      const timer = setTimeout(() => {
        setPhase('gizzi');
        sceneStartTimeRef.current = performance.now();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Scene cycling
  useEffect(() => {
    if (phase !== 'gizzi') return;
    
    const currentScene = SCENES[currentSceneIndex];
    const timer = setTimeout(() => {
      if (currentSceneIndex < SCENES.length - 1) {
        setCurrentSceneIndex(prev => prev + 1);
        sceneStartTimeRef.current = performance.now();
      } else {
        // Final scene complete - call onComplete via ref
        console.log('[BootSequence] Boot complete, calling onComplete');
        onCompleteRef.current?.();
      }
    }, currentScene.duration);

    return () => clearTimeout(timer);
  }, [phase, currentSceneIndex]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'gizzi') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    // Set canvas size - use fixed logical size
    const LOGICAL_SIZE = 400;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    
    canvas.width = LOGICAL_SIZE * dpr;
    canvas.height = LOGICAL_SIZE * dpr;
    canvas.style.width = `${LOGICAL_SIZE}px`;
    canvas.style.height = `${LOGICAL_SIZE}px`;
    
    // Reset transform and scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    console.log('Canvas initialized:', { width: canvas.width, height: canvas.height, dpr });

    const scene = SCENES[currentSceneIndex];
    const particles: Particle[] = [];
    const connections: Connection[] = [];
    const scanLines: ScanLine[] = [];
    let frameCount = 0;

    // Initialize scene-specific objects
    if (scene.id === 'powerup') {
      for (let i = 0; i < 20; i++) {
        particles.push(createSparkParticle(200, 200));
      }
    } else if (scene.id === 'search') {
      for (let i = 0; i < 8; i++) {
        scanLines.push({
          x: -50 + i * 60,
          y: 100 + Math.random() * 200,
          detected: false,
          opacity: 0,
        });
      }
    } else if (scene.id === 'connect') {
      for (let i = 0; i < 4; i++) {
        connections.push({
          targetX: i < 2 ? 50 : 350,
          targetY: 150 + (i % 2) * 100,
          progress: 0,
          connected: false,
          spark: 0,
        });
      }
    }

    const animate = (now: number) => {
      const elapsed = now - sceneStartTimeRef.current;
      const progress = Math.min(elapsed / scene.duration, 1);
      frameCount++;

      // Clear canvas
      ctx.clearRect(0, 0, 400, 400);

      // Draw scene
      switch (scene.id) {
        case 'powerup':
          drawPowerUpScene(ctx, elapsed, progress, particles);
          break;
        case 'search':
          drawSearchScene(ctx, elapsed, progress, scanLines);
          break;
        case 'connect':
          drawConnectScene(ctx, elapsed, progress, connections);
          break;
        case 'tune':
          drawTuneScene(ctx, elapsed, progress, frameCount);
          break;
        case 'ready':
          drawReadyScene(ctx, elapsed, progress, particles);
          break;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [phase, currentSceneIndex]);

  const currentScene = SCENES[currentSceneIndex];

  return (
    <div style={containerStyle}>
      <div style={backgroundStyle} />
      <div style={gridOverlayStyle} />
      <div style={ambientGlowStyle} />

      <AnimatePresence mode="wait">
        {phase === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.5 }}
            style={phaseContainerStyle}
          >
            <MatrixLogoBoot showContent={showContent} />
          </motion.div>
        )}

        {phase === 'gizzi' && (
          <motion.div
            key="gizzi"
            initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6 }}
            style={phaseContainerStyle}
          >
            <canvas ref={canvasRef} style={canvasStyle} />
            <SceneInfo scene={currentScene} sceneIndex={currentSceneIndex} totalScenes={SCENES.length} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={progressContainerStyle}
      >
        <ProgressIndicator phase={phase} sceneIndex={currentSceneIndex} totalScenes={SCENES.length} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        style={versionBadgeStyle}
      >
        <span style={{ color: `${SAND[500]}66`, fontSize: '11px', letterSpacing: '0.1em' }}>
          Allternit PLATFORM v1.0.0
        </span>
      </motion.div>
    </div>
  );
}

// ============================================================================
// SCENE INFO
// ============================================================================

function SceneInfo({ scene, sceneIndex, totalScenes }: { scene: Scene; sceneIndex: number; totalScenes: number }) {
  return (
    <div style={sceneInfoStyle}>
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3 }}
          style={{ textAlign: 'center' }}
        >
          <h2 style={titleStyle}>{scene.title}</h2>
          <p style={subtitleStyle}>{scene.subtitle}</p>
        </motion.div>
      </AnimatePresence>
      
      <div style={dotsContainerStyle}>
        {Array.from({ length: totalScenes }).map((_, i) => (
          <motion.div
            key={i}
            style={{
              ...dotStyle,
              background: i === sceneIndex ? SAND[500] : i < sceneIndex ? `${SAND[500]}80` : `${SAND[500]}33`,
            }}
            animate={i === sceneIndex ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CANVAS DRAWING FUNCTIONS
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Connection {
  targetX: number;
  targetY: number;
  progress: number;
  connected: boolean;
  spark: number;
}

interface ScanLine {
  x: number;
  y: number;
  detected: boolean;
  opacity: number;
}

function createSparkParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 3;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 2,
    life: 0,
    maxLife: 30 + Math.random() * 20,
    size: 2 + Math.random() * 3,
    color: `hsl(${30 + Math.random() * 30}, 80%, 60%)`,
  };
}

// Proper Gizzi drawing matching the SVG component exactly
function drawGizzi(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, emotion: string, time: number) {
  // Shadow ellipse below (from SVG: cx="48" cy="86" rx="21" ry="4")
  ctx.fillStyle = 'rgba(9, 11, 14, 0.14)';
  ctx.beginPath();
  ctx.ellipse(x, y + 38 * scale, 21 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body group with animations
  ctx.save();
  ctx.translate(x, y);
  
  // Body bounce animation
  const bounceY = Math.sin(time * 0.003) * 2;
  ctx.translate(0, bounceY);

  // Beacon on top (from SVG: x="44" y="8" width="8" height="5" rx="2")
  ctx.fillStyle = '#D97757';
  const beaconScale = 1 + Math.sin(time * 0.005) * 0.1;
  ctx.save();
  ctx.translate(48 * scale, 10 * scale);
  ctx.scale(beaconScale, beaconScale);
  ctx.beginPath();
  ctx.roundRect(-4 * scale, -2.5 * scale, 8 * scale, 5 * scale, 2 * scale);
  ctx.fill();
  ctx.restore();

  // Ears (from SVG: x="24" y="15" width="17" height="7" rx="3")
  ctx.fillStyle = SAND[500];
  ctx.beginPath();
  ctx.roundRect(24 * scale, 15 * scale, 17 * scale, 7 * scale, 3 * scale);
  ctx.roundRect(55 * scale, 15 * scale, 17 * scale, 7 * scale, 3 * scale);
  ctx.fill();

  // Main body shape (from SVG path)
  // M25 23H71L78 30V56L72 63V69L64 76H32L24 69V63L18 56V30L25 23Z
  ctx.fillStyle = SAND[500];
  ctx.beginPath();
  ctx.moveTo(25 * scale, 23 * scale);
  ctx.lineTo(71 * scale, 23 * scale);
  ctx.lineTo(78 * scale, 30 * scale);
  ctx.lineTo(78 * scale, 56 * scale);
  ctx.lineTo(72 * scale, 63 * scale);
  ctx.lineTo(72 * scale, 69 * scale);
  ctx.lineTo(64 * scale, 76 * scale);
  ctx.lineTo(32 * scale, 76 * scale);
  ctx.lineTo(24 * scale, 69 * scale);
  ctx.lineTo(24 * scale, 63 * scale);
  ctx.lineTo(18 * scale, 56 * scale);
  ctx.lineTo(18 * scale, 30 * scale);
  ctx.closePath();
  ctx.fill();

  // Hands (pixel art style from SVG)
  // Left: M18 40H14V44H10V48H14V52H18V56H22V40H18Z
  ctx.fillStyle = SAND[500];
  ctx.beginPath();
  ctx.moveTo(18 * scale, 40 * scale);
  ctx.lineTo(14 * scale, 40 * scale);
  ctx.lineTo(14 * scale, 44 * scale);
  ctx.lineTo(10 * scale, 44 * scale);
  ctx.lineTo(10 * scale, 48 * scale);
  ctx.lineTo(14 * scale, 48 * scale);
  ctx.lineTo(14 * scale, 52 * scale);
  ctx.lineTo(18 * scale, 52 * scale);
  ctx.lineTo(18 * scale, 56 * scale);
  ctx.lineTo(22 * scale, 56 * scale);
  ctx.lineTo(22 * scale, 40 * scale);
  ctx.closePath();
  ctx.fill();

  // Right: M78 40H82V44H86V48H82V52H78V56H74V40H78Z
  ctx.beginPath();
  ctx.moveTo(78 * scale, 40 * scale);
  ctx.lineTo(82 * scale, 40 * scale);
  ctx.lineTo(82 * scale, 44 * scale);
  ctx.lineTo(86 * scale, 44 * scale);
  ctx.lineTo(86 * scale, 48 * scale);
  ctx.lineTo(82 * scale, 48 * scale);
  ctx.lineTo(82 * scale, 52 * scale);
  ctx.lineTo(78 * scale, 52 * scale);
  ctx.lineTo(78 * scale, 56 * scale);
  ctx.lineTo(74 * scale, 56 * scale);
  ctx.lineTo(74 * scale, 40 * scale);
  ctx.closePath();
  ctx.fill();

  // Face plate (from SVG: x="24" y="29" width="48" height="31" rx="9")
  ctx.fillStyle = 'rgba(17, 19, 24, 0.16)';
  ctx.beginPath();
  ctx.roundRect(24 * scale, 29 * scale, 48 * scale, 31 * scale, 9 * scale);
  ctx.fill();

  // Eyes based on emotion (matching SVG renderEye function)
  ctx.fillStyle = '#111318';
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  
  const eyeOffset = Math.sin(time * 0.002) * 1;
  ctx.save();
  ctx.translate(eyeOffset, 0);

  switch (emotion) {
    case 'focused':
      // narrow - rect x="33" y="40" width="8" height="4" rx="2"
      ctx.fillRect(33 * scale, 40 * scale, 8 * scale, 4 * scale);
      ctx.fillRect(59 * scale, 40 * scale, 8 * scale, 4 * scale);
      break;
    case 'curious':
      // Left: rect x="33" y="36" width="8" height="8" rx="2"
      ctx.fillRect(33 * scale, 36 * scale, 8 * scale, 8 * scale);
      // Right: path d="M59 45L63 36L67 45"
      ctx.beginPath();
      ctx.moveTo(59 * scale, 45 * scale);
      ctx.lineTo(63 * scale, 36 * scale);
      ctx.lineTo(67 * scale, 45 * scale);
      ctx.stroke();
      break;
    case 'alert':
      // wide - rect x="33" y="36" width="8" height="10" rx="2"
      ctx.fillRect(33 * scale, 36 * scale, 8 * scale, 10 * scale);
      ctx.fillRect(59 * scale, 36 * scale, 8 * scale, 10 * scale);
      break;
    case 'pleased':
      // path d="M33 43C35 39 39 39 41 43"
      ctx.beginPath();
      ctx.moveTo(33 * scale, 43 * scale);
      ctx.quadraticCurveTo(35 * scale, 39 * scale, 41 * scale, 43 * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(59 * scale, 43 * scale);
      ctx.quadraticCurveTo(61 * scale, 39 * scale, 67 * scale, 43 * scale);
      ctx.stroke();
      break;
    case 'proud':
      // path d="M33 44C35 41 39 41 41 44"
      ctx.beginPath();
      ctx.moveTo(33 * scale, 44 * scale);
      ctx.quadraticCurveTo(35 * scale, 41 * scale, 41 * scale, 44 * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(59 * scale, 44 * scale);
      ctx.quadraticCurveTo(61 * scale, 41 * scale, 67 * scale, 44 * scale);
      ctx.stroke();
      break;
    default:
      // square - rect x="33" y="37" width="8" height="8" rx="2"
      ctx.fillRect(33 * scale, 37 * scale, 8 * scale, 8 * scale);
      ctx.fillRect(59 * scale, 37 * scale, 8 * scale, 8 * scale);
  }
  ctx.restore();

  // Nose (from SVG path)
  ctx.fillStyle = '#D97757';
  ctx.beginPath();
  ctx.moveTo(44.5 * scale, 52 * scale);
  ctx.lineTo(48 * scale, 42 * scale);
  ctx.lineTo(51.5 * scale, 52 * scale);
  ctx.lineTo(49.6 * scale, 52 * scale);
  ctx.lineTo(48.8 * scale, 49.5 * scale);
  ctx.lineTo(47.2 * scale, 49.5 * scale);
  ctx.lineTo(46.4 * scale, 52 * scale);
  ctx.closePath();
  ctx.fill();

  // Nose line (rect x="46" y="47.2" width="4" height="1.4" rx="0.7")
  ctx.fillRect(46 * scale, 47.2 * scale, 4 * scale, 1.4 * scale);

  // Mouth text (from SVG text element)
  ctx.fillStyle = '#D97757';
  ctx.font = `700 ${8.2 * scale}px "SFMono-Regular", "SF Mono", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '-0.4px';
  
  const mouths: Record<string, string> = {
    focused: ':__',
    curious: ':/_',
    alert: '://!',
    pleased: ':))',
    proud: ':_)',
  };
  ctx.fillText(mouths[emotion] || ':__', 48 * scale, 57.5 * scale);

  // Legs (4 rectangles from SVG)
  ctx.fillStyle = SAND[500];
  // x="24" y="74" width="8" height="12"
  ctx.fillRect(24 * scale, 74 * scale, 8 * scale, 12 * scale);
  // x="36" y="74" width="8" height="12"
  ctx.fillRect(36 * scale, 74 * scale, 8 * scale, 12 * scale);
  // x="52" y="74" width="8" height="12"
  ctx.fillRect(52 * scale, 74 * scale, 8 * scale, 12 * scale);
  // x="64" y="74" width="8" height="12"
  ctx.fillRect(64 * scale, 74 * scale, 8 * scale, 12 * scale);

  ctx.restore();
}

function drawPowerUpScene(ctx: CanvasRenderingContext2D, elapsed: number, progress: number, particles: Particle[]) {
  const centerX = 200;
  const centerY = 160;
  
  // Platform
  ctx.strokeStyle = `${SAND[500]}4c`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(centerX, 260, 80, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Energy surge effect
  const surgeIntensity = Math.sin(elapsed * 0.01) * 0.5 + 0.5;
  if (elapsed < 800) {
    ctx.strokeStyle = `rgba(217, 119, 87, ${0.5 + surgeIntensity * 0.5})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + elapsed * 0.005;
      const r1 = 70 + Math.sin(elapsed * 0.02) * 10;
      const r2 = r1 + 20 + surgeIntensity * 30;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * r1, centerY + Math.sin(angle) * r1);
      ctx.lineTo(centerX + Math.cos(angle) * r2, centerY + Math.sin(angle) * r2);
      ctx.stroke();
    }
  }

  // Gizzi with hop animation
  const hopY = elapsed < 400 ? -Math.sin((elapsed / 400) * Math.PI) * 30 : 0;
  const scale = elapsed < 200 ? 1.8 + (elapsed / 200) * 0.4 : 2.2;
  
  drawGizzi(ctx, centerX, centerY + hopY, scale, elapsed < 600 ? 'alert' : 'focused', elapsed);

  // Spark particles
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life++;
    
    if (p.life > p.maxLife) {
      particles[i] = createSparkParticle(centerX, centerY);
    }
    
    const alpha = 1 - (p.life / p.maxLife);
    ctx.fillStyle = p.color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });

  // Shockwave on land
  if (elapsed > 400 && elapsed < 800) {
    const waveProgress = (elapsed - 400) / 400;
    ctx.strokeStyle = `rgba(217, 119, 87, ${1 - waveProgress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, 260, 80 + waveProgress * 100, 20 + waveProgress * 25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSearchScene(ctx: CanvasRenderingContext2D, elapsed: number, progress: number, scanLines: ScanLine[]) {
  const centerX = 200;
  const centerY = 160;

  // Gizzi holding scanner
  drawGizzi(ctx, centerX, centerY, 2.2, 'curious', elapsed);

  // Scanner beam
  const scanX = ((elapsed * 0.15) % 500) - 50;
  const gradient = ctx.createLinearGradient(scanX - 30, 0, scanX + 30, 0);
  gradient.addColorStop(0, 'rgba(135, 206, 235, 0)');
  gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.4)');
  gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(scanX - 30, 80, 60, 240);

  // Data points being scanned
  scanLines.forEach((line) => {
    const dist = Math.abs(scanX - line.x);
    if (dist < 40 && !line.detected) {
      line.detected = true;
      line.opacity = 1;
    }
    
    if (line.detected) {
      line.opacity *= 0.98;
      ctx.fillStyle = `rgba(135, 206, 235, ${line.opacity})`;
      ctx.beginPath();
      ctx.arc(line.x, line.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Detection ring
      if (line.opacity > 0.5) {
        ctx.strokeStyle = `rgba(135, 206, 235, ${line.opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(line.x, line.y, 8 + (1 - line.opacity) * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.2)';
      ctx.beginPath();
      ctx.arc(line.x, line.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawConnectScene(ctx: CanvasRenderingContext2D, elapsed: number, progress: number, connections: Connection[]) {
  const centerX = 200;
  const centerY = 160;

  // Gizzi in center
  drawGizzi(ctx, centerX, centerY, 2.2, 'alert', elapsed);

  // Connection ports
  connections.forEach((conn, i) => {
    // Port glow
    ctx.fillStyle = conn.connected ? 'rgba(144, 238, 144, 0.6)' : `${SAND[500]}4c`;
    ctx.beginPath();
    ctx.arc(conn.targetX, conn.targetY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Cable extending from Gizzi
    if (elapsed > i * 300) {
      const cableProgress = Math.min((elapsed - i * 300) / 800, 1);
      const startX = centerX + (i < 2 ? -35 : 35);
      const startY = centerY + (i % 2 === 0 ? -20 : 20);
      const endX = startX + (conn.targetX - startX) * cableProgress;
      const endY = startY + (conn.targetY - startY) * cableProgress;

      ctx.strokeStyle = SAND[500];
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Connector head
      ctx.fillStyle = '#D97757';
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Connection spark
      if (cableProgress >= 1 && !conn.connected) {
        conn.connected = true;
        conn.spark = 1;
      }
    }

    // Spark effect on connection
    if (conn.spark > 0) {
      conn.spark *= 0.9;
      ctx.fillStyle = `rgba(255, 255, 255, ${conn.spark})`;
      ctx.beginPath();
      ctx.arc(conn.targetX, conn.targetY, 12 + (1 - conn.spark) * 20, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawTuneScene(ctx: CanvasRenderingContext2D, elapsed: number, progress: number, frameCount: number) {
  const centerX = 200;
  const centerY = 160;

  // Orbiting optimization blocks
  const numBlocks = 4;
  for (let i = 0; i < numBlocks; i++) {
    const angle = (frameCount * 0.02) + (i / numBlocks) * Math.PI * 2;
    const radius = 70 + Math.sin(frameCount * 0.03 + i) * 10;
    const bx = centerX + Math.cos(angle) * radius;
    const by = centerY + Math.sin(angle) * radius * 0.6;

    // Block trail
    for (let j = 1; j <= 3; j++) {
      const trailAngle = angle - j * 0.15;
      const trailX = centerX + Math.cos(trailAngle) * radius;
      const trailY = centerY + Math.sin(trailAngle) * radius * 0.6;
      ctx.fillStyle = `rgba(212, 176, 140, ${0.3 - j * 0.1})`;
      ctx.fillRect(trailX - 6, trailY - 6, 12, 12);
    }

    // Block
    ctx.fillStyle = i % 2 === 0 ? SAND[500] : '#D97757';
    ctx.fillRect(bx - 8, by - 8, 16, 16);
    
    // Block highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(bx - 8, by - 8, 16, 4);
  }

  // Gizzi happily juggling
  const bobY = Math.sin(frameCount * 0.08) * 5;
  drawGizzi(ctx, centerX, centerY + bobY, 2.2, 'pleased', elapsed);
}

function drawReadyScene(ctx: CanvasRenderingContext2D, elapsed: number, progress: number, particles: Particle[]) {
  const centerX = 200;
  const centerY = 160;

  // Star burst particles
  if (elapsed < 1000 && Math.random() < 0.3) {
    for (let i = 0; i < 3; i++) {
      particles.push(createSparkParticle(centerX, centerY));
    }
  }

  // Gizzi presentation pose with scale animation
  const presentScale = elapsed < 500 
    ? 2.0 + (elapsed / 500) * 0.4 
    : 2.4 + Math.sin(elapsed * 0.005) * 0.08;
  
  drawGizzi(ctx, centerX, centerY, presentScale, 'proud', elapsed);

  // Rotating stars
  const numStars = 6;
  for (let i = 0; i < numStars; i++) {
    const angle = (elapsed * 0.001) + (i / numStars) * Math.PI * 2;
    const radius = 90;
    const sx = centerX + Math.cos(angle) * radius;
    const sy = centerY + Math.sin(angle) * radius;
    
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx + 2, sy - 2);
    ctx.lineTo(sx + 6, sy);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx, sy + 6);
    ctx.lineTo(sx - 2, sy + 2);
    ctx.lineTo(sx - 6, sy);
    ctx.lineTo(sx - 2, sy - 2);
    ctx.fill();
  }

  // Particles
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life++;
    
    if (p.life > p.maxLife) {
      particles.splice(i, 1);
      return;
    }
    
    const alpha = 1 - (p.life / p.maxLife);
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ============================================================================
// MATRIX LOGO BOOT
// ============================================================================

function MatrixLogoBoot({ showContent }: { showContent: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
      <motion.div
        style={{
          width: 200,
          height: 200,
          position: 'relative',
          perspective: 800,
        }}
        animate={{ rotateX: [25, 20, 25], rotateY: [-15, -10, -15] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* 3D Blocks */}
        {[
          { x: -48, y: 44, delay: 0 },
          { x: -48, y: 22, delay: 0.1 },
          { x: -48, y: 0, delay: 0.2 },
          { x: 0, y: -33, delay: 0.3 },
          { x: 48, y: 0, delay: 0.4 },
          { x: 48, y: 22, delay: 0.5 },
          { x: 48, y: 44, delay: 0.6 },
          { x: 0, y: 11, delay: 0.7, accent: true },
        ].map((block, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: block.accent ? 28 : 22,
              height: block.accent ? 28 : 22,
              left: `calc(50% + ${block.x}px - ${(block.accent ? 28 : 22) / 2}px)`,
              top: `calc(50% + ${block.y}px - ${(block.accent ? 28 : 22) / 2}px)`,
              background: block.accent ? '#E6C9A8' : SAND[600],
              borderRadius: '3px',
              boxShadow: block.accent ? '0 0 20px rgba(230, 201, 168, 0.4)' : 'none',
            }}
            initial={{ opacity: 0, scale: 0, z: 100 }}
            animate={showContent ? { opacity: 1, scale: 1, z: 0 } : { opacity: 0, scale: 0, z: 100 }}
            transition={{ delay: block.delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          />
        ))}
      </motion.div>

      <motion.div
        style={{ textAlign: 'center' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.h1
          style={{ fontSize: '28px', fontWeight: 600, color: SAND[500], letterSpacing: '0.15em', margin: 0 }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Allternit Platform
        </motion.h1>
        <p style={{ fontSize: '13px', color: `${SAND[500]}99`, letterSpacing: '0.08em', margin: '8px 0 0' }}>
          Initializing system core...
        </p>
      </motion.div>
    </div>
  );
}

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

function ProgressIndicator({ phase, sceneIndex, totalScenes }: { phase: Phase; sceneIndex: number; totalScenes: number }) {
  const getProgress = () => {
    if (phase === 'matrix') return 0.15;
    return 0.3 + (sceneIndex / totalScenes) * 0.6;
  };

  const progress = getProgress();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
      <div style={{ height: '2px', background: `${SAND[500]}1a`, borderRadius: '1px', position: 'relative' }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #d4b08c 0%, #e6c9a8 50%, #d4b08c 100%)', borderRadius: '1px' }}
          initial={{ width: '0%' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: '10px', letterSpacing: '0.15em' }}>
        <span style={{ color: phase === 'matrix' ? SAND[500] : `${SAND[500]}80` }}>INIT</span>
        <span style={{ color: phase === 'gizzi' && sceneIndex < totalScenes - 1 ? SAND[500] : `${SAND[500]}80` }}>LOAD</span>
        <span style={{ color: sceneIndex >= totalScenes - 1 ? SAND[500] : `${SAND[500]}33` }}>READY</span>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  position: 'fixed',
  inset: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const backgroundStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at 50% 30%, #1F1A14 0%, #0D0B09 70%)',
  zIndex: 0,
};

const gridOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `radial-gradient(circle, ${SAND[500]}0a 1px, transparent 1px)`,
  backgroundSize: '48px 48px',
  opacity: 0.5,
  zIndex: 1,
  pointerEvents: 'none',
};

const ambientGlowStyle: React.CSSProperties = {
  position: 'absolute',
  width: '600px',
  height: '600px',
  borderRadius: '50%',
  background: `radial-gradient(circle, ${SAND[500]}14 0%, transparent 70%)`,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1,
  pointerEvents: 'none',
};

const phaseContainerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const canvasStyle: React.CSSProperties = {
  width: '400px',
  height: '400px',
};

const sceneInfoStyle: React.CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 600,
  color: SAND[500],
  margin: 0,
  letterSpacing: '0.05em',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: `${SAND[500]}99`,
  margin: '8px 0 0',
  fontFamily: 'Allternit Mono, Monaco, Consolas, monospace',
};

const dotsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const dotStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  transition: 'background 0.3s ease',
};

const progressContainerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '60px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
};

const versionBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
};

export default BootSequence;
