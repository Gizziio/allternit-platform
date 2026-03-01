import React, { useEffect, useMemo } from 'react';
import { useOnboarding, type BrainType } from '../../runtime/OnboardingContext';
import { useBrain, type BrainProfile } from '../../runtime/BrainContext';
import '../../styles/onboarding.css';

const BRAIN_TYPES: { value: BrainType; label: string; icon: string; description: string }[] = [
  { value: 'api', label: 'Cloud API', icon: '☁️', description: 'Connect to cloud LLM services (requires API key)' },
  { value: 'cli', label: 'Terminal CLI', icon: '⌨️', description: 'Use local terminal interface for brain sessions' },
  { value: 'local', label: 'Local Models', icon: '💻', description: 'Run models on your device (requires setup)' },
];

export const BrainConfig: React.FC = () => {
  const { onboardingData, updateData, nextStep, prevStep } = useOnboarding();
  const { profiles, refreshProfiles, isLoading } = useBrain();

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const handleBrainTypeChange = (type: BrainType) => {
    updateData({ brainType: type });
  };

  const handleModelChange = (modelId: string) => {
    updateData({ modelSelection: modelId });
  };

  // Filter profiles based on selected brain type? 
  // For now, let's just show all profiles or filter if they have metadata
  // Assuming profiles map to 'api' type largely
  const availableModels = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    
    // We can filter if needed, but for now let's just use the profiles
    return profiles.map(p => ({
      id: p.config.model || p.config.id,
      name: p.config.name,
      description: p.config.id // Use ID or other metadata as description
    }));
  }, [profiles]);

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-emoji">🧠</div>
          <h1 className="onboarding-title">Configure Your Brain</h1>
          <p className="onboarding-subtitle">
            Choose how your AI brain connects and which model powers your workspace
          </p>
        </div>

        <div className="onboarding-content">
          <div className="onboarding-form-group">
            <label className="onboarding-label">
              <span>Connection Type</span>
              <span className="tooltip-trigger">
                ?
                <div className="tooltip-content">
                  How the AI models connect to your workspace
                </div>
              </span>
            </label>

            <div className="skill-grid">
              {BRAIN_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`skill-card ${onboardingData.brainType === type.value ? 'selected' : ''}`}
                  onClick={() => handleBrainTypeChange(type.value)}
                >
                  <div className="skill-icon">{type.icon}</div>
                  <div className="skill-title">{type.label}</div>
                  <div className="skill-desc">{type.description}</div>
                </div>
              ))}
            </div>
          </div>

          {onboardingData.brainType === 'api' && (
            <div className="onboarding-form-group">
              <label className="onboarding-label">Model Selection</label>

              {isLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ob-text-muted)' }}>
                  Loading models...
                </div>
              ) : availableModels.length > 0 ? (
                <div className="skill-grid">
                  {availableModels.map((model) => (
                    <div
                      key={model.id}
                      className={`skill-card ${onboardingData.modelSelection === model.id ? 'selected' : ''}`}
                      onClick={() => handleModelChange(model.id)}
                    >
                      <div className="skill-title" style={{ fontSize: '1rem' }}>{model.name}</div>
                      <div className="skill-desc" style={{ fontSize: '0.8rem' }}>{model.description}</div>
                      {onboardingData.modelSelection === model.id && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '10px', 
                          right: '10px', 
                          color: 'var(--ob-primary)',
                          background: 'rgba(56, 189, 248, 0.2)',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>✓</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ob-text-muted)' }}>
                  No profiles found. Make sure the backend is running.
                </div>
              )}
            </div>
          )}

          {onboardingData.brainType === 'api' && (
            <div style={{
              padding: '16px',
              background: 'rgba(56, 189, 248, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '0.875rem',
              color: 'var(--ob-text-main)',
              display: 'flex',
              gap: '12px',
              alignItems: 'start'
            }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <div>
                <strong>Pro Tip:</strong> You can add API keys later in Settings. For now, choose your preferred model and we'll guide you through setup.
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn onboarding-btn-ghost" onClick={prevStep}>
            Back
          </button>
          <div className="onboarding-progress">
            <div className="progress-dot" />
            <div className="progress-dot active" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
            <div className="progress-dot" />
          </div>
          <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
            Continue <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
