import React, { useEffect, useRef } from 'react';
// @ts-ignore - Importing from sibling app
import { A2UIRenderer, createRenderer } from '../../../../ui/src/a2ui/renderer';
// @ts-ignore - Importing from sibling app
import type { RenderContext } from '../../../../ui/src/a2ui/core/renderer-new';

interface A2UISurfaceProps {
  schema: any; 
  dataModel?: Record<string, unknown>;
  onAction?: (actionId: string, context: any) => void;
  onModelChange?: (path: string, value: unknown) => void;
  className?: string;
}

export const A2UISurface: React.FC<A2UISurfaceProps> = ({
  schema,
  dataModel = {},
  onAction,
  onModelChange,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<A2UIRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!rendererRef.current) {
      rendererRef.current = createRenderer({ container: containerRef.current });
    }

    const context: RenderContext = {
      dataModel,
      onAction: (actionId: string, ctx: any) => {
        onAction?.(actionId, ctx);
      },
      onBindingChange: (path, value) => {
        if (onModelChange) {
          onModelChange(path, value);
        } else if (dataModel) {
          (dataModel as any)[path] = value;
        }
      },
      spec: {} as any,
    };

    if (schema) {
      const payload = schema.surfaces ? schema : {
        surfaces: [{
          id: 'main',
          root: schema
        }]
      };
      
      console.log('[FPRINT] A2UISurface render call:', {
        schemaType: schema.type,
        dataModelKeys: Object.keys(dataModel)
      });

      try {
        rendererRef.current.render(payload, context);
      } catch (err) {
        console.error('[A2UISurface] Render error:', err);
      }
    }
  }, [schema, dataModel, onAction]);

  useEffect(() => {
    return () => {
      rendererRef.current?.unmount();
    };
  }, []);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
};
