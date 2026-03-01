import React, { useState } from 'react';
import { useOnboarding } from '../../runtime/OnboardingContext';

export const Feedback: React.FC = () => {
  const { prevStep, completeOnboarding, updateData } = useOnboarding();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleFinish = () => {
    updateData({ feedbackRating: rating, feedbackComment: comment });
    completeOnboarding();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-emoji celebration-icon">🎉</div>
          <h1 className="onboarding-title">All Set!</h1>
          <p className="onboarding-subtitle">
            You're ready to start building with your agents. How was this setup experience?
          </p>
        </div>

        <div className="onboarding-content">
          <div className="feedback-stars" style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '20px 0' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`star-btn ${rating >= star ? 'active' : ''}`}
                onClick={() => setRating(star)}
                aria-label={`Rate ${star} stars`}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2.5rem',
                  color: rating >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: rating >= star ? 'scale(1.1)' : 'scale(1)',
                  filter: rating >= star ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.5))' : 'none'
                }}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            className="feedback-textarea"
            placeholder="Any additional thoughts or suggestions? (Optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ minHeight: '120px' }}
          />
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
            <div className="progress-dot" />
            <div className="progress-dot active" />
          </div>
          <button className="onboarding-btn onboarding-btn-primary" onClick={handleFinish}>
            Launch Workspace 🚀
          </button>
        </div>
      </div>
    </div>
  );
};
