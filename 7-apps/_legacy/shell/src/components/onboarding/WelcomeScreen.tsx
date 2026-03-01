import React from 'react';
import { useOnboarding } from '../../runtime/OnboardingContext';
import '../../styles/onboarding.css';

export const WelcomeScreen: React.FC = () => {
  const { nextStep, skipOnboarding } = useOnboarding();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-emoji">✨</div>
          <h1 className="onboarding-title">Welcome to A2rchitech</h1>
          <p className="onboarding-subtitle">
            Your intelligent agentic workspace. Let's set up your environment to maximize productivity with autonomous agents.
          </p>
        </div>

        <div className="onboarding-content">
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            padding: '24px', 
            borderRadius: '20px',
            textAlign: 'center',
            border: '1px solid var(--ob-glass-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '1.2rem' }}>What can agents do?</h3>
            <p style={{ margin: 0, color: 'var(--ob-text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
              Agents can browse the web, write code, manage your schedule, and help you brainstorm complex ideas—all while you maintain full control.
            </p>
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn onboarding-btn-ghost" onClick={skipOnboarding}>
            Skip Setup
          </button>
          <div className="onboarding-progress">
            <div className="progress-dot active" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
          </div>
          <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
            Get Started <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
