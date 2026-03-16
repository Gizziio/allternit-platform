/**
 * Human Checkpoint Banner Component
 * 
 * Displayed when agent pauses for human action (payment, CAPTCHA, verification).
 * Shows guidance message and resume button.
 */

import React, { useState } from 'react';
import './HumanCheckpointBanner.css';

export interface HumanCheckpointBannerProps {
  checkpointType: 'payment' | 'captcha' | 'emailVerification' | 'phoneVerification' | 'identityVerification' | 'termsAcceptance';
  guidanceMessage: string;
  onResume: () => void;
  isResuming?: boolean;
}

export const HumanCheckpointBanner: React.FC<HumanCheckpointBannerProps> = ({
  checkpointType,
  guidanceMessage,
  onResume,
  isResuming = false,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  const getCheckpointIcon = () => {
    switch (checkpointType) {
      case 'payment':
        return '💳';
      case 'captcha':
        return '🧩';
      case 'emailVerification':
        return '📧';
      case 'phoneVerification':
        return '📱';
      case 'identityVerification':
        return '🆔';
      case 'termsAcceptance':
        return '📋';
      default:
        return '🙋';
    }
  };

  const getCheckpointTitle = () => {
    switch (checkpointType) {
      case 'payment':
        return 'Payment Required';
      case 'captcha':
        return 'CAPTCHA Verification';
      case 'emailVerification':
        return 'Email Verification';
      case 'phoneVerification':
        return 'Phone Verification';
      case 'identityVerification':
        return 'Identity Verification';
      case 'termsAcceptance':
        return 'Terms Acceptance';
      default:
        return 'Human Action Required';
    }
  };

  const getCheckpointInstructions = () => {
    switch (checkpointType) {
      case 'payment':
        return 'Please complete the payment process on the provider\'s website. This may include entering payment details and confirming the transaction.';
      case 'captcha':
        return 'Please complete the CAPTCHA challenge to prove you\'re human.';
      case 'emailVerification':
        return 'Please check your email inbox and click the verification link.';
      case 'phoneVerification':
        return 'Please enter the verification code sent to your phone.';
      case 'identityVerification':
        return 'Please complete the identity verification process as required.';
      case 'termsAcceptance':
        return 'Please read and accept the provider\'s terms of service.';
      default:
        return 'Please complete the required action.';
    }
  };

  const handleResume = () => {
    if (confirmed) {
      onResume();
    }
  };

  return (
    <div className="human-checkpoint-banner">
      <div className="checkpoint-header">
        <span className="checkpoint-icon">{getCheckpointIcon()}</span>
        <h3 className="checkpoint-title">{getCheckpointTitle()}</h3>
      </div>

      <div className="checkpoint-content">
        <p className="checkpoint-guidance">{guidanceMessage}</p>
        <p className="checkpoint-instructions">{getCheckpointInstructions()}</p>

        <div className="checkpoint-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">
            The agent cannot proceed until this step is completed manually.
          </span>
        </div>
      </div>

      <div className="checkpoint-actions">
        <label className="confirmation-checkbox">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I have completed this step</span>
        </label>

        <button
          className="resume-btn"
          onClick={handleResume}
          disabled={!confirmed || isResuming}
        >
          {isResuming ? (
            <>
              <span className="spinner"></span>
              Resuming...
            </>
          ) : (
            <>
              ▶️ Continue Setup
            </>
          )}
        </button>
      </div>

      <div className="checkpoint-progress">
        <div className="progress-indicator">
          <span className="progress-step completed">✓ Select</span>
          <span className="progress-line"></span>
          <span className="progress-step completed">✓ Signup</span>
          <span className="progress-line"></span>
          <span className="progress-step active">● {getCheckpointTitle()}</span>
          <span className="progress-line"></span>
          <span className="progress-step">○ Deploy</span>
        </div>
      </div>
    </div>
  );
};

export default HumanCheckpointBanner;
