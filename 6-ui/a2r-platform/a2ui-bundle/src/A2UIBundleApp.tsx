/**
 * A2UI Bundle App Component
 * Ported from OpenClaw A2UI implementation
 * 
 * This is the root component that renders A2UI payloads and handles actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { A2UIPayload, A2UIActionEvent } from '../../src/types/a2ui';

interface Surface {
  id: string;
  payload: A2UIPayload;
}

export function A2UIBundleApp() {
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [currentPayload, setCurrentPayload] = useState<A2UIPayload | null>(null);
  const [dataModel, setDataModel] = useState<Record<string, unknown>>({});

  // Listen for messages from host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'A2R_PUSH_PAYLOAD') {
        const payload = event.data.payload as A2UIPayload;
        setCurrentPayload(payload);
        setDataModel(payload.dataModel || {});
        setSurfaces([{ id: 'main', payload }]);
      }

      if (event.data?.type === 'A2R_UPDATE_DATA') {
        setDataModel(prev => ({ ...prev, ...event.data.data }));
      }

      if (event.data?.type === 'A2R_ACTION_RESPONSE') {
        // Handle action response
        console.log('[A2UI] Action response:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle actions from components
  const handleAction = useCallback((actionId: string, payload?: Record<string, unknown>) => {
    const action: A2UIActionEvent = {
      id: crypto.randomUUID(),
      name: actionId,
      surfaceId: 'main',
      sourceComponentId: actionId,
      context: {
        dataModel,
        ...payload,
        timestamp: Date.now(),
      },
    };

    // Send to host via bridge
    if (typeof window.a2rSendUserAction === 'function') {
      window.a2rSendUserAction(action);
    } else if (window.parent !== window) {
      window.parent.postMessage({ type: 'A2R_ACTION', payload: action }, '*');
    }

    // Also dispatch custom event for internal handling
    window.dispatchEvent(new CustomEvent('a2r:action', { detail: action }));
  }, [dataModel]);

  // Render surface
  const renderSurface = (surface: Surface) => {
    return (
      <div key={surface.id} className="a2ui-surface" data-surface-id={surface.id}>
        <A2UIRenderer 
          payload={surface.payload} 
          dataModel={dataModel}
          onAction={handleAction}
        />
      </div>
    );
  };

  if (surfaces.length === 0) {
    return (
      <div className="a2ui-empty">
        <h1>A2UI Ready</h1>
        <p>Waiting for payload...</p>
        <div className="a2ui-status">
          <span className={typeof window.a2rSendUserAction === 'function' ? 'ok' : 'bad'}>
            Bridge: {typeof window.a2rSendUserAction === 'function' ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="a2ui-root">
      {surfaces.map(renderSurface)}
    </div>
  );
}

// Simplified A2UI Renderer
interface A2UIRendererProps {
  payload: A2UIPayload;
  dataModel: Record<string, unknown>;
  onAction: (actionId: string, payload?: Record<string, unknown>) => void;
}

function A2UIRenderer({ payload, dataModel, onAction }: A2UIRendererProps) {
  // Render the root component
  if (!payload.surfaces || payload.surfaces.length === 0) {
    return <div className="a2ui-error">No surfaces in payload</div>;
  }

  const surface = payload.surfaces[0];
  if (!surface.root) {
    return <div className="a2ui-error">No root component in surface</div>;
  }

  return (
    <div className="a2ui-content">
      <RenderNode 
        node={surface.root} 
        dataModel={dataModel} 
        onAction={onAction}
      />
    </div>
  );
}

// Recursive node renderer
interface RenderNodeProps {
  node: any;
  dataModel: Record<string, unknown>;
  onAction: (actionId: string, payload?: Record<string, unknown>) => void;
}

function RenderNode({ node, dataModel, onAction }: RenderNodeProps) {
  if (!node) return null;

  const { type, props = {}, children = [] } = node;

  // Handle text nodes
  if (type === 'text') {
    return <>{props.content}</>;
  }

  // Process props (bind data model values)
  const processedProps = Object.entries(props).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const path = value.slice(2, -2).trim();
      acc[key] = getValueByPath(dataModel, path);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as any);

  // Handle action handlers
  if (processedProps.onClick) {
    const actionId = processedProps.onClick;
    processedProps.onClick = () => onAction(actionId);
  }

  // Render based on component type
  switch (type) {
    case 'Container':
      return <div {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</div>;
    case 'Stack':
      return <div className="a2ui-stack" {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</div>;
    case 'Grid':
      return <div className="a2ui-grid" {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</div>;
    case 'Text':
      return <span {...processedProps}>{processedProps.content}</span>;
    case 'Card':
      return <div className="a2ui-card" {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</div>;
    case 'Button':
      return <button {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</button>;
    case 'TextField':
      return <input type="text" {...processedProps} />;
    case 'Badge':
      return <span className="a2ui-badge" {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</span>;
    case 'Image':
      return <img {...processedProps} alt={processedProps.alt || ''} />;
    default:
      return <div data-type={type} {...processedProps}>{children.map((c: any, i: number) => <RenderNode key={i} node={c} dataModel={dataModel} onAction={onAction} />)}</div>;
  }
}

// Helper to get nested values by path
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}
