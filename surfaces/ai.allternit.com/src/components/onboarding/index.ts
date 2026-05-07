/**
 * Onboarding Components
 */

export { OnboardingFlow } from './OnboardingFlow';
export { OnboardingPortal } from './OnboardingPortal';
export { GuidedTourPortal } from './GuidedTourPortal';
export { InfrastructureStep } from './InfrastructureStep';
export { GuidedTour } from './GuidedTour';
export { GizziMascot } from '../ai-elements/GizziMascot';

// Services
export {
  testSSHConnection,
  installBackend,
  getVersionManifest,
  VPS_PROVIDERS,
  savePurchaseIntent,
  getPendingPurchases,
  checkCompletedPurchases,
  type SSHConnectionConfig,
  type SystemInfo,
  type InstallProgress,
  type VPSProvider,
} from './ssh-service';

// Default export
export { OnboardingFlow as default } from './OnboardingFlow';
