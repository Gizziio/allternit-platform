import React from 'react';
import { useOnboarding } from '../../runtime/OnboardingContext';

export const HelpSupport: React.FC = () => {
  const { nextStep, prevStep } = useOnboarding();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-emoji">🤝</div>
          <h1 className="onboarding-title">Help & Resources</h1>
          <p className="onboarding-subtitle">
            Stuck? Here's how to get the most out of a2rchitech.
          </p>
        </div>

        <div className="onboarding-content">
          <div className="help-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <a href="#" className="skill-card" onClick={(e) => e.preventDefault()} style={{ flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
              <div className="skill-icon" style={{ margin: 0, fontSize: '2rem' }}>📚</div>
              <div className="help-info">
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Documentation</h4>
                <p style={{ margin: '4px 0 0', color: 'var(--ob-text-muted)' }}>Comprehensive guides for all features</p>
              </div>
            </a>
            
            <a href="#" className="skill-card" onClick={(e) => e.preventDefault()} style={{ flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
              <div className="skill-icon" style={{ margin: 0, fontSize: '2rem' }}>🎥</div>
              <div className="help-info">
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Video Tutorials</h4>
                <p style={{ margin: '4px 0 0', color: 'var(--ob-text-muted)' }}>Watch step-by-step walkthroughs</p>
              </div>
            </a>
            
            <a href="#" className="skill-card" onClick={(e) => e.preventDefault()} style={{ flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
              <div className="skill-icon" style={{ margin: 0, fontSize: '2rem' }}>💬</div>
              <div className="help-info">
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Community Discord</h4>
                <p style={{ margin: '4px 0 0', color: 'var(--ob-text-muted)' }}>Join other architects and share ideas</p>
              </div>
            </a>
            
            <a href="#" className="skill-card" onClick={(e) => e.preventDefault()} style={{ flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
              <div className="skill-icon" style={{ margin: 0, fontSize: '2rem' }}>⚡️</div>
              <div className="help-info">
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Keyboard Shortcuts</h4>
                <p style={{ margin: '4px 0 0', color: 'var(--ob-text-muted)' }}>Speed up your workflow</p>
              </div>
            </a>
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn onboarding-btn-ghost" onClick={prevStep}>
            Back
          </button>
          <div className="onboarding-progress">
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot active" />
            <div className="progress-dot" />
          </div>
          <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
            Got it <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
