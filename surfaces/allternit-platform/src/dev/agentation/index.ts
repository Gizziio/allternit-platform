/**
 * Agentation Integration for Allternit
 * 
 * Provides local-first agent assistance for UI development.
 * Forked from benjitaylor/agentation (PolyForm Shield 1.0.0)
 * 
 * DEV-ONLY: This module is gated by NODE_ENV and never included in production builds.
 */

export { AgentationProvider } from './provider';
export { useAgentation } from './hooks';
export { AgentationPanel } from './panel';
export { AgentationOverlay } from './components/AgentationOverlay';
export type { AgentationConfig, AgentRole, AgentMessage } from './types';

// Version for compatibility checking
export const AGENTATION_VERSION = '1.0.0-allternit';
