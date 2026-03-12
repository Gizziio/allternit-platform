/**
 * Agent Communication System - Index Exports
 * 
 * Central export point for all agent communication modules.
 */

// Core Communication
export * from '@/runtime/tools/builtins/agent-communicate'
export * from '@/runtime/agents/mention-router'
export * from '@/runtime/agents/communication-runtime-fixed'

// Git DAG Integration
export * from '@/runtime/integrations/git-dag/dag-tracker'

// Workspace Communication
export * from '@/runtime/integrations/agent-workspace-communication'

// Agent Authentication
export * from '@/runtime/integrations/agent-auth/agent-auth'

// Rate Limiting
export * from '@/runtime/integrations/rate-limiter/rate-limiter'

// Git Bundle Support
export * from '@/runtime/integrations/git-bundle/git-bundle'
