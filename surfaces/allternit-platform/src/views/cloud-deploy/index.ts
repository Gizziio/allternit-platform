/**
 * Cloud Deploy Module
 * 
 * One-stop cloud deployment for Allternit.
 */

// Main Views
export { CloudDeployView } from './CloudDeployView';

// Wizard Components
export { CloudDeployWizard } from './components/CloudDeployWizard';
export { Step1DeploymentType } from './components/steps/Step1DeploymentType';
export { Step2ProviderSelection } from './components/steps/Step2ProviderSelection';
export { Step3Configuration } from './components/steps/Step3Configuration';
export { Step4Credentials } from './components/steps/Step4Credentials';
export { Step5Review } from './components/steps/Step5Review';

// Progress & Status Components
export { DeploymentProgress } from './components/DeploymentProgress';
export { DeploymentProgressEnhanced } from './components/DeploymentProgressEnhanced';
export { DeploymentComplete } from './components/DeploymentComplete';
export { HumanCheckpointBanner } from './components/HumanCheckpointBanner';

// Enhanced Components
export { ProviderComparison } from './components/ProviderComparison';
export { SSHKeyManager } from './components/SSHKeyManager';

// Pages
export { InstancesPage } from './pages/InstancesPage';
export { DeploymentHistoryPage } from './pages/DeploymentHistoryPage';

// Data & API
export { PROVIDERS, getProvider, getProviderRegion, getProviderInstance } from './data/providers';
export { cloudDeployApi } from './lib/api-client';

// Types
export type { DeploymentConfig, DeploymentStatus, DeploymentPhase } from './CloudDeployView';
export type { Provider, Region, InstanceType, CredentialField } from './data/providers';
export type { SSHKey } from './components/SSHKeyManager';
export type { 
  Deployment, 
  DeploymentEvent, 
  DeploymentConfig as ApiDeploymentConfig,
  WizardState,
  StartWizardRequest,
  ResumeWizardRequest,
  Instance 
} from './lib/api-client';
