/**
 * Allternit VM Sessions
 * 
 * VM session management for agent isolation
 */

export { VMSession, VMSessionManager } from './session-manager.js';
export type { VMSessionConfig } from './session-manager.js';
export { DockerVMProvider } from './providers/docker.js';

export default { VMSession, VMSessionManager, DockerVMProvider };
