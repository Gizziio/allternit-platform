/**
 * Chat message structure for the Allternit API.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Configuration for the Allternit API client.
 */
export interface ClientConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

/**
 * Inputs parsed from the GitHub Action environment.
 */
export interface ActionInputs {
  action: "review" | "generate" | "fix" | "explain";
  apiUrl: string;
  apiKey: string;
  target: string;
  model: string;
  maxTokens: number;
}

/**
 * Represents a changed file in a pull request.
 */
export interface PullRequestFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * A review comment to post on a pull request.
 */
export interface ReviewComment {
  path: string;
  body: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
}

/**
 * Result of an action handler.
 */
export interface ActionResult {
  success: boolean;
  result: string;
  summary: string;
}

/**
 * GitHub repository context extracted from environment variables.
 */
export interface RepoContext {
  owner: string;
  repo: string;
  prNumber?: number;
  sha?: string;
  ref?: string;
}
