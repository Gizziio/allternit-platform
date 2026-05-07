/**
 * DocumentRenderer.tsx
 * 
 * Renders Allternit Document artifacts.
 * Uses AllternitDocumentEditor (BlockNote wrapper) for rich document editing.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AllternitDocumentEditor } from '@/components/allternit';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { MoATask } from '@/lib/api/moa-client';

interface DocumentRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: MoATask[]) => void;
}

/**
 * DocumentRenderer - Allternit Document Artifact Renderer
 * 
 * Wraps AllternitDocumentEditor for use in the Canvas/sidecar.
 * Provides full document editing capabilities.
 */
export function DocumentRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: DocumentRendererProps) {
  const [editMode, setEditMode] = useState(false);

  // Handle document changes
  const handleChange = useCallback((content: unknown[]) => {
    // TODO: Save to backend
    console.log('[Allternit Document] Content changed:', content.length, 'blocks');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <AllternitDocumentEditor
        initialContent={artifact.content || ''}
        title={artifact.title}
        readOnly={!editMode}
        onChange={handleChange}
        showToolbar={true}
        className="h-full"
        metadata={{
          source: sessionId ? `Session: ${sessionId}` : undefined,
          updatedAt: new Date(),
        }}
      />
    </motion.div>
  );
}

export default DocumentRenderer;
