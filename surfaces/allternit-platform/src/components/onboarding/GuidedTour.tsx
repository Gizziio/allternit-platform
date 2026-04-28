/**
 * Guided Tour Component
 * 
 * Shows contextual hints and tooltips for main UI elements after onboarding.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  CaretRight,
  CaretLeft,
  Sparkle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="modes"]',
    title: 'Surface Modes',
    description: 'Switch between 4 modes: Chat for AI conversations, Cowork for task management, Code for development, and Browser for web automation. Each mode has specialized tools and context.',
    position: 'bottom',
  },
  {
    target: '[data-tour="plugins"]',
    title: 'Plugin Widget',
    description: 'Access the plugin marketplace to extend Allternit with custom skills, integrations, and agent capabilities. Install community plugins or build your own.',
    position: 'right',
  },
  {
    target: '[data-tour="model-selector"]',
    title: 'Model Selector & Auto-Discovery',
    description: 'Switch between AI models seamlessly. Allternit auto-discovers CLI subprocesses running on your computer and can interface with them directly.',
    position: 'bottom',
  },
  {
    target: '[data-tour="agent-toggle"]',
    title: 'Agent Mode',
    description: 'When Agent Mode is ON, Allternit can take autonomous actions using tools. The Allternit OS toolbar shows available capabilities: Auto-fix, file browsing, context management, and more.',
    position: 'top',
  },
  {
    target: '[data-tour="agent-runner"]',
    title: 'Computer Use Engine',
    description: 'Press Ctrl+Shift+A to launch the Agent Runner. This mounts the computer-use engine that can take over your screen (Electron), browser tabs, or remote desktop sessions.',
    position: 'left',
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

function renderDescription(description: string) {
  const shortcut = 'Ctrl+Shift+A';
  const parts = description.split(shortcut);

  return parts.flatMap((part, index) => [
    part,
    index < parts.length - 1 ? (
      <kbd
        key={`shortcut-${index}`}
        className="px-1.5 py-0.5 bg-[var(--surface-hover)] border border-[var(--ui-border-default)] rounded text-xs text-[#D4B08C] font-mono"
      >
        {shortcut}
      </kbd>
    ) : null,
  ]);
}

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const step = tourSteps[currentStep];

  // Wait for elements to be available and measure them
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const updateHighlight = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updateHighlight();
    
    // Re-measure on resize
    window.addEventListener('resize', updateHighlight);
    
    // Re-measure periodically in case UI shifts
    const interval = setInterval(updateHighlight, 500);
    
    return () => {
      window.removeEventListener('resize', updateHighlight);
      clearInterval(interval);
    };
  }, [currentStep, isVisible, step.target]);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const getTooltipPosition = () => {
    if (!highlightRect) return { top: 0, left: 0 };
    
    const tooltipWidth = 360;
    const tooltipHeight = 200;
    const padding = 16;
    
    let top = 0;
    let left = 0;
    
    switch (step.position) {
      case 'bottom':
        top = highlightRect.bottom + padding + 8;
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = highlightRect.top - tooltipHeight - padding;
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
        left = highlightRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
        left = highlightRect.right + padding;
        break;
    }
    
    // Keep on screen
    const margin = 20;
    left = Math.max(margin, Math.min(window.innerWidth - tooltipWidth - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - tooltipHeight - margin, top));
    
    return { top, left };
  };

  const tooltipPos = getTooltipPosition();

  if (!isVisible) return null;

  return (
    <div className="w-full h-full" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Dark overlay */}
      <div 
        className="absolute inset-0 bg-black/70 transition-opacity duration-300" 
        onClick={onSkip}
      />
      
      {/* Highlight box */}
      {highlightRect && (
        <div
          className="absolute z-[9999] rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 0 4px #D4B08C, 0 0 40px rgba(212,176,140,0.3), inset 0 0 20px color-mix(in srgb, var(--accent-primary) 10%, transparent)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute z-[10000] w-[360px] bg-[#141414] border border-[rgba(212,176,140,0.15)] rounded-2xl p-6 shadow-2xl transition-all duration-300"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-[#D4B08C] uppercase tracking-wider">
            Step {currentStep + 1} of {tourSteps.length}
          </div>
          <button 
            onClick={onSkip}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-white mb-3 font-serif">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          {renderDescription(step.description)}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-1 text-sm text-white/40 hover:text-white disabled:opacity-30 disabled:hover:text-white/40 transition-colors"
          >
            <CaretLeft size={16} />
            Back
          </button>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {tourSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  i === currentStep ? 'bg-[#D4B08C] w-4' : 'bg-white/20 hover:bg-white/40'
                )}
              />
            ))}
          </div>

          <button
            onClick={nextStep}
            className="flex items-center gap-1 text-sm text-[#D4B08C] hover:text-[#e4c09c] font-medium transition-colors"
          >
            {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {/* Floating progress indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-[#141414]/90 backdrop-blur-sm border border-[color-mix(in srgb, var(--accent-primary) 10%, transparent)] rounded-full z-[10001]">
        <Sparkle className="w-4 h-4 text-[#D4B08C]" />
        <span className="text-sm text-white/60">Guided Tour</span>
        <div className="flex gap-1">
          {tourSteps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all duration-200',
                i === currentStep ? 'bg-[#D4B08C]' : 'bg-white/20'
              )}
            />
          ))}
        </div>
        <button 
          onClick={onSkip}
          className="text-xs text-white/40 hover:text-white ml-2"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export default GuidedTour;
