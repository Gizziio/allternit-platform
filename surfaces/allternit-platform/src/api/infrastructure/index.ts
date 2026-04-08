/**
 * Infrastructure API - Main exports
 * Consolidates all infrastructure-related API clients
 */

// Re-export from VPS module
export { vpsApi } from './vps';
export type { 
  VPSConnection, 
  VPSCreateRequest, 
  VPSTestResult, 
  VPSExecuteResult,
  VPSResources 
} from './vps';

// Re-export from Cloud module
export { cloudApi } from './cloud';
export type { 
  CloudProvider, 
  Provider, 
  Region, 
  InstanceType, 
  Instance, 
  InstanceStatus,
  Deployment, 
  DeploymentStatus,
  DeployRequest 
} from './cloud';

// Re-export from Environments module
export { environmentApi } from './environments';
export type { 
  EnvironmentTemplate, 
  EnvironmentType,
  EnvironmentConfig,
  EnvironmentLogEntry,
  Environment, 
  EnvironmentStatus,
  ProvisionRequest,
  ResourceRequirements,
  EnvironmentResources,
  EnvironmentCreateInput,
  LogCallback,
} from './environments';

// Re-export from SSH Keys module
export { sshKeyApi } from './ssh-keys';
export type { 
  SSHKey, 
  SSHKeyCreateRequest, 
  SSHKeyImportRequest, 
  SSHKeyGenerateRequest,
  SSHKeyGenerateResult 
} from './ssh-keys';

// Re-export from WebSocket module
export { InfrastructureWebSocket } from './websocket';
export type { 
  InfrastructureEvent, 
  InfrastructureEventType,
  LogOutputData,
  HealthCheckData 
} from './websocket';

// Re-export runtime backend resolver API
export { runtimeBackendApi } from './runtime-backend';
export type {
  RuntimeBackendMode,
  RuntimeBackendResponse,
  RuntimeBackendTargetResponse,
} from './runtime-backend';
