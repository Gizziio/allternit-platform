/**
 * SheetsRenderer.tsx
 * 
 * Renders A2R Data artifacts.
 * Uses A2RDataGrid (AG-Grid wrapper) for data visualization.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { A2RDataGrid } from '@/components/a2r/A2RDataGrid';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';

interface SheetsRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

/**
 * SheetsRenderer - A2R Data Artifact Renderer
 * 
 * Wraps A2RDataGrid for use in the Canvas/sidecar.
 * Provides full data grid capabilities.
 */
export function SheetsRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: SheetsRendererProps) {
  // Parse data from artifact content
  const { columns, data } = useMemo(() => {
    if (!artifact.content) {
      return {
        columns: [
          { key: 'name', label: 'Name', type: 'text' as const },
          { key: 'value', label: 'Value', type: 'number' as const },
        ],
        data: [
          { name: 'Example 1', value: 100 },
          { name: 'Example 2', value: 200 },
        ],
      };
    }

    // Parse CSV-like content
    const lines = artifact.content.trim().split('\n');
    if (lines.length < 2) {
      return { columns: [], data: [] };
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const parsedColumns = headers.map((header) => ({
      key: header.toLowerCase().replace(/\s+/g, '_'),
      label: header,
      type: 'text' as const,
    }));

    const parsedData = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, any> = { id: `row-${index}` };
      headers.forEach((header, i) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        const value = values[i];
        // Try to parse as number
        row[key] = isNaN(Number(value)) ? value : Number(value);
      });
      return row;
    });

    return { columns: parsedColumns, data: parsedData };
  }, [artifact.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <A2RDataGrid
        columns={columns}
        data={data}
        title={artifact.title}
        showToolbar={true}
        enableCharts={true}
        className="h-full"
      />
    </motion.div>
  );
}

export default SheetsRenderer;
