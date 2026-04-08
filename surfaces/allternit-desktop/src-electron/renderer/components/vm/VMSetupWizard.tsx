/**
 * VM Setup Wizard Component
 * 
 * Guides users through downloading VM images.
 */

import React, { useState, useCallback } from 'react';
import type { VMSetupOptions } from '../../shared/types';

export interface VMSetupWizardProps {
  onComplete: () => void;
  onDownload: (options?: VMSetupOptions) => Promise<void>;
  imagesExist: boolean | null;
}

export const VMSetupWizard: React.FC<VMSetupWizardProps> = ({
  onComplete,
  onDownload,
  imagesExist,
}) => {
  const [step, setStep] = useState<'intro' | 'downloading' | 'complete' | 'error'>('intro');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleDownload = useCallback(async () => {
    setStep('downloading');
    setError(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 1000);

      await onDownload({ version: '1.1.0' });

      clearInterval(progressInterval);
      setProgress(100);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [onDownload]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleRetry = useCallback(() => {
    setStep('intro');
    setError(null);
  }, []);

  if (imagesExist) {
    return (
      <div className="vm-setup-wizard">
        <div className="setup-complete">
          <span className="icon">✅</span>
          <h3>VM Images Ready</h3>
          <p>All required VM images are present.</p>
          <button onClick={onComplete}>Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vm-setup-wizard">
      {step === 'intro' && (
        <div className="setup-intro">
          <span className="icon">🖥️</span>
          <h3>Setup Allternit Virtual Machine</h3>
          <p>
            Allternit uses a Linux virtual machine to run commands in a sandboxed environment.
            You need to download the VM images to get started.
          </p>
          
          <div className="setup-details">
            <h4>What will be downloaded:</h4>
            <ul>
              <li>Linux Kernel (v6.5.0) - ~11 MB</li>
              <li>Initial Ramdisk - ~32 MB</li>
              <li>Ubuntu 22.04 Root Filesystem - ~21 MB compressed</li>
            </ul>
            <p className="total-size">Total: ~65 MB download → ~2.1 GB disk space</p>
          </div>

          <div className="setup-actions">
            <button className="primary" onClick={handleDownload}>
              Download VM Images
            </button>
            <button className="secondary" onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {step === 'downloading' && (
        <div className="setup-downloading">
          <span className="icon">📥</span>
          <h3>Downloading VM Images...</h3>
          
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          
          <p className="progress-text">{progress.toFixed(0)}%</p>
          <p className="progress-hint">This may take a few minutes depending on your connection</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="setup-complete">
          <span className="icon">🎉</span>
          <h3>Setup Complete!</h3>
          <p>VM images have been downloaded successfully.</p>
          <p className="hint">You can now start the VM and execute commands.</p>
          <button onClick={onComplete}>Start Using VM</button>
        </div>
      )}

      {step === 'error' && (
        <div className="setup-error">
          <span className="icon">❌</span>
          <h3>Download Failed</h3>
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button className="primary" onClick={handleRetry}>
              Try Again
            </button>
            <button className="secondary" onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VMSetupWizard;
