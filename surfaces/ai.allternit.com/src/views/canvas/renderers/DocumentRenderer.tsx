/**
 * DocumentRenderer.tsx
 * 
 * Renders Allternit Document artifacts.
 * Uses AllternitDocumentEditor (BlockNote wrapper) for rich document editing.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AllternitDocumentEditor } from '@/components/allternit';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { MoATask } from '@/lib/api/moa-client';

interface DocumentRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: MoATask[]) => void;
}

export function DocumentRenderer({
  artifact,
  sessionId,
}: DocumentRendererProps) {
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
        readOnly={false}
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
