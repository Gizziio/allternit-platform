/**
 * useCanvasStream.ts
 * 
 * Hook for managing artifact streaming and state in Allternit-Canvas.
 * Listens to Rust stream events and updates canvas content.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';

interface UseCanvasStreamOptions {
  sessionId?: string;
  initialArtifactId?: string;
}

interface CanvasArtifact extends ArtifactUIPart {
  id: string;  // Maps to artifactId for local usage
  createdAt: number;
  updatedAt: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export function useCanvasStream({
  sessionId,
  initialArtifactId,
}: UseCanvasStreamOptions) {
  // State
  const [artifacts, setArtifacts] = useState<CanvasArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(initialArtifactId || null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'streaming' | 'complete' | 'error'>('idle');

  // Refs for stream handling
  const eventSourceRef = useRef<EventSource | null>(null);
  const artifactBufferRef = useRef<Map<string, CanvasArtifact>>(new Map());

  // Get active artifact
  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || null;

  // Handle artifact selection
  const handleArtifactSelect = useCallback((artifactId: string) => {
    setActiveArtifactId(artifactId);
  }, []);

  // Handle stream update (called from parent when Rust stream emits artifact)
  const handleStreamUpdate = useCallback((artifact: ArtifactUIPart) => {
    const now = Date.now();
    
    setArtifacts(prev => {
      const existing = prev.find(a => a.artifactId === artifact.artifactId);
      
      if (existing) {
        // Update existing artifact
        const updated = {
          ...existing,
          ...artifact,
          updatedAt: now,
          content: artifact.content || existing.content,
        };
        
        return prev.map(a => 
          a.artifactId === artifact.artifactId ? updated : a
        );
      } else {
        // Add new artifact
        const newArtifact: CanvasArtifact = {
          ...artifact,
          id: artifact.artifactId,  // Map artifactId to id for local usage
          createdAt: now,
          updatedAt: now,
        };
        
        return [...prev, newArtifact];
      }
    });

    // Auto-select first artifact
    if (!activeArtifactId && artifact.artifactId) {
      setActiveArtifactId(artifact.artifactId);
    }

    setStreamStatus('streaming');
  }, [activeArtifactId]);

  // Listen to stream events (if sessionId provided)
  useEffect(() => {
    if (!sessionId) return;

    // Connect to stream endpoint
    const streamUrl = `/api/canvas/stream?sessionId=${sessionId}`;
    
    // For now, we'll simulate stream events
    // In production, this would connect to Rust SSE stream
    console.log('[useCanvasStream] Would connect to:', streamUrl);

    // Simulate stream status
    setStreamStatus('idle');

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [sessionId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+A - Next artifact
      if (e.metaKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        const currentIndex = artifacts.findIndex(a => a.id === activeArtifactId);
        if (currentIndex < artifacts.length - 1) {
          setActiveArtifactId(artifacts[currentIndex + 1].id);
        }
      }
      
      // Cmd+Shift+Z - Previous artifact
      if (e.metaKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        const currentIndex = artifacts.findIndex(a => a.id === activeArtifactId);
        if (currentIndex > 0) {
          setActiveArtifactId(artifacts[currentIndex - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [artifacts, activeArtifactId]);

  return {
    // State
    artifacts,
    activeArtifact,
    activeArtifactId,
    streamStatus,
    
    // Actions
    handleArtifactSelect,
    handleStreamUpdate,
    
    // Utilities
    getArtifactById: (id: string) => artifacts.find(a => a.id === id),
    getArtifactsByType: (type: string) => artifacts.filter(a => a.type === type),
  };
}
