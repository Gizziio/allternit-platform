/**
 * @fileoverview Onboarding Wizard Module
 * 
 * Main entry point for the onboarding wizard components and utilities.
 * 
 * @module components/onboarding
 * @example
 * ```tsx
 * import { OnboardingWizard, useWizard, usePlatformDetection } from './onboarding';
 * 
 * function App() {
 *   return (
 *     <OnboardingWizard 
 *       onComplete={() => console.log('Setup complete!')}
 *       onCancel={() => console.log('Setup cancelled')}
 *     />
 *   );
 * }
 * ```
 */

// Main wizard component
export { OnboardingWizard, CompactOnboardingWizard } from './Wizard';
export type { OnboardingWizardProps } from './Wizard';

// Context and state management
export {
  WizardContext,
  WizardProvider,
  useWizard,
  initialWizardState,
} from './context';
export type {
  WizardState,
  WizardContextValue,
  WizardProviderProps,
  PlatformInfo,
  PlatformType,
  Architecture,
  SetupMode,
  VMStatus,
  DownloadFileStatus,
} from './context';

// Custom hooks
export {
  usePlatformDetection,
  useDownloadManager,
  useVMInitializer,
  useKeyboardNavigation,
} from './hooks';
export type {
  UsePlatformDetectionOptions,
  UsePlatformDetectionResult,
  UseDownloadManagerOptions,
  UseDownloadManagerResult,
  UseVMInitializerOptions,
  UseVMInitializerResult,
  UseKeyboardNavigationOptions,
} from './hooks';

// Step components
export { WelcomeStep } from './steps/Welcome';
export { PlatformCheckStep } from './steps/PlatformCheck';
export { DownloadImagesStep } from './steps/DownloadImages';
export { InitializeVMStep } from './steps/InitializeVM';
export { CompleteStep } from './steps/Complete';

// Re-export step props for advanced usage
export type { WelcomeStepProps } from './steps/Welcome';
export type { PlatformCheckStepProps } from './steps/PlatformCheck';
export type { DownloadImagesStepProps } from './steps/DownloadImages';
export type { InitializeVMStepProps } from './steps/InitializeVM';
export type { CompleteStepProps } from './steps/Complete';

// Shared components
export { Step } from './components/Step';
export { Button } from './components/Button';
export { 
  ProgressBar, 
  MultiProgressBar, 
  CircularProgress 
} from './components/ProgressBar';

// Re-export shared component props
export type { StepProps } from './components/Step';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';
export type { 
  ProgressBarProps, 
  ProgressBarSize, 
  ProgressBarColor,
  MultiProgressBarProps,
  CircularProgressProps,
} from './components/ProgressBar';
