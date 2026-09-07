/**
 * useCanvasStream.ts
 * 
 * Hook for managing artifact streaming and state in Allternit-Canvas.
 * Listens to Rust stream events and updates canvas content.
 * 
 * Persistence: when a backend session id is available, artifacts are mirrored
 * to the agent_canvas table via /api/v1/agent-sessions/:id/canvases so they
 * survive reloads and can be reopened from any surface.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import { canvasApi, type BackendCanvas } from '@/lib/agents/native-agent-api';
import { isAgentSessionsApiEnabled } from '@/lib/env';
import { useArtifactEventListener } from '@/lib/canvas/canvas-artifact-events';

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
  /** Backend canvas id, when persisted. */
  canvasId?: string;
}

function isBackendSessionId(sessionId: string): boolean {
  return sessionId.startsWith('ses');
}

function artifactToComponent(artifact: CanvasArtifact): Record<string, unknown> {
  return {
    type: 'artifact',
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    title: artifact.title,
    content: artifact.content,
    url: artifact.url,
  };
}

function backendCanvasToArtifact(canvas: BackendCanvas): CanvasArtifact | null {
  const components = Array.isArray(canvas.components) ? canvas.components : [];
  const component = components.find((c: any) => c?.type === 'artifact') as Record<string, unknown> | undefined;
  if (!component) return null;
  return {
    type: 'artifact',
    artifactId: String(component.artifactId ?? canvas.id),
    kind: (component.kind as CanvasArtifact['kind']) ?? 'document',
    title: String(component.title ?? canvas.title ?? 'Untitled'),
    content: component.content as string | undefined,
    url: component.url as string | undefined,
    id: String(component.artifactId ?? canvas.id),
    canvasId: canvas.id,
    createdAt: new Date(canvas.created_at).getTime(),
    updatedAt: new Date(canvas.updated_at).getTime(),
    metadata: canvas.metadata,
  };
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
  const pendingCanvasRef = useRef<Map<string, string>>(new Map());

  // Get active artifact
  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || null;

  // Load persisted canvases on mount when a backend session is available
  useEffect(() => {
    // Canvas persistence targets /api/v1/agent-sessions/:id/canvases, served
    // only by the Rust allternit-api (:8013) — skip when disabled by flag.
    if (!sessionId || !isBackendSessionId(sessionId) || !isAgentSessionsApiEnabled()) return;

    let cancelled = false;
    canvasApi.listCanvases(sessionId)
      .then((canvases) => {
        if (cancelled) return;
        const loaded = canvases
          .map(backendCanvasToArtifact)
          .filter((a): a is CanvasArtifact => a !== null);
        setArtifacts((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const merged = [...prev, ...loaded.filter((a) => !existingIds.has(a.id))];
          return merged;
        });
        loaded.forEach((a) => {
          if (a.canvasId) pendingCanvasRef.current.set(a.id, a.canvasId);
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [sessionId]);

  // Handle artifact selection
  const handleArtifactSelect = useCallback((artifactId: string) => {
    setActiveArtifactId(artifactId);
  }, []);

  // Persist artifact changes to backend canvas
  const persistArtifact = useCallback(async (artifact: CanvasArtifact) => {
    if (!sessionId || !isBackendSessionId(sessionId) || !isAgentSessionsApiEnabled()) return;

    try {
      const existingCanvasId = pendingCanvasRef.current.get(artifact.id);
      if (existingCanvasId) {
        await canvasApi.updateCanvas(existingCanvasId, {
          title: artifact.title,
          components: [artifactToComponent(artifact)],
        });
      } else {
        const canvas = await canvasApi.createCanvas(sessionId, {
          title: artifact.title,
          components: [artifactToComponent(artifact)],
          metadata: { artifactId: artifact.artifactId, kind: artifact.kind },
        });
        pendingCanvasRef.current.set(artifact.id, canvas.id);
      }
    } catch (error) {
      // Non-blocking: local canvas state remains authoritative
      console.error('Failed to persist canvas artifact:', error);
    }
  }, [sessionId]);

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
        
        void persistArtifact(updated);
        
        return prev.map(a => 
          a.artifactId === artifact.artifactId ? updated : a
        );
      } else {
        // Add new artifact
        const newArtifact: CanvasArtifact = {
          ...artifact,
          id: artifact.artifactId,
          createdAt: now,
          updatedAt: now,
        };
        
        void persistArtifact(newArtifact);
        
        return [...prev, newArtifact];
      }
    });

    // Auto-select first artifact
    if (!activeArtifactId && artifact.artifactId) {
      setActiveArtifactId(artifact.artifactId);
    }

    setStreamStatus('streaming');
  }, [activeArtifactId, persistArtifact]);

  // Listen for live artifact events produced by streaming surfaces
  useArtifactEventListener(sessionId, handleStreamUpdate);

  // Listen to stream events (if sessionId provided)
  useEffect(() => {
    if (!sessionId) return;

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
