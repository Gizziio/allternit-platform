/**
 * Allternit Node Agent Installation System
 * 
 * Complete installation and management system for Allternit agents on VPS/cloud instances.
 * 
 * @example
 * ```typescript
 * import { AgentInstaller, AgentConfigurator, healthChecker } from './agent';
 * 
 * const installer = new AgentInstaller();
 * const configurator = new AgentConfigurator();
 * 
 * // Install agent on a VPS
 * const result = await installer.install({
 *   host: '192.168.1.100',
 *   username: 'root',
 *   privateKeyPath: '/path/to/key'
 * });
 * 
 * if (result.success) {
 *   console.log('Installation completed:', result.config.serverId);
 * }
 * ```
 */

// Main installer
export {
  AgentInstaller,
  VPSConnection,
  ResourceLimits,
  AgentStatus,
  ContainerStatus,
  SystemInfo,
  InstallResult,
  InstallOptions
} from './AgentInstaller';

// Configuration management
export {
  AgentConfigurator,
  AgentConfig,
  ResourceLimits as ConfigResourceLimits,
  NetworkConfig,
  SecurityConfig,
  MonitoringConfig,
  StorageConfig,
  ConfigValidationResult,
  ConfigApplyResult,
  agentConfigurator
} from './AgentConfig';

// Health checking
export {
  HealthChecker,
  HealthCheckResult,
  ComponentHealth,
  SystemMetrics,
  DockerContainerInfo,
  healthChecker,
  healthHandler,
  readinessHandler,
  livenessHandler
} from './health-check';

// Installation scripts paths (for reference)
export const INSTALL_SCRIPTS = {
  linux: './install-scripts/install.sh',
  windows: './install-scripts/install.ps1'
};

// Docker Compose path
export const DOCKER_COMPOSE_PATH = './DockerCompose.yml';

// Version
export const AGENT_INSTALLER_VERSION = '1.0.0';
