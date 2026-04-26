/**
 * Workspace Components
 * 
 * UI components for the 5-layer agent workspace system.
 */

// Main components
export { WorkspaceBrowser } from './WorkspaceBrowser';
export { BrainView } from './BrainView';
export { MemoryEditor } from './MemoryEditor';
export { PolicyDashboard } from './PolicyDashboard';
export { SkillManager } from './SkillManager';
export { IdentityEditor } from './IdentityEditor';
export { SessionView } from './SessionView';

// Types
export { type BadgeProps, type CardProps, type EditorProps, type IdentityConfig, type MemoryEntry, type PolicyRule, type Skill, type SoulConfig, type Task, type TaskGraph, type WorkspaceLayers, type WorkspaceMetadata, type WorkspaceViewProps } from './types';

// Styles (for reference - import in your CSS/SCSS)
export { workspaceBrowserStyles } from './WorkspaceBrowser';
export { brainViewStyles } from './BrainView';
export { memoryEditorStyles } from './MemoryEditor';
export { policyDashboardStyles } from './PolicyDashboard';
export { skillManagerStyles } from './SkillManager';
export { identityEditorStyles } from './IdentityEditor';
