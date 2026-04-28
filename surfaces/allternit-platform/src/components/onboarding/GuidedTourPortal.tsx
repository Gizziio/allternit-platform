/**
 * Guided Tour Portal
 * 
 * Renders the guided tour outside the normal DOM hierarchy using React Portal.
 */

import { createPortal } from 'react-dom';
import { GuidedTour } from './GuidedTour';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTourPortal({ onComplete, onSkip }: Props) {
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 210, // Just above onboarding portal
        isolation: 'isolate',
      }}
    >
      <GuidedTour onComplete={onComplete} onSkip={onSkip} />
    </div>,
    document.body
  );
}
