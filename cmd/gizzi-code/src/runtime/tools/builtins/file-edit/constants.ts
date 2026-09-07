// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .claude/ folder
export const GIZZI_FOLDER_PERMISSION_PATTERN = '/.claude/**'

// Permission pattern for granting session-level access to the global ~/.claude/ folder
export const GLOBAL_GIZZI_FOLDER_PERMISSION_PATTERN = '~/.claude/**'

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
