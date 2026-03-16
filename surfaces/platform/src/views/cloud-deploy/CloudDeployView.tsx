/**
 * Cloud Deploy View - Agent-Assisted Flow
 *
 * Complete deployment wizard with agent-assisted provider signup.
 * Supports both automated (API token) and manual (SSH) modes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CloudDeployWizard } from './components/CloudDeployWizard';
import { DeploymentProgress } from './components/DeploymentProgress';
import { DeploymentComplete } from './components/DeploymentComplete';
import { HumanCheckpointBanner } from './components/HumanCheckpointBanner';
import { BrowserCapsuleEnhanced } from '../../capsules/browser/BrowserCapsuleEnhanced';
import { cloudDeployApi, type DeploymentEvent, type WizardState } from './lib/api-client';
import './CloudDeployView.css';

export type DeploymentPhase =
  | 'wizard'
  | 'agentAssisted'
  | 'humanCheckpoint'
  | 'deploying'
  | 'complete'
  | 'error';

export interface DeploymentConfig {
  deploymentType: 'self-host' | 'managed' | 'partnership';
  providerId: string;
  regionId: string;
  instanceTypeId: string;
  storageGb: number;
  instanceName: string;
  mode: 'automated' | 'manual';
  apiToken?: string;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPrivateKey?: string;
}

export interface DeploymentStatus {
  id: string;
  phase: string;
  progress: number;
  message: string;
  errors: string[];
  instanceIp?: string;
  accessUrl?: string;
}

export const CloudDeployView: React.FC = () => {
  // Existing deployment state
  const [currentPhase, setCurrentPhase] = useState<DeploymentPhase>('wizard');
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // New wizard state
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start polling wizard state
  useEffect(() => {
    if (deploymentId && (currentPhase === 'agentAssisted' || currentPhase === 'humanCheckpoint')) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const state = await cloudDeployApi.getWizardState(deploymentId);
          setWizardState(state);

          // Check if we need to show human checkpoint
          if (state.current_step.includes('Human') || state.current_step === 'AwaitingHumanAction') {
            setCurrentPhase('humanCheckpoint');
          } else if (state.current_step === 'AgentAssistedSignup') {
            setCurrentPhase('agentAssisted');
          } else if (state.current_step === 'Provisioning') {
            setCurrentPhase('deploying');
          }
        } catch (err) {
          console.error('Failed to poll wizard state:', err);
        }
      }, 2000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [deploymentId, currentPhase]);

  // Handle wizard start (agent-assisted flow)
  const handleWizardStart = async (providerId: string) => {
    try {
      setError(null);
      const state = await cloudDeployApi.startWizard({
        provider: providerId,
        api_token: undefined,  // Will get from signup
      });

      setWizardState(state);
      setDeploymentId(state.deployment_id);

      if (state.context.provider_signup_url) {
        setCurrentPhase('agentAssisted');
      } else {
        setCurrentPhase('wizard');
      }
    } catch (err) {
      console.error('Failed to start wizard:', err);
      setError(err instanceof Error ? err.message : 'Failed to start wizard');
    }
  };

  // Handle advance wizard
  const handleAdvanceWizard = async () => {
    if (!deploymentId) return;

    try {
      setError(null);
      const state = await cloudDeployApi.advanceWizard(deploymentId);
      setWizardState(state);

      // Check next phase
      if (state.current_step.includes('Human')) {
        setCurrentPhase('humanCheckpoint');
      } else if (state.current_step === 'Provisioning') {
        setCurrentPhase('deploying');
      }
    } catch (err) {
      console.error('Failed to advance wizard:', err);
      setError(err instanceof Error ? err.message : 'Failed to advance wizard');
    }
  };

  // Handle resume after human action
  const handleResumeWizard = async (checkpointType: string) => {
    if (!deploymentId) return;

    try {
      setIsResuming(true);
      setError(null);
      const state = await cloudDeployApi.resumeWizard(deploymentId, checkpointType);
      setWizardState(state);
      setIsResuming(false);

      // Check next phase
      if (state.current_step === 'Provisioning') {
        setCurrentPhase('deploying');
      } else {
        setCurrentPhase('agentAssisted');
      }
    } catch (err) {
      setIsResuming(false);
      console.error('Failed to resume wizard:', err);
      setError(err instanceof Error ? err.message : 'Failed to resume wizard');
    }
  };

  // Handle deployment start (traditional flow)
  const handleDeploymentStart = async (config: DeploymentConfig) => {
    try {
      setError(null);
      const deployment = await cloudDeployApi.createDeployment({
        provider_id: config.providerId,
        region_id: config.regionId,
        instance_type_id: config.instanceTypeId,
        storage_gb: config.storageGb,
        instance_name: config.instanceName,
        mode: config.mode || 'manual',
        api_token: config.apiToken,
        ssh_host: config.sshHost,
        ssh_port: config.sshPort,
        ssh_username: config.sshUsername,
        ssh_private_key: config.sshPrivateKey,
      });

      setDeploymentId(deployment.deployment_id);
      setCurrentPhase('deploying');
      setDeploymentStatus({
        id: deployment.deployment_id,
        phase: 'deploying',
        progress: deployment.progress,
        message: deployment.message,
        errors: [],
      });

      // Subscribe to live deployment events via WebSocket
      unsubscribeRef.current = cloudDeployApi.subscribeToEvents(
        deployment.deployment_id,
        (event: DeploymentEvent) => {
          setDeploymentStatus((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              progress: event.progress,
              message: event.message,
              phase: event.event_type === 'deployment_complete' ? 'complete' : 'deploying',
            };
          });

          // Check if deployment is complete
          if (event.progress >= 100 || event.event_type === 'deployment_complete') {
            setCurrentPhase('complete');
            setDeploymentStatus((prev) => ({
              ...prev!,
              instanceIp: event.data?.instance_ip as string,
              accessUrl: event.data?.access_url as string,
            }));
            // Unsubscribe from events
            unsubscribeRef.current?.();
          }
        }
      );
    } catch (error) {
      console.error('Failed to start deployment:', error);
      setError(error instanceof Error ? error.message : 'Failed to start deployment');
    }
  };

  // Handle back to wizard
  const handleBackToWizard = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setCurrentPhase('wizard');
    setDeploymentId(null);
    setDeploymentStatus(null);
    setWizardState(null);
    setError(null);
  };

  // Get checkpoint type from wizard state
  const getCheckpointType = (): string => {
    if (!wizardState) return 'payment';

    const step = wizardState.current_step;
    if (step.includes('Payment')) return 'payment';
    if (step.includes('Captcha')) return 'captcha';
    if (step.includes('Email')) return 'emailVerification';
    if (step.includes('Phone')) return 'phoneVerification';
    if (step.includes('Identity')) return 'identityVerification';
    if (step.includes('Terms')) return 'termsAcceptance';
    return 'payment';
  };

  return (
    <div className="cloud-deploy-view">
      <div className="cloud-deploy-header">
        <h1>🚀 Deploy A2R to Cloud</h1>
        <p>Get your A2R instance running in minutes. No technical expertise required.</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">❌</span>
          <span className="error-message">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="cloud-deploy-content">
        {/* Traditional Wizard Flow */}
        {currentPhase === 'wizard' && (
          <CloudDeployWizard
            onStartDeployment={handleDeploymentStart}
            onWizardStart={handleWizardStart}
          />
        )}

        {/* Agent-Assisted Signup Flow - Uses Real Browser Capsule */}
        {currentPhase === 'agentAssisted' && wizardState && (
          <div className="agent-assisted-section">
            <div className="section-header">
              <h2>🤖 Agent-Assisted Signup</h2>
              <p>The agent will guide you through the provider signup process.</p>
            </div>

            {/* Real Browser Capsule with Agent Integration */}
            <div className="browser-capsule-wrapper">
              <BrowserCapsuleEnhanced
                initialUrl={wizardState.context.provider_signup_url || 'https://www.google.com'}
                agentMode="guided"
                guidanceMessages={wizardState.context.agent_guidance}
                onHumanCheckpoint={() => setCurrentPhase('humanCheckpoint')}
              />
            </div>

            <div className="agent-actions">
              <button
                className="btn-secondary"
                onClick={handleAdvanceWizard}
              >
                I've Completed This Step →
              </button>
            </div>
          </div>
        )}

        {/* Human Checkpoint Flow */}
        {currentPhase === 'humanCheckpoint' && wizardState && (
          <div className="human-checkpoint-section">
            <div className="section-header">
              <h2>🙋 Human Action Required</h2>
              <p>Please complete the following step to continue.</p>
            </div>

            <HumanCheckpointBanner
              checkpointType={getCheckpointType() as any}
              guidanceMessage={wizardState.context.agent_guidance.at(-1) || 'Please complete this step.'}
              onResume={() => handleResumeWizard(getCheckpointType())}
              isResuming={isResuming}
            />
          </div>
        )}

        {/* Deployment Progress */}
        {currentPhase === 'deploying' && deploymentStatus && (
          <DeploymentProgress
            status={deploymentStatus}
            onBack={handleBackToWizard}
            mode="live"
          />
        )}

        {/* Deployment Complete */}
        {currentPhase === 'complete' && deploymentStatus && (
          <DeploymentComplete
            status={deploymentStatus}
            onNewDeployment={handleBackToWizard}
          />
        )}
      </div>
    </div>
  );
};

export default CloudDeployView;
