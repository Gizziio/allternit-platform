/**
 * @fileoverview Onboarding Wizard Component
 * 
 * Main wizard container component that orchestrates the onboarding flow
 * with step navigation, animations, and state management.
 * 
 * @module components/onboarding/Wizard
 * @example
 * ```tsx
 * import { OnboardingWizard } from './onboarding';
 * 
 * function App() {
 *   return <OnboardingWizard onComplete={() => console.log('Done!')} />;
 * }
 * ```
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WizardProvider, useWizard } from './context';
import { useKeyboardNavigation } from './hooks';
import { WelcomeStep } from './steps/Welcome';
import { PlatformCheckStep } from './steps/PlatformCheck';
import { DownloadImagesStep } from './steps/DownloadImages';
import { InitializeVMStep } from './steps/InitializeVM';
import { CompleteStep } from './steps/Complete';
import { ProgressBar } from './components/ProgressBar';
import type { WizardProviderProps } from './context';

/**
 * Wizard step configuration
 */
interface WizardStep {
  /** Unique identifier for the step */
  id: string;
  /** Step component */
  component: React.ComponentType<StepComponentProps>;
  /** Step title for progress indicator */
  title: string;
  /** Whether this step can be skipped */
  skippable?: boolean;
}

/**
 * Props passed to each step component
 */
interface StepComponentProps {
  /** Advance to next step */
  onNext: () => void;
  /** Go back to previous step */
  onBack: () => void;
  /** Finish the wizard */
  onFinish?: () => void;
}

/**
 * Steps configuration
 */
const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'welcome',
    component: WelcomeStep,
    title: 'Welcome',
  },
  {
    id: 'platform',
    component: PlatformCheckStep,
    title: 'Platform Check',
  },
  {
    id: 'download',
    component: DownloadImagesStep,
    title: 'Download Images',
  },
  {
    id: 'initialize',
    component: InitializeVMStep,
    title: 'Initialize VM',
  },
  {
    id: 'complete',
    component: CompleteStep,
    title: 'Complete',
  },
];

/**
 * Wizard progress indicator component
 */
function WizardProgress(): JSX.Element {
  const { currentStep } = useWizard();
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="px-8 py-6 border-b border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">
          Step {currentStep + 1} of {WIZARD_STEPS.length}
        </span>
        <span className="text-sm text-gray-500">
          {WIZARD_STEPS[currentStep]?.title}
        </span>
      </div>
      <ProgressBar value={progress} max={100} size="sm" color="blue" />
      
      {/* Step indicators */}
      <div className="flex items-center justify-between mt-4">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center">
              <motion.div
                className={`w-3 h-3 rounded-full transition-colors ${
                  isActive ? 'bg-blue-500' :
                  isCompleted ? 'bg-green-500' :
                  'bg-gray-700'
                }`}
                animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <span className={`text-xs mt-1 hidden sm:block ${
                isActive ? 'text-blue-400' :
                isCompleted ? 'text-green-400' :
                'text-gray-600'
              }`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Wizard content with step animations
 */
function WizardContent(): JSX.Element {
  const { currentStep, goToNext, goToBack, canGoBack, canGoNext } = useWizard();
  const [direction, setDirection] = useState(1);

  // Handle navigation with direction tracking for animations
  const handleNext = useCallback(() => {
    setDirection(1);
    goToNext();
  }, [goToNext]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    goToBack();
  }, [goToBack]);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: true,
    onEnter: canGoNext ? handleNext : undefined,
    onBack: canGoBack ? handleBack : undefined,
    onNext: canGoNext ? handleNext : undefined,
  });

  const CurrentStepComponent = WIZARD_STEPS[currentStep]?.component;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  if (!CurrentStepComponent) {
    return (
      <div className="p-8 text-center text-red-400">
        Error: Invalid step
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {React.createElement(CurrentStepComponent, {
            onNext: handleNext,
            onBack: handleBack,
            ...(isLastStep && { onFinish: handleNext }),
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Props for the OnboardingWizard component
 */
export interface OnboardingWizardProps {
  /** Callback when wizard is completed */
  onComplete?: () => void;
  /** Callback when wizard is cancelled */
  onCancel?: () => void;
  /** Initial step to start from (0-based index) */
  initialStep?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Main onboarding wizard component
 * 
 * Orchestrates the complete onboarding flow with:
 * - Step navigation with animations
 * - Progress indicators
 * - Keyboard navigation support
 * - State management through context
 * 
 * @param props - Component props
 * @returns {JSX.Element} Onboarding wizard component
 */
export function OnboardingWizard({
  onComplete,
  onCancel,
  initialStep = 0,
  className = '',
}: OnboardingWizardProps): JSX.Element {
  return (
    <WizardProvider
      totalSteps={WIZARD_STEPS.length}
      initialStep={initialStep}
      onComplete={onComplete}
    >
      <div className={`min-h-screen bg-gray-900 flex items-center justify-center p-4 ${className}`}>
        <motion.div
          className="w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-800 shadow-2xl shadow-black/50 overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Header with progress */}
          <WizardProgress />

          {/* Step content */}
          <WizardContent />

          {/* Footer with cancel option (except on last step) */}
          <div className="px-8 py-4 border-t border-gray-800 flex justify-between items-center">
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel setup
            </button>
            <span className="text-xs text-gray-600">
              Press Enter to continue
            </span>
          </div>
        </motion.div>
      </div>
    </WizardProvider>
  );
}

/**
 * Compact wizard for inline use
 * 
 * A smaller version of the wizard suitable for embedded use
 * in settings or dialogs.
 */
export function CompactOnboardingWizard({
  onComplete,
  initialStep = 0,
  className = '',
}: Omit<OnboardingWizardProps, 'onCancel'>): JSX.Element {
  return (
    <WizardProvider
      totalSteps={WIZARD_STEPS.length}
      initialStep={initialStep}
      onComplete={onComplete}
    >
      <div className={`bg-gray-900 rounded-xl border border-gray-800 overflow-hidden ${className}`}>
        {/* Compact progress */}
        <div className="px-6 py-4 border-b border-gray-800">
          <CompactWizardProgress />
        </div>

        {/* Step content */}
        <div className="p-6">
          <CompactWizardContent />
        </div>
      </div>
    </WizardProvider>
  );
}

/**
 * Compact progress indicator
 */
function CompactWizardProgress(): JSX.Element {
  const { currentStep } = useWizard();
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {WIZARD_STEPS[currentStep]?.title}
        </span>
        <span className="text-xs text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>
      <ProgressBar value={progress} max={100} size="sm" color="blue" />
    </div>
  );
}

/**
 * Compact wizard content
 */
function CompactWizardContent(): JSX.Element {
  const { currentStep, goToNext, goToBack } = useWizard();
  const [direction, setDirection] = useState(1);

  const handleNext = useCallback(() => {
    setDirection(1);
    goToNext();
  }, [goToNext]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    goToBack();
  }, [goToBack]);

  const CurrentStepComponent = WIZARD_STEPS[currentStep]?.component;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  if (!CurrentStepComponent) {
    return <div className="text-center text-red-400">Error: Invalid step</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={currentStep}
        custom={direction}
        initial={{ opacity: 0, x: direction * 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -10 }}
        transition={{ duration: 0.2 }}
      >
        {React.createElement(CurrentStepComponent, {
          onNext: handleNext,
          onBack: handleBack,
          ...(isLastStep && { onFinish: handleNext }),
        })}
      </motion.div>
    </AnimatePresence>
  );
}
