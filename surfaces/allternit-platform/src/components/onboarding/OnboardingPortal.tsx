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
        zIndex: 2147483647, // Max z-index
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
      }}
      data-onboarding-portal
    >
      <OnboardingFlow />
    </div>,
    document.body
  );
}
