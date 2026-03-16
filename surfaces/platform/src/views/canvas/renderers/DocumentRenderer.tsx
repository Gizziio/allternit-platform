/**
 * DocumentRenderer.tsx
 * 
 * Renders A2R Document artifacts.
 * Uses A2RDocumentEditor (BlockNote wrapper) for rich document editing.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { A2RDocumentEditor } from '@/components/a2r/A2RDocumentEditor';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';

interface DocumentRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

/**
 * DocumentRenderer - A2R Document Artifact Renderer
 * 
 * Wraps A2RDocumentEditor for use in the Canvas/sidecar.
 * Provides full document editing capabilities.
 */
export function DocumentRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: DocumentRendererProps) {
  const [editMode, setEditMode] = useState(false);

  // Handle document changes
  const handleChange = useCallback((content: any[]) => {
    // TODO: Save to backend
    console.log('[A2R Document] Content changed:', content.length, 'blocks');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <A2RDocumentEditor
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
