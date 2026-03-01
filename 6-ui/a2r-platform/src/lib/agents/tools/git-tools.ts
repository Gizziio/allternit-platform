/**
 * Git Tools
 * 
 * Native agent tools for Git operations:
 * - git_status: Check repository status
 * - git_log: View commit history
 * - git_diff: Show changes
 * - git_branch: List/manage branches
 */

import type { ToolDefinition, ToolExecutionHandler } from "./index";

// ============================================================================
// Git Status Tool
// ============================================================================

export const GIT_STATUS_DEFINITION: ToolDefinition = {
  name: "git_status",
  description: `Check the status of a Git repository.

Use this tool to:
- See which files have been modified
- Check for staged/unstaged changes
- See untracked files
- Check current branch

Examples:
- Check status: path="/workspace/project"
- Check with short format: path="...", short=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository (defaults to current directory)",
        default: ".",
      },
      short: {
        type: "boolean",
        description: "Return short format output",
        default: false,
      },
    },
    required: [],
  },
};

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  clean: boolean;
}

export const executeGitStatus: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", short = false } = parameters;

  try {
    // In production, this would call a backend API that runs git commands
    // For now, return a mock response
    const mockStatus: GitStatus = {
      branch: "main",
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
      clean: true,
    };

    // Simulate checking a real repo (would be backend API call)
    return {
      result: short
        ? {
            branch: mockStatus.branch,
            clean: mockStatus.clean,
            changes: mockStatus.staged.length + mockStatus.modified.length + mockStatus.untracked.length,
          }
        : mockStatus,
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to get git status",
    };
  }
};

// ============================================================================
// Git Log Tool
// ============================================================================

export const GIT_LOG_DEFINITION: ToolDefinition = {
  name: "git_log",
  description: `View the commit history of a Git repository.

Use this tool to:
- See recent commits
- View commit messages and authors
- Check when changes were made
- See commit hashes for reference

Examples:
- Recent commits: path="/workspace/project", limit=10
- Specific branch: path="...", branch="feature-branch"
- Since date: path="...", since="2024-01-01"`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository",
        default: ".",
      },
      limit: {
        type: "number",
        description: "Maximum number of commits to show",
        default: 20,
      },
      branch: {
        type: "string",
        description: "Branch to show log for (defaults to current branch)",
      },
      since: {
        type: "string",
        description: "Show commits since this date (YYYY-MM-DD format)",
      },
      author: {
        type: "string",
        description: "Filter by author",
      },
    },
    required: [],
  },
};

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export const executeGitLog: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", limit = 20, branch, since, author } = parameters;

  try {
    // Mock implementation - would call backend API
    const mockCommits: GitCommit[] = [
      {
        hash: "abc123def456",
        shortHash: "abc123d",
        message: "Initial commit",
        author: "Developer",
        email: "dev@example.com",
        date: new Date().toISOString(),
      },
    ];

    return {
      result: {
        commits: mockCommits.slice(0, limit as number),
        branch: branch || "main",
        total: mockCommits.length,
      },
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to get git log",
    };
  }
};

// ============================================================================
// Git Diff Tool
// ============================================================================

export const GIT_DIFF_DEFINITION: ToolDefinition = {
  name: "git_diff",
  description: `Show changes between commits, branches, or working directory.

Use this tool to:
- See what changed in recent commits
- Compare branches
- Review changes before committing
- See unstaged changes

Examples:
- Unstaged changes: path="/workspace/project"
- Staged changes: path="...", staged=true
- Between commits: path="...", from="abc123", to="def456"
- Specific file: path="...", file="src/index.ts"`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository",
        default: ".",
      },
      staged: {
        type: "boolean",
        description: "Show staged changes (added to index)",
        default: false,
      },
      from: {
        type: "string",
        description: "Commit hash or branch to compare from",
      },
      to: {
        type: "string",
        description: "Commit hash or branch to compare to (defaults to HEAD)",
      },
      file: {
        type: "string",
        description: "Show diff for specific file only",
      },
    },
    required: [],
  },
};

export interface GitDiff {
  files: Array<{
    path: string;
    changeType: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
    diff: string;
  }>;
  totalAdditions: number;
  totalDeletions: number;
}

export const executeGitDiff: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", staged = false, from, to, file } = parameters;

  try {
    // Mock implementation
    const mockDiff: GitDiff = {
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
    };

    return { result: mockDiff };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to get git diff",
    };
  }
};

// ============================================================================
// Git Branch Tool
// ============================================================================

export const GIT_BRANCH_DEFINITION: ToolDefinition = {
  name: "git_branch",
  description: `List or manage Git branches.

Use this tool to:
- List all branches
- See current branch
- Check which branches exist
- Get branch information

Examples:
- List branches: path="/workspace/project"
- List remote branches: path="...", remote=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository",
        default: ".",
      },
      remote: {
        type: "boolean",
        description: "Include remote branches",
        default: false,
      },
    },
    required: [],
  },
};

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead: number;
  behind: number;
  lastCommit?: string;
}

export const executeGitBranch: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", remote = false } = parameters;

  try {
    // Mock implementation
    const mockBranches: GitBranch[] = [
      {
        name: "main",
        current: true,
        ahead: 0,
        behind: 0,
      },
      {
        name: "feature/new-ui",
        current: false,
        ahead: 5,
        behind: 0,
      },
    ];

    if (remote) {
      mockBranches.push(
        {
          name: "origin/main",
          current: false,
          remote: "origin",
          ahead: 0,
          behind: 0,
        }
      );
    }

    return {
      result: {
        branches: mockBranches,
        current: mockBranches.find((b) => b.current)?.name || "main",
      },
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to get branches",
    };
  }
};

// ============================================================================
// Git Show Tool (for viewing specific commits)
// ============================================================================

export const GIT_SHOW_DEFINITION: ToolDefinition = {
  name: "git_show",
  description: `Show details of a specific Git commit.

Use this tool to:
- View a specific commit's changes
- See what files were modified
- Review commit details

Examples:
- Show commit: path="/workspace/project", commit="abc123"
- Show with stats: path="...", commit="abc123", stat=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the Git repository",
        default: ".",
      },
      commit: {
        type: "string",
        description: "Commit hash to show (defaults to HEAD)",
        default: "HEAD",
      },
      stat: {
        type: "boolean",
        description: "Include file statistics",
        default: false,
      },
    },
    required: [],
  },
};

export const executeGitShow: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", commit = "HEAD", stat = false } = parameters;

  try {
    const commitInfo = {
      hash: commit,
      message: "Commit message",
      author: "Developer",
      date: new Date().toISOString(),
      files: [] as string[],
      stats: stat ? { insertions: 0, deletions: 0 } : undefined,
    };

    return { result: commitInfo };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to show commit",
    };
  }
};
