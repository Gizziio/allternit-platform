/**
 * File System Tools
 * 
 * Native agent tools for file operations.
 * All operations use the real backend API - NO fallbacks.
 */

import type { ToolDefinition, ToolExecutionHandler } from "./index";
import { filesApi, FilesApiClientError } from "../files-api";

// ============================================================================
// Read File Tool
// ============================================================================

export const READ_FILE_DEFINITION: ToolDefinition = {
  name: "read_file",
  description: `Read the contents of a file from the workspace.

Use this tool to:
- Read source code files
- Read configuration files
- Read documentation
- Read logs or data files

Examples:
- Read a specific file: path="src/components/Button.tsx"
- Read with offset: path="src/app.ts", offset=100, limit=50
- Read entire file: path="README.md"`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to read (relative to workspace root)",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from (0-indexed, optional)",
        default: 0,
      },
      limit: {
        type: "number",
        description: "Maximum number of lines to read (optional, default 100)",
        default: 100,
      },
    },
    required: ["path"],
  },
};

export const executeReadFile: ToolExecutionHandler = async (context, parameters) => {
  const { path, offset = 0, limit = 100 } = parameters;

  try {
    const result = await filesApi.readFile({
      path: String(path),
      offset: Number(offset),
      limit: Number(limit),
    });

    return { result };
  } catch (error) {
    if (error instanceof FilesApiClientError) {
      if (error.statusCode === 404) {
        return { result: null, error: `File not found: ${path}` };
      }
      return { result: null, error: error.message };
    }
    return { 
      result: null, 
      error: error instanceof Error ? error.message : `Failed to read file: ${path}` 
    };
  }
};

// ============================================================================
// Write File Tool
// ============================================================================

export const WRITE_FILE_DEFINITION: ToolDefinition = {
  name: "write_file",
  description: `Write content to a file in the workspace.

Use this tool to:
- Create new files
- Update existing files
- Append to files (with append mode)

IMPORTANT: Always confirm destructive operations (overwriting existing files).

Examples:
- Create new file: path="src/utils/helpers.ts", content="export const helper = () => {}"
- Update file: path="README.md", content="# New Title..."
- Append: path="logs/app.log", content="New log entry", append=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to write (relative to workspace root)",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
      append: {
        type: "boolean",
        description: "If true, append to file instead of overwriting",
        default: false,
      },
    },
    required: ["path", "content"],
  },
};

export const executeWriteFile: ToolExecutionHandler = async (context, parameters) => {
  const { path, content, append = false } = parameters;

  try {
    const result = await filesApi.writeFile({
      path: String(path),
      content: String(content),
      append: Boolean(append),
    });

    return { result };
  } catch (error) {
    return { 
      result: null, 
      error: error instanceof Error ? error.message : `Failed to write file: ${path}` 
    };
  }
};

// ============================================================================
// Search Code Tool
// ============================================================================

export const SEARCH_CODE_DEFINITION: ToolDefinition = {
  name: "search_code",
  description: `Search the codebase for patterns, symbols, or text.

Use this tool to:
- Find function definitions
- Search for usages of a variable or function
- Find files by name pattern
- Search for text patterns across files

Examples:
- Find function: query="function calculateTotal", type="symbol"
- Search text: query="TODO", glob="*.ts"
- Find files: query="*.test.tsx", type="file"
- Regex search: query="const \[.*\] = useState", type="regex"`,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (text, pattern, or symbol name)",
      },
      type: {
        type: "string",
        enum: ["text", "regex", "symbol", "file"],
        description: "Type of search",
        default: "text",
      },
      glob: {
        type: "string",
        description: "File pattern to limit search (e.g., '*.ts', 'src/**/*.tsx')",
        default: "*",
      },
      caseSensitive: {
        type: "boolean",
        description: "Case sensitive search",
        default: false,
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return",
        default: 20,
      },
    },
    required: ["query"],
  },
};

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  context: string[];
}

export const executeSearchCode: ToolExecutionHandler = async (context, parameters) => {
  const {
    query,
    type = "text",
    glob = "*",
    caseSensitive = false,
    maxResults = 20,
  } = parameters;

  try {
    const result = await filesApi.searchCode({
      query: String(query),
      type: type as "text" | "regex" | "symbol" | "file",
      glob: String(glob),
      caseSensitive: Boolean(caseSensitive),
      maxResults: Number(maxResults),
    });

    return { result };
  } catch (error) {
    return { 
      result: { query, type, glob, results: [], totalResults: 0 }, 
      error: error instanceof Error ? error.message : "Search failed" 
    };
  }
};

// ============================================================================
// List Directory Tool
// ============================================================================

export const LIST_DIRECTORY_DEFINITION: ToolDefinition = {
  name: "list_directory",
  description: `List files and directories in a given path.

Use this tool to:
- Explore the project structure
- Find files in a directory
- Check what files exist

Examples:
- List root: path="."
- List source: path="src/components"
- List with details: path="docs", includeDetails=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path to list (relative to workspace root)",
        default: ".",
      },
      includeDetails: {
        type: "boolean",
        description: "Include file sizes and modification times",
        default: false,
      },
      recursive: {
        type: "boolean",
        description: "List directories recursively",
        default: false,
      },
    },
    required: [],
  },
};

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

export const executeListDirectory: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", includeDetails = false, recursive = false } = parameters;

  try {
    const result = await filesApi.listDirectory({
      path: String(path),
      includeDetails: Boolean(includeDetails),
      recursive: Boolean(recursive),
    });

    return { result };
  } catch (error) {
    if (error instanceof FilesApiClientError && error.statusCode === 404) {
      return { result: null, error: `Directory not found: ${path}` };
    }
    return { 
      result: null, 
      error: error instanceof Error ? error.message : `Failed to list directory: ${path}` 
    };
  }
};

// ============================================================================
// Delete File Tool
// ============================================================================

export const DELETE_FILE_DEFINITION: ToolDefinition = {
  name: "delete_file",
  description: `Delete a file from the workspace.

WARNING: This operation is destructive and cannot be undone.
Always confirm with the user before deleting files.

Examples:
- Delete file: path="temp/old-file.txt"`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to delete (relative to workspace root)",
      },
    },
    required: ["path"],
  },
};

export const executeDeleteFile: ToolExecutionHandler = async (context, parameters) => {
  const { path } = parameters;

  try {
    await filesApi.deleteFile(String(path));
    return { result: { success: true, path } };
  } catch (error) {
    if (error instanceof FilesApiClientError && error.statusCode === 404) {
      return { result: null, error: `File not found: ${path}` };
    }
    return { 
      result: null, 
      error: error instanceof Error ? error.message : `Failed to delete file: ${path}` 
    };
  }
};

// ============================================================================
// Re-exports
// ============================================================================

export { FilesApiClientError } from "../files-api";
