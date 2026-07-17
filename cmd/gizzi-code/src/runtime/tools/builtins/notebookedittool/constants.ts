// In its own file to avoid circular dependencies
export const NOTEBOOK_EDIT_TOOL_NAME = 'NotebookEdit'

export type SettingSource = 'config' | 'env' | 'default' | 'userSettings' | 'projectSettings' | 'localSettings' | 'flagSettings' | 'policySettings'

// Re-homed here by legacy import paths; canonical copy lives in
// cli/ui/ink-app/tools/FileEditTool/constants.ts
export const FILE_EDIT_TOOL_NAME = 'Edit'
