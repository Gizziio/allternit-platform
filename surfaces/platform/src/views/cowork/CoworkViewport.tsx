/**
 * CoworkViewport - Viewport panel for Cowork mode
 * Displays observations (screenshots) with labels and OCR overlays
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import type { ObservationEvent } from './cowork.types';
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOut,
  SquaresFour,
  Eye,
  EyeSlash,
  Cursor,
  Crosshair,
} from '@phosphor-icons/react';

// ============================================================================
// Label Overlay Component
// ============================================================================

const LabelOverlay = memo(function LabelOverlay({
  label,
  isHovered,
  onHover,
  scale,
}: {
  label: NonNullable<ObservationEvent['labels']>[number];
  isHovered: boolean;
  onHover: (id: string | null) => void;
  scale: number;
}) {
  const colors = {
    button: 'bg-blue-500/30 border-blue-400',
    input: 'bg-green-500/30 border-green-400',
    link: 'bg-purple-500/30 border-purple-400',
    text: 'bg-gray-500/30 border-gray-400',
  };
  
  return (
    <div
      className={cn(
        "absolute border-2 rounded cursor-pointer transition-all",
        colors[label.type],
        isHovered && "ring-2 ring-white/50 z-10"
      )}
      style={{
        left: label.x * scale,
        top: label.y * scale,
        transform: 'translate(-50%, -50%)',
        padding: '2px 6px',
      }}
      onMouseEnter={() => onHover(label.id)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="text-[10px] font-bold text-white drop-shadow-md whitespace-nowrap">
        {label.id}
      </span>
      {isHovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-black/80 rounded text-[10px] text-white whitespace-nowrap z-20">
          {label.text}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// OCR Region Component
// ============================================================================

const OcrRegion = memo(function OcrRegion({
  region,
  scale,
}: {
  region: NonNullable<ObservationEvent['ocr']>['regions'][number];
  scale: number;
}) {
  return (
    <div
      className="absolute border border-yellow-400/30 bg-yellow-400/10 hover:bg-yellow-400/20 transition-colors cursor-pointer group"
      style={{
        left: region.x * scale,
        top: region.y * scale,
        width: region.width * scale,
        height: region.height * scale,
      }}
    >
      <div className="opacity-0 group-hover:opacity-100 absolute top-full left-0 mt-1 px-2 py-1 bg-black/80 rounded text-[10px] text-white whitespace-nowrap z-20 max-w-[200px] truncate">
        {region.text}
      </div>
    </div>
  );
});

// ============================================================================
// Click Marker Component
// ============================================================================

const ClickMarker = memo(function ClickMarker({
  x,
  y,
  scale,
  label,
}: {
  x: number;
  y: number;
  scale: number;
  label?: string;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x * scale,
        top: y * scale,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative">
        {/* Outer ring */}
        <div className="absolute inset-0 w-6 h-6 -m-3 rounded-full border-2 border-green-400/50 animate-ping" />
        {/* Inner dot */}
        <div className="w-3 h-3 -m-1.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
        {/* Label */}
        {label && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 bg-green-400 text-black text-[9px] font-bold rounded whitespace-nowrap">
            {label}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Viewport Component
// ============================================================================

export const CoworkViewport = memo(function CoworkViewport() {
  const { 
    session, 
    viewportZoom, 
    setViewportZoom,
    showLabels,
    showOcr,
    toggleLabels,
    toggleOcr,
    selectedEventId,
  } = useCoworkStore();
  
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentObservation = session?.currentObservation;
  
  // Get selected event if it's an observation
  const selectedObservation = session?.events.find(
    e => e.id === selectedEventId && e.type === 'cowork.observation'
  ) as ObservationEvent | undefined;
  
  // Use selected observation or current
  const displayObservation = selectedObservation || currentObservation;
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  
  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0d0d0d] text-white/30">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
          <Crosshair size={24} />
        </div>
        <p className="text-sm">No active session</p>
        <p className="text-xs text-white/20 mt-1">Start a cowork session to see the viewport</p>
      </div>
    );
  }
  
  // Calculate scale based on container and image
  const baseScale = viewportZoom;
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "h-full flex flex-col bg-[#0d0d0d]",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-white/5 bg-[#161616]">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-white/50 mr-2">
            {session.viewportType === 'browser' ? 'Browser' : 
             session.viewportType === 'desktop' ? 'Desktop' : 'Remote'}
          </span>
          
          {/* Zoom controls */}
          <button
            onClick={() => setViewportZoom(viewportZoom - 0.1)}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80"
            title="Zoom out"
          >
            <MagnifyingGlassMinus size={16} />
          </button>
          <span className="text-xs text-white/40 w-12 text-center">
            {Math.round(viewportZoom * 100)}%
          </span>
          <button
            onClick={() => setViewportZoom(viewportZoom + 0.1)}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80"
            title="Zoom in"
          >
            <MagnifyingGlassPlus size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Toggle labels */}
          <button
            onClick={toggleLabels}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              showLabels 
                ? "bg-blue-500/20 text-blue-400" 
                : "text-white/40 hover:text-white/60"
            )}
          >
            <SquaresFour className="w-3.5 h-3.5" />
            Labels
          </button>
          
          {/* Toggle OCR */}
          <button
            onClick={toggleOcr}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              showOcr 
                ? "bg-yellow-500/20 text-yellow-400" 
                : "text-white/40 hover:text-white/60"
            )}
          >
            {showOcr ? <Eye className="w-3.5 h-3.5" /> : <EyeSlash className="w-3.5 h-3.5" />}
            OCR
          </button>
          
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 ml-2"
            title="Fullscreen"
          >
            <ArrowsOut size={16} />
          </button>
        </div>
      </div>
      
      {/* Viewport content */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        {displayObservation ? (
          <div 
            className="relative inline-block"
            style={{
              transform: `scale(${baseScale})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Screenshot image */}
            <img
              src={displayObservation.imageRef}
              alt="Viewport"
              className="rounded-lg shadow-2xl"
              style={{
                maxWidth: displayObservation.metadata.width,
                maxHeight: displayObservation.metadata.height,
              }}
            />
            
            {/* Labels overlay */}
            {showLabels && displayObservation.labels?.map((label) => (
              <LabelOverlay
                key={label.id}
                label={label}
                isHovered={hoveredLabel === label.id}
                onHover={setHoveredLabel}
                scale={1}
              />
            ))}
            
            {/* OCR overlay */}
            {showOcr && displayObservation.ocr?.regions.map((region, idx) => (
              <OcrRegion
                key={`ocr-region-${idx}`}
                region={region}
                scale={1}
              />
            ))}
            
            {/* Click markers from recent actions */}
            {session.events
              .filter(e => e.type === 'cowork.action')
              .slice(-3)
              .map((action, idx) => {
                const actionEvent = action as any;
                if (actionEvent.target?.type === 'coordinates') {
                  const [x, y] = actionEvent.target.value.split(',').map(Number);
                  return (
                    <ClickMarker
                      key={action.id}
                      x={x}
                      y={y}
                      scale={1}
                      label={idx === 0 ? 'last' : undefined}
                    />
                  );
                }
                return null;
              })}
          </div>
        ) : (
          <div className="text-center text-white/20">
            <Cursor className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Waiting for observation...</p>
            <p className="text-xs text-white/10 mt-1 max-w-[280px]">
              The agent will stream screenshots here. Ensure the backend is connected.
            </p>
          </div>
        )}
      </div>
      
      {/* Status bar */}
      <div className="px-3 py-2 border-t border-white/5 bg-[#161616] flex items-center justify-between text-[10px] text-white/30">
        <div className="flex items-center gap-3">
          <span>Status: <span className={cn(
            "font-medium",
            session.status === 'running' ? 'text-green-400' :
            session.status === 'paused' ? 'text-yellow-400' :
            session.status === 'waiting_approval' ? 'text-orange-400' :
            session.status === 'takeover' ? 'text-purple-400' :
            'text-white/50'
          )}>{session.status}</span></span>
          {displayObservation && (
            <span>{displayObservation.metadata.width}×{displayObservation.metadata.height}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{session.metrics.actionsExecuted} actions</span>
          <span>{session.checkpoints.length} checkpoints</span>
        </div>
      </div>
    </div>
  );
});

export default CoworkViewport;
