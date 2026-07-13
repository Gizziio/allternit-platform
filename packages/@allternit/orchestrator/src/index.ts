// packages/@allternit/orchestrator/src/index.ts

export * from './orchestrator.interface.js';
export { parseCompletionNotes, readCompletionNotes } from './completion-contract.js';
export { launchCommand, knownVendors, vendorDefinition } from './vendors.js';
export type { VendorLaunch } from './vendors.js';
export { doctor, formatDoctorReport, probeVendor, selectVendor } from './runtime-discovery.js';
export type { OrchestratorDoctorReport, VendorProbe, VendorSelection } from './runtime-discovery.js';
export { LocalTerminalBackend } from './backends/local-terminal.backend.js';
export type { LocalTerminalOptions } from './backends/local-terminal.backend.js';
export { SessionRegistry } from './session-registry.js';
export type { OrchestrationListener } from './session-registry.js';
