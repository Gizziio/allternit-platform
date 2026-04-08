/**
 * CanvasRouter.tsx
 * 
 * Routes artifacts to their appropriate renderers based on type.
 * This is the "program loader" for the A2r-Canvas computer.
 */

import React, { useMemo } from 'react';
import { DocumentRenderer } from './renderers/DocumentRenderer';
import { SlidesRenderer } from './renderers/SlidesRenderer';
import { SheetsRenderer } from './renderers/SheetsRenderer';
import { CodeRenderer } from './renderers/CodeRenderer';
import { ImageRenderer } from './renderers/ImageRenderer';
import { VideoRenderer } from './renderers/VideoRenderer';
import { AudioRenderer } from './renderers/AudioRenderer';
import { MermaidRenderer } from './renderers/MermaidRenderer';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import { cn } from '@/lib/utils';

export type RendererType = 
  | 'document'
  | 'slides'
  | 'sheet'
  | 'html'
  | 'jsx'
  | 'image'
  | 'svg'
  | 'video'
  | 'audio'
  | 'mermaid'
  | null;

interface CanvasRouterProps {
  artifact: ArtifactUIPart | null;
  rendererType: RendererType;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

export function CanvasRouter({
  artifact,
  rendererType,
  sessionId,
  onMoATaskUpdate,
}: CanvasRouterProps) {
  // Determine which renderer to use
  const RendererComponent = useMemo(() => {
    if (!artifact || !rendererType) return null;

    switch (rendererType) {
      case 'document':
        return DocumentRenderer;
      case 'slides':
        return SlidesRenderer;
      case 'sheet':
        return SheetsRenderer;
      case 'html':
      case 'jsx':
        return CodeRenderer;
      case 'image':
      case 'svg':
        return ImageRenderer;
      case 'video':
        return VideoRenderer;
      case 'audio':
        return AudioRenderer;
      case 'mermaid':
        return MermaidRenderer;
      default:
        return null;
    }
  }, [artifact, rendererType]);

  if (!RendererComponent || !artifact) {
    return (
      <div className={cn(
        "h-full w-full flex items-center justify-center",
        "text-[var(--text-tertiary)] text-sm"
      )}>
        <div className="text-center space-y-2">
          <p>Unknown artifact type</p>
          <p className="text-xs opacity-50">Type: {rendererType}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <RendererComponent
        artifact={artifact}
        sessionId={sessionId}
        onMoATaskUpdate={onMoATaskUpdate}
      />
    </div>
  );
}
