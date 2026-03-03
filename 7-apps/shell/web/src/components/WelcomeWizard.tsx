import React, { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { X, ChevronRight, CheckCircle, Server, MessageSquare, Code, Sparkles } from 'lucide-react';

interface WelcomeWizardStore {
  hasCompletedWelcome: boolean;
  setCompleted: () => void;
}

const useWelcomeWizardStore = create<WelcomeWizardStore>()(
  persist(
    (set) => ({
      hasCompletedWelcome: false,
      setCompleted: () => set({ hasCompletedWelcome: true })
    }),
    {
      name: 'a2r-welcome-wizard'
    }
  )
);

const WELCOME_STEPS = [
  {
    title: 'Welcome to A2R Platform',
    subtitle: 'AI Browser Automation on Your Infrastructure',
    icon: Sparkles,
    content: `Deploy autonomous AI agents with full browser control. Your data stays on your servers. We host the interface, you host the compute.`
  },
  {
    title: 'Chat Mode',
    subtitle: 'Natural Language Automation',
    icon: MessageSquare,
    content: `Describe what you want to automate in plain English. Our AI agents understand context and execute complex browser workflows.`
  },
  {
    title: 'Code Mode',
    subtitle: 'Developer-Friendly Agent Control',
    icon: Code,
    content: `Write custom agent behaviors, define tools, and integrate with your existing codebase. Full control for advanced users.`
  },
  {
    title: 'VPS Connections',
    subtitle: 'Your Infrastructure, Your Data',
    icon: Server,
    content: `Connect your own servers to run AI agents. Complete privacy and control. Add VPS connections in Settings to get started.`
  }
];

/**
 * WelcomeWizard - First-time user onboarding overlay
 * 
 * Shows a wizard-style introduction to new users explaining
 * the platform's capabilities and how to get started.
 */
export const WelcomeWizard: React.FC = () => {
  const { hasCompletedWelcome, setCompleted } = useWelcomeWizardStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show wizard after a short delay if not completed
    if (!hasCompletedWelcome) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedWelcome]);

  const handleNext = () => {
    if (currentStep < WELCOME_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCompleted();
      setIsVisible(false);
    }
  };

  const handleSkip = () => {
    setCompleted();
    setIsVisible(false);
  };

  if (!isVisible || hasCompletedWelcome) {
    return null;
  }

  const CurrentIcon = WELCOME_STEPS[currentStep].icon;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        maxWidth: '520px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--accent-chat)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CurrentIcon style={{ width: '22px', height: '22px', color: '#ffffff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {WELCOME_STEPS[currentStep].title}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {WELCOME_STEPS[currentStep].subtitle}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X style={{ width: '20px', height: '20px', color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '32px 24px',
          overflowY: 'auto',
          flex: 1
        }}>
          <p style={{
            fontSize: '15px',
            lineHeight: '1.7',
            color: 'var(--text-primary)',
            marginBottom: '24px'
          }}>
            {WELCOME_STEPS[currentStep].content}
          </p>

          {/* Progress Indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px'
          }}>
            {WELCOME_STEPS.map((_, index) => (
              <div
                key={index}
                style={{
                  width: index === currentStep ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: index === currentStep 
                    ? 'var(--accent-chat)' 
                    : index < currentStep 
                      ? '#34c759' 
                      : 'var(--border-subtle)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {index < currentStep && (
                  <CheckCircle style={{ width: '12px', height: '12px', color: '#ffffff' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Skip Tutorial
          </button>
          
          <button
            onClick={handleNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--accent-chat)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {currentStep === WELCOME_STEPS.length - 1 ? 'Get Started' : 'Next'}
            <ChevronRight style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeWizard;
