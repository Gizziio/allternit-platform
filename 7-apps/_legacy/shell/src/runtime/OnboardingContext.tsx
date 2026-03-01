import * as React from 'react';

export type OnboardingStep =
  | 'welcome'
  | 'brain-config'
  | 'agent-setup'
  | 'skill-activation'
  | 'help-support'
  | 'feedback';

export type BrainType = 'api' | 'cli' | 'local';
export type FrameworkType = 'fwk.diff_review' | 'fwk.plan' | 'fwk.research' | 'fwk.build';

export interface SkillPackage {
  id: string;
  name: string;
  description: string;
  icon: string;
  frameworkType?: FrameworkType;
  skills: string[];
}

export interface OnboardingData {
  brainType: BrainType;
  modelSelection?: string;
  selectedSkillPackages: string[];
  agentNickname?: string;
  safetyTier?: 'strict' | 'balanced' | 'permissive';
  feedbackRating?: number;
  feedbackComment?: string;
}

interface OnboardingContextValue {
  currentStep: OnboardingStep;
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
}

const OnboardingContext = React.createContext<OnboardingContextValue | undefined>(undefined);

export const useOnboarding = (): OnboardingContextValue => {
  const context = React.useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: React.ReactNode;
}

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'brain-config',
  'agent-setup',
  'skill-activation',
  'help-support',
  'feedback',
];

const INITIAL_DATA: OnboardingData = {
  brainType: 'api',
  modelSelection: 'claude-sonnet-4-20250514',
  selectedSkillPackages: [],
  safetyTier: 'balanced',
};

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('welcome');
  const [onboardingData, setOnboardingData] = React.useState<OnboardingData>(INITIAL_DATA);
  const [isOnboardingComplete, setIsOnboardingComplete] = React.useState(false);

  // Load onboarding state from localStorage on mount
  React.useEffect(() => {
    const savedComplete = localStorage.getItem('a2rchitech_onboarding_complete');
    if (savedComplete === 'true') {
      setIsOnboardingComplete(true);
    }

    const savedData = localStorage.getItem('a2rchitech_onboarding_data');
    if (savedData) {
      try {
        setOnboardingData(JSON.parse(savedData));
      } catch (err) {
        console.error('Failed to parse saved onboarding data:', err);
      }
    }
  }, []);

  // Save onboarding data to localStorage when it changes
  React.useEffect(() => {
    if (!isOnboardingComplete) {
      localStorage.setItem('a2rchitech_onboarding_data', JSON.stringify(onboardingData));
    }
  }, [onboardingData, isOnboardingComplete]);

  const goToStep = React.useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
  }, []);

  const nextStep = React.useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  }, [currentStep]);

  const prevStep = React.useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  }, [currentStep]);

  const updateData = React.useCallback((data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  }, []);

  const completeOnboarding = React.useCallback(() => {
    setIsOnboardingComplete(true);
    localStorage.setItem('a2rchitech_onboarding_complete', 'true');
  }, []);

  const skipOnboarding = React.useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  const resetOnboarding = React.useCallback(() => {
    setCurrentStep('welcome');
    setOnboardingData(INITIAL_DATA);
    setIsOnboardingComplete(false);
    localStorage.removeItem('a2rchitech_onboarding_complete');
    localStorage.removeItem('a2rchitech_onboarding_data');
  }, []);

  const value: OnboardingContextValue = {
    currentStep,
    onboardingData,
    isOnboardingComplete,
    goToStep,
    nextStep,
    prevStep,
    updateData,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
