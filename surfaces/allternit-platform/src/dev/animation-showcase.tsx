/**
 * Animation Showcase
 * 
 * Demo page for all animation system features.
 * Use this to test and demonstrate the animation system.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fade } from '../design/animation/Fade';
import { Slide } from '../design/animation/Slide';
import { Scale } from '../design/animation/Scale';
import { Stagger } from '../design/animation/Stagger';
import { PageTransition } from '../design/animation/PageTransition';
import { LayoutItem } from '../design/animation/LayoutAnimations';
import { Skeleton } from '../design/animation/Skeleton';
import { useReducedMotion, AccessibleMotion } from '../design/animation/accessibility';
import { presets } from '../design/animation/presets';
import {
  buttonTap,
  hoverLift,
  pulseAnimation,
  hoverGlow,
} from '../design/animation/micro-interactions';
import { AnimatedGlassCard, FadeIn } from '../design/animation/integrations';
import { animationTiming } from '../design/animation/timing';

// Demo card component
function DemoCard({ 
  title, 
  children,
  className = '',
}: { 
  title: string; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white/5 rounded-xl p-6 border border-white/10 ${className}`}>
      <h3 className="text-lg font-medium mb-4 text-white/90">{title}</h3>
      {children}
    </div>
  );
}

// Demo button
function DemoButton({ 
  children, 
  onClick,
  variant = 'default',
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost';
}) {
  const baseStyles = "px-4 py-2 rounded-lg font-medium text-sm transition-colors";
  const variantStyles = {
    default: "bg-white/10 hover:bg-white/20 text-white",
    primary: "bg-sky-500 hover:bg-sky-600 text-white",
    ghost: "bg-transparent hover:bg-white/5 text-white/70",
  };

  return (
    <motion.button
      className={`${baseStyles} ${variantStyles[variant]}`}
      whileTap={buttonTap}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

export default function AnimationShowcase() {
  const [fadeVisible, setFadeVisible] = useState(true);
  const [slideVisible, setSlideVisible] = useState(true);
  const [scaleVisible, setScaleVisible] = useState(true);
  const [pageMode, setPageMode] = useState<'fade' | 'slide' | 'scale' | 'slideUp'>('fade');
  const [pageKey, setPageKey] = useState(0);
  const [listItems, setListItems] = useState([1, 2, 3, 4, 5]);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const addListItem = () => {
    setListItems(prev => [...prev, prev.length + 1]);
  };

  const removeListItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
  };

  const nextPage = () => {
    setPageKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Animation System</h1>
          <p className="text-white/60">
            Comprehensive animation system using Framer Motion
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              prefersReducedMotion 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'bg-green-500/20 text-green-400'
            }`}>
              {prefersReducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}
            </div>
            <button 
              onClick={() => document.documentElement.classList.toggle('prefers-reduced-motion')}
              className="text-xs text-white/50 hover:text-white/80 underline"
            >
              (Toggle in OS settings)
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Fade Animation */}
          <DemoCard title="Fade Animation">
            <div className="space-y-4">
              <div className="flex gap-2">
                <DemoButton onClick={() => setFadeVisible(!fadeVisible)}>
                  Toggle Fade
                </DemoButton>
              </div>
              <div className="h-24 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                <Fade in={fadeVisible} direction="up">
                  <div className="bg-sky-500/20 border border-sky-500/30 px-6 py-3 rounded-lg">
                    <span className="text-sky-400">Fading Content</span>
                  </div>
                </Fade>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['none', 'up', 'down', 'left', 'right'] as const).map(dir => (
                  <Fade key={dir} in={fadeVisible} direction={dir} delay={0.1}>
                    <span className="text-xs text-white/50">{dir}</span>
                  </Fade>
                ))}
              </div>
            </div>
          </DemoCard>

          {/* Slide Animation */}
          <DemoCard title="Slide Animation">
            <div className="space-y-4">
              <div className="flex gap-2">
                <DemoButton onClick={() => setSlideVisible(!slideVisible)}>
                  Toggle Slide
                </DemoButton>
              </div>
              <div className="h-24 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                <Slide in={slideVisible} direction="right" distance={100}>
                  <div className="bg-emerald-500/20 border border-emerald-500/30 px-6 py-3 rounded-lg">
                    <span className="text-emerald-400">Sliding Content</span>
                  </div>
                </Slide>
              </div>
              <div className="flex gap-2">
                {(['up', 'down', 'left', 'right'] as const).map(dir => (
                  <DemoButton 
                    key={dir} 
                    variant="ghost"
                    onClick={() => setSlideVisible(false)}
                  >
                    {dir}
                  </DemoButton>
                ))}
              </div>
            </div>
          </DemoCard>

          {/* Scale Animation */}
          <DemoCard title="Scale Animation">
            <div className="space-y-4">
              <div className="flex gap-2">
                <DemoButton onClick={() => setScaleVisible(!scaleVisible)}>
                  Toggle Scale
                </DemoButton>
              </div>
              <div className="h-24 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                <Scale in={scaleVisible} initial={0.5} spring>
                  <div className="bg-purple-500/20 border border-purple-500/30 px-6 py-3 rounded-lg">
                    <span className="text-purple-400">Scaling Content</span>
                  </div>
                </Scale>
              </div>
              <div className="flex gap-2">
                <DemoButton onClick={() => setScaleVisible(false)} variant="ghost">
                  No Spring
                </DemoButton>
                <DemoButton onClick={() => setScaleVisible(true)} variant="ghost">
                  With Spring
                </DemoButton>
              </div>
            </div>
          </DemoCard>

          {/* Stagger Animation */}
          <DemoCard title="Stagger Animation">
            <div className="space-y-4">
              <Stagger staggerDelay={0.05} direction="up">
                {[1, 2, 3].map(i => (
                  <div 
                    key={i}
                    className="bg-white/5 px-4 py-2 rounded-lg mb-2"
                  >
                    <span className="text-white/70">Item {i}</span>
                  </div>
                ))}
              </Stagger>
              <div className="flex gap-2">
                <DemoButton onClick={() => window.location.reload()}>
                  Replay
                </DemoButton>
              </div>
            </div>
          </DemoCard>

          {/* Page Transitions */}
          <DemoCard title="Page Transitions">
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {(['fade', 'slide', 'scale', 'slideUp'] as const).map(mode => (
                  <DemoButton 
                    key={mode}
                    variant={pageMode === mode ? 'primary' : 'ghost'}
                    onClick={() => { setPageMode(mode); nextPage(); }}
                  >
                    {mode}
                  </DemoButton>
                ))}
              </div>
              <div className="h-24 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                <PageTransition pageKey={String(pageKey)} mode={pageMode}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white/80">{pageKey}</div>
                    <div className="text-xs text-white/40">Page Key</div>
                  </div>
                </PageTransition>
              </div>
            </div>
          </DemoCard>

          {/* Micro-interactions */}
          <DemoCard title="Micro-interactions">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <motion.button
                  className="px-4 py-2 bg-sky-500 rounded-lg text-white text-sm font-medium"
                  whileTap={buttonTap}
                >
                  Tap Me
                </motion.button>
                
                <motion.div
                  className="px-4 py-2 bg-white/10 rounded-lg text-white/80 text-sm font-medium cursor-pointer"
                  whileHover={hoverLift}
                >
                  Hover Me
                </motion.div>
                
                <motion.div
                  className="px-4 py-2 bg-amber-500/20 rounded-lg text-amber-400 text-sm font-medium"
                  animate={pulseAnimation}
                >
                  Pulsing
                </motion.div>
                
                <motion.div
                  className="px-4 py-2 bg-emerald-500/20 rounded-lg text-emerald-400 text-sm font-medium cursor-pointer"
                  whileHover={hoverGlow}
                >
                  Glow
                </motion.div>
              </div>
            </div>
          </DemoCard>

          {/* Skeleton Loading */}
          <DemoCard title="Skeleton Loading">
            <div className="space-y-4">
              <div className="flex gap-2">
                <DemoButton onClick={() => setShowSkeleton(!showSkeleton)}>
                  {showSkeleton ? 'Show Content' : 'Show Skeleton'}
                </DemoButton>
              </div>
              <AnimatePresence mode="wait">
                {showSkeleton ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton variant="circular" width={40} height={40} />
                      <div className="flex-1">
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="40%" />
                      </div>
                    </div>
                    <Skeleton variant="rounded" width="100%" height={80} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                        <span className="text-sky-400 text-sm">JD</span>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">John Doe</div>
                        <div className="text-white/50 text-sm">john@example.com</div>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-white/70 text-sm">
                        This is the actual content that loads after the skeleton.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DemoCard>

          {/* Layout Animations */}
          <DemoCard title="Layout Animations">
            <div className="space-y-4">
              <div className="flex gap-2">
                <DemoButton onClick={addListItem}>
                  Add Item
                </DemoButton>
                <DemoButton 
                  variant="ghost" 
                  onClick={() => setListItems([1, 2, 3, 4, 5])}
                >
                  Reset
                </DemoButton>
              </div>
              <div className="space-y-2 max-h-32 overflow-auto">
                <AnimatePresence mode="popLayout">
                  {listItems.map((item, index) => (
                    <LayoutItem key={item} itemKey={String(item)}>
                      <motion.div 
                        className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-lg"
                        layout
                      >
                        <span className="text-white/70">Item {item}</span>
                        <button
                          onClick={() => removeListItem(index)}
                          className="text-white/40 hover:text-red-400 transition-colors"
                        >
                          ×
                        </button>
                      </motion.div>
                    </LayoutItem>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </DemoCard>

          {/* Glass Card Animation */}
          <DemoCard title="Glass Card Animation">
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <FadeIn delay={0.1} direction="up">
                  <AnimatedGlassCard 
                    interactive 
                    hoverable 
                    variant="pop"
                    className="p-4"
                  >
                    <div className="text-white/80 font-medium">Interactive</div>
                    <div className="text-white/50 text-sm">Hover & tap me</div>
                  </AnimatedGlassCard>
                </FadeIn>
                <FadeIn delay={0.2} direction="up">
                  <AnimatedGlassCard 
                    hoverable 
                    variant="slide"
                    intensity="thin"
                    className="p-4"
                  >
                    <div className="text-white/80 font-medium">Slide In</div>
                    <div className="text-white/50 text-sm">Thin glass</div>
                  </AnimatedGlassCard>
                </FadeIn>
              </div>
            </div>
          </DemoCard>

          {/* Presets Demo */}
          <DemoCard title="Animation Presets">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  className="p-3 bg-white/5 rounded-lg text-center cursor-pointer"
                  variants={presets.modal.content}
                  initial="initial"
                  whileHover="animate"
                >
                  <div className="text-xs text-white/50">Modal</div>
                </motion.div>
                
                <motion.div
                  className="p-3 bg-white/5 rounded-lg text-center cursor-pointer"
                  variants={presets.toast.enter}
                  initial="initial"
                  whileHover="animate"
                >
                  <div className="text-xs text-white/50">Toast</div>
                </motion.div>
                
                <motion.div
                  className="p-3 bg-white/5 rounded-lg text-center cursor-pointer"
                  variants={presets.dropdown.enter}
                  initial="initial"
                  whileHover="animate"
                >
                  <div className="text-xs text-white/50">Dropdown</div>
                </motion.div>
                
                <motion.div
                  className="p-3 bg-white/5 rounded-lg text-center cursor-pointer"
                  variants={presets.tooltip.enter}
                  initial="initial"
                  whileHover="animate"
                >
                  <div className="text-xs text-white/50">Tooltip</div>
                </motion.div>
              </div>
            </div>
          </DemoCard>

          {/* Accessible Motion */}
          <DemoCard title="Accessible Motion">
            <div className="space-y-4">
              <p className="text-white/50 text-sm">
                This component automatically disables animations when reduced motion is preferred:
              </p>
              <AccessibleMotion
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1 }}
                fallback={
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-amber-400">Static fallback content</span>
                  </div>
                }
              >
                <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-lg">
                  <span className="text-sky-400">Animated content (1s duration)</span>
                </div>
              </AccessibleMotion>
            </div>
          </DemoCard>

          {/* Timing Tokens */}
          <DemoCard title="Timing Tokens">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Instant</span>
                <span className="text-white/80">{animationTiming.instant}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Fast</span>
                <span className="text-white/80">{animationTiming.fast}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Base</span>
                <span className="text-white/80">{animationTiming.base}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Slow</span>
                <span className="text-white/80">{animationTiming.slow}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Deliberate</span>
                <span className="text-white/80">{animationTiming.deliberate}s</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-white/50">Reduced Motion</span>
                  <span className="text-white/80">{animationTiming.reduced.duration}s</span>
                </div>
              </div>
            </div>
          </DemoCard>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-8 text-sm text-white/40">
            <div>
              <strong className="text-white/60 block mb-1">System</strong>
              Framer Motion
            </div>
            <div>
              <strong className="text-white/60 block mb-1">GPU Properties</strong>
              transform, opacity
            </div>
            <div>
              <strong className="text-white/60 block mb-1">Accessibility</strong>
              prefers-reduced-motion
            </div>
            <div>
              <strong className="text-white/60 block mb-1">Components</strong>
              14 exported
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
