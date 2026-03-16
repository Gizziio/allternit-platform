/**
 * A2R Console - Infrastructure Control Plane
 * 
 * NOT a marketing wizard. This is a control plane for:
 * - Deploying agents to cloud infrastructure
 * - Monitoring instance health
 * - Managing swarms and task distribution
 * - Tracking costs and resource usage
 * 
 * Design principles:
 * - Lighter than AWS
 * - More deterministic than Heroku
 * - Less chaotic than Vercel
 * - Focused on orchestration, not vanity
 */

export { ConsoleApp } from './ConsoleApp';
export { ConsoleLayout } from './components/ConsoleLayout';
export { ConsoleHeader } from './components/ConsoleHeader';
export { ConsoleSubNav } from './components/ConsoleSubNav';
export { ConsoleStatusSpine } from './components/ConsoleStatusSpine';

// Pages
export { DashboardPage } from './pages/DashboardPage';
export { DeployPage } from './pages/DeployPage';
export { InstancesPage } from './pages/InstancesPage';
export { SwarmsPage } from './pages/SwarmsPage';
export { ProvidersPage } from './pages/ProvidersPage';
export { ObservabilityPage } from './pages/ObservabilityPage';

// Types
export type { ConsoleRoute, InstanceStatus, SwarmStatus, ProviderStatus };

type ConsoleRoute = 
  | 'dashboard'
  | 'deploy'
  | 'instances'
  | 'swarms'
  | 'providers'
  | 'observability';

type InstanceStatus = 'running' | 'stopped' | 'error' | 'provisioning';
type SwarmStatus = 'active' | 'paused' | 'draining' | 'error';
type ProviderStatus = 'connected' | 'disconnected' | 'error';
