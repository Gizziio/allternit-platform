/**
 * Snap Guides Component
 *
 * Visual indicators shown during drag/resize operations
 * when windows are near snap positions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWindowManager } from './WindowManager';
import { getSnapBounds, type CapsuleWindow, type WindowSnap } from './types';

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    zIndex: 9999,
  },
  guide: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    border: '2px solid rgba(59, 130, 246, 0.8)',
    borderRadius: '4px',
    pointerEvents: 'none' as const,
    transition: 'opacity 0.15s ease',
  },
  label: {
    position: 'absolute' as const,
    top: '-24px',
    left: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
};

// ============================================================================
// Component Props
// ============================================================================

interface SnapGuidesProps {
  windowId: string;
  visible?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SnapGuides: React.FC<SnapGuidesProps> = ({ windowId, visible = true }) => {
  const { state, getWindow, moveWindow } = useWindowManager();
  const [snapBounds, setSnapBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [activeSnap, setActiveSnap] = useState<WindowSnap>(null);

  const window = getWindow(windowId);
  if (!window || !visible || window.state !== 'normal') return null;

  // Check for snap bounds on each render during drag
  useEffect(() => {
    const bounds = getSnapBounds(window, state.canvasBounds);
    setSnapBounds(bounds);
    if (bounds) {
      if (bounds.x === state.canvasBounds.x) setActiveSnap('left');
      else if (bounds.x + bounds.width >= state.canvasBounds.x + state.canvasBounds.width - 50) setActiveSnap('right');
      else if (bounds.y === state.canvasBounds.y) setActiveSnap('top');
      else if (bounds.y + bounds.height >= state.canvasBounds.y + state.canvasBounds.height - 50) setActiveSnap('bottom');
      else setActiveSnap(null);
    } else {
      setActiveSnap(null);
    }
  }, [window, state.canvasBounds]);

  if (!snapBounds || !activeSnap) return null;

  return (
    <div style={styles.container}>
      {/* Snap guide rectangle */}
      <div
        style={{
          ...styles.guide,
          left: snapBounds.x,
          top: snapBounds.y,
          width: snapBounds.width,
          height: snapBounds.height,
        }}
      >
        {/* Snap label */}
        <div style={styles.label}>
          {activeSnap === 'left' && 'Snap to Left'}
          {activeSnap === 'right' && 'Snap to Right'}
          {activeSnap === 'top' && 'Snap to Top'}
          {activeSnap === 'bottom' && 'Snap to Bottom'}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Snap Indicator Dots
// ============================================================================

interface SnapIndicatorProps {
  windowId: string;
  canvasBounds: { width: number; height: number };
}

export const SnapIndicators: React.FC<SnapIndicatorProps> = ({ windowId, canvasBounds }) => {
  const { getWindow } = useWindowManager();
  const window = getWindow(windowId);
  if (!window) return null;

  const indicators = [
    { snap: 'left' as WindowSnap, x: canvasBounds.width * 0.25 - 40, y: canvasBounds.height / 2 - 30 },
    { snap: 'right' as WindowSnap, x: canvasBounds.width * 0.75 - 40, y: canvasBounds.height / 2 - 30 },
    { snap: 'top' as WindowSnap, x: canvasBounds.width / 2 - 40, y: canvasBounds.height * 0.25 - 30 },
    { snap: 'bottom' as WindowSnap, x: canvasBounds.width / 2 - 40, y: canvasBounds.height * 0.75 - 30 },
  ];

  return (
    <>
      {indicators.map((ind) => (
        <div
          key={ind.snap}
          style={{
            position: 'absolute',
            left: ind.x,
            top: ind.y,
            width: '80px',
            height: '60px',
            border: '2px dashed rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(59, 130, 246, 0.7)',
            fontSize: '11px',
            textTransform: 'capitalize' as const,
          }}
        >
          {ind.snap}
        </div>
      ))}
    </>
  );
};

// ============================================================================
// Export
// ============================================================================

export default SnapGuides;
