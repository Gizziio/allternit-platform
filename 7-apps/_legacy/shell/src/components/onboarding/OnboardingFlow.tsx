import React from 'react';
import { useOnboarding } from '../../runtime/OnboardingContext';
import { WelcomeScreen } from './WelcomeScreen';
import { BrainConfig } from './BrainConfig';
import { AgentSetup } from './AgentSetup';
import { SkillActivation } from './SkillActivation';
import { HelpSupport } from './HelpSupport';
import { Feedback } from './Feedback';
import '../../styles/onboarding.css';

export const OnboardingFlow: React.FC = () => {
  const { currentStep, isOnboardingComplete } = useOnboarding();

  if (isOnboardingComplete) {
    return null;
  }

  switch (currentStep) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'brain-config':
      return <BrainConfig />;
    case 'agent-setup':
      return <AgentSetup />;
    case 'skill-activation':
      return <SkillActivation />;
    case 'help-support':
      return <HelpSupport />;
    case 'feedback':
      return <Feedback />;
    default:
      return <WelcomeScreen />;
  }
};
