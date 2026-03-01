/**
 * Cloud Deploy Wizard
 * 
 * 5-step wizard for easy cloud deployment.
 */

import React, { useState } from 'react';
import { Step1DeploymentType } from './steps/Step1DeploymentType';
import { Step2ProviderSelection } from './steps/Step2ProviderSelection';
import { Step3Configuration } from './steps/Step3Configuration';
import { Step4Credentials } from './steps/Step4Credentials';
import { Step5Review } from './steps/Step5Review';
import type { DeploymentConfig } from '../CloudDeployView';

interface CloudDeployWizardProps {
  onStartDeployment: (config: DeploymentConfig) => void;
  onWizardStart?: (providerId: string) => void;
}

export const CloudDeployWizard: React.FC<CloudDeployWizardProps> = ({ onStartDeployment, onWizardStart }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<Partial<DeploymentConfig>>({
    deploymentType: 'self-host',
    providerId: '',
    regionId: '',
    instanceTypeId: '',
    storageGb: 100,
    instanceName: `a2r-instance-${Math.random().toString(36).substring(7)}`,
  });

  const totalSteps = 5;

  const handleNext = (stepConfig: Partial<DeploymentConfig>) => {
    setConfig(prev => ({ ...prev, ...stepConfig }));
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleStart = (finalConfig: DeploymentConfig) => {
    onStartDeployment(finalConfig);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1DeploymentType
            onNext={(type) => handleNext({ deploymentType: type })}
          />
        );
      case 2:
        return (
          <Step2ProviderSelection
            selectedProvider={config.providerId || ''}
            onNext={(providerId) => handleNext({ providerId })}
            onBack={handleBack}
            onWizardStart={onWizardStart}
          />
        );
      case 3:
        return (
          <Step3Configuration
            config={config}
            onNext={(stepConfig) => handleNext(stepConfig)}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <Step4Credentials
            providerId={config.providerId || ''}
            onNext={(credentials) => {
              // Store credentials securely (in production, use secure storage)
              console.log('Credentials entered');
              handleNext({});
            }}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <Step5Review
            config={config as DeploymentConfig}
            onStart={handleStart}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="cloud-deploy-wizard">
      {/* Progress Bar */}
      <div className="wizard-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
        <div className="step-indicators">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`step-indicator ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
            >
              {step < currentStep ? '✓' : step}
            </div>
          ))}
        </div>
        <div className="step-labels">
          <span>Deploy Type</span>
          <span>Provider</span>
          <span>Configure</span>
          <span>Credentials</span>
          <span>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {renderStep()}
      </div>
    </div>
  );
};

export default CloudDeployWizard;
