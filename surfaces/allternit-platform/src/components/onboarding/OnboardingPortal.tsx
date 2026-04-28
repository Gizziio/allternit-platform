/**
 * Onboarding Portal
 * 
 * Renders the onboarding flow outside the normal DOM hierarchy using React Portal.
 * This ensures the onboarding is not constrained by parent containers (grids, flex, etc.)
 * and always renders fullscreen at the correct z-index.
 */

import { createPortal } from 'react-dom';
import { OnboardingFlow } from './OnboardingFlow';

export function OnboardingPortal() {
  // Render onboarding at document.body level, outside any parent containers
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 200, // System layer — above modals, below dev
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Solid background — no see-through. The platform UI should not
        // be visible during onboarding; that looks unpolished.
        backgroundColor: '#0d0d10',
      }}
      data-onboarding-portal
    >
      <OnboardingFlow />
    </div>,
    document.body
  );
}
