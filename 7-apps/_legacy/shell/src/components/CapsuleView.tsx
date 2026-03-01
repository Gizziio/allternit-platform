import React, { useEffect, useRef, useContext, useState } from 'react';
import { CanvasSpec, ViewSpec } from '../../../shared/contracts';
import { renderCanvas } from '../../../ui/src/index';
import { ShellStateContext } from '../runtime/ShellState';
import { WindowedBrowserView } from './windowing';

console.log('[FPRINT] CapsuleView.tsx loaded', import.meta.url);

interface CapsuleViewProps {
  capsuleId: string;
  title: string;
  canvasId?: string;
  isActive: boolean;
}

const isBrowserView = (view: ViewSpec): boolean => view.type === 'browser_view';

const findBrowserView = (spec: CanvasSpec): ViewSpec | undefined => spec.views?.find(isBrowserView);

export const CapsuleView: React.FC<CapsuleViewProps> = ({
  capsuleId,
  title,
  canvasId,
  isActive
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { canvasesByCapsuleId } = useContext(ShellStateContext)!;

  useEffect(() => {
    if (!headerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.contentRect.height);
      }
    });

    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const canvasSpec = canvasesByCapsuleId?.get(capsuleId);
  const isFluid = canvasSpec?.views.some(v => v.type === 'iframe_view' || v.type === 'browser_view' || v.type === 'studio_view');
  const browserView = canvasSpec ? findBrowserView(canvasSpec) : undefined;
  const hasBrowserView = !!browserView;

  useEffect(() => {
    if (canvasRef.current && isActive) {
      const renderCanvasFromState = () => {
        try {
          let currentSpec = canvasSpec;

          if (currentSpec) {
            renderCanvas(canvasRef.current!, currentSpec);
          } else {
            const fallbackSpec: CanvasSpec = {
              canvasId: capsuleId,
              title: `Canvas for ${title}`,
              views: []
            };
            renderCanvas(canvasRef.current!, fallbackSpec);
          }

          const handleExecuteProposal = (e: any) => {
            const { proposal } = e.detail;
            console.log('Executing proposal from canvas:', proposal);
          };

          canvasRef.current!.addEventListener('executeProposal', handleExecuteProposal);

          return () => {
            if (canvasRef.current) {
              canvasRef.current.removeEventListener('executeProposal', handleExecuteProposal);
            }
          };
        } catch (error) {
          console.error('Error rendering canvas:', error);
          if (canvasRef.current) {
            canvasRef.current.innerHTML = `
              <div class="canvas-error">
                <h3>Error loading canvas</h3>
                <p>Failed to load canvas for capsule: ${capsuleId}</p>
                <p>Error: ${(error as Error).message}</p>
                <button onclick="location.reload()">Retry</button>
              </div>
            `;
          }
        }
      };

      renderCanvasFromState();
    }
  }, [capsuleId, canvasId, isActive, canvasesByCapsuleId, headerHeight]);

  if (hasBrowserView && isActive) {
    const initialUrl = (browserView as any).bindings?.data?.url ||
                       (browserView as any).url ||
                       'https://www.google.com';

    console.log('[CapsuleView] [NEW_WINDOWED_BROWSER_VIEW_RENDER] capsuleId=', capsuleId, 'url=', initialUrl);

    return (
      <div className={`capsule-view ${isActive ? 'active' : ''}`}>
        <div
          className={`capsule-content ${isFluid ? 'fluid-content' : ''}`}
          style={{ height: '100%' }}
        >
          <WindowedBrowserView
            capsuleId={capsuleId}
            spaceId={canvasSpec?.canvasId || capsuleId}
            initialUrl={initialUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`capsule-view ${isActive ? 'active' : ''}`}>
      {!isFluid && (
        <div className="capsule-header" ref={headerRef}>
          <h2>{title} <span style={{ fontSize: '10px', opacity: 0.5 }}>v1.0.2</span></h2>
          <div className="capsule-meta">
            <span className="capsule-id">ID: {capsuleId.substring(0, 8)}...</span>
            <span className="capsule-framework-badge">Framework: {capsuleId.substring(0, 4)}</span>
          </div>
        </div>
      )}
      <div
        className={`capsule-content ${isFluid ? 'fluid-content' : ''}`}
        style={{ height: (isActive && !isFluid && headerHeight) ? `calc(100dvh - ${headerHeight}px)` : '100%' }}
      >
        <div ref={canvasRef} className="canvas-container" />
      </div>
    </div>
  );
};
