import { readFileSync } from "fs";
import { PullRequestFile, ReviewComment, RepoContext } from "./types";

/**
 * Retrieves the GitHub token from environment variables.
 * @returns The GitHub token
 * @throws Error if GITHUB_TOKEN is not set
 */
function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  return token;
}

/**
 * Constructs authorization headers for GitHub API requests.
 * @returns Headers object with Authorization and Accept
 */
function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
}

/**
 * Extracts repository context from GitHub Actions environment variables.
 * @returns The repository context including owner, repo, PR number, and SHA
 */
export function getRepoContext(): RepoContext {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const [owner, repo] = repository.split("/");

  const eventPath = process.env.GITHUB_EVENT_PATH;
  let prNumber: number | undefined;

  if (eventPath) {
    try {
      const event = JSON.parse(readFileSync(eventPath, "utf8"));
      prNumber = event.pull_request?.number ?? event.number;
    } catch {
      // Event file not available or not a PR event
    }
  }

  // Fallback: try to parse from GITHUB_REF (refs/pull/N/merge)
  if (!prNumber) {
    const ref = process.env.GITHUB_REF ?? "";
    const prMatch = ref.match(/refs\/pull\/(\d+)\/merge/);
    if (prMatch) {
      prNumber = parseInt(prMatch[1], 10);
    }
  }

  return {
    owner,
    repo,
    prNumber,
    sha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
  };
}

/**
 * Gets the list of changed files in a pull request.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Array of changed files with their diffs
 */
export async function getPullRequestFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestFile[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: authHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorText}`);
  }

  const files = (await response.json()) as Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;

  return files.map((f) => ({
    filename: f.filename,
    status: f.status as PullRequestFile["status"],
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

/**
 * Creates a review comment on a pull request.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param comment - The review comment to post
 * @param commitId - The commit SHA to attach the comment to
 */
export async function createReviewComment(
  owner: string,
  repo: string,
  prNumber: number,
  comment: ReviewComment,
  commitId: string
): Promise<void> {
  const body: Record<string, unknown> = {
    body: comment.body,
    path: comment.path,
    commit_id: commitId,
  };

  if (comment.line !== undefined) {
    body.line = comment.line;
    body.side = comment.side ?? "RIGHT";
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // Log but don't throw — partial review is better than no review
    console.error(`Failed to post comment on ${comment.path}: ${errorText}`);
  }
}

/**
 * Creates a pull request with generated code.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - PR title
 * @param body - PR body/description
 * @param head - The branch containing the changes
 * @param base - The base branch to merge into
 * @returns The PR number of the created pull request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<number> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title, body, head, base }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create PR: ${errorText}`);
  }

  const data = (await response.json()) as { number: number };
  return data.number;
}

/**
 * Posts a summary comment on a pull request.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param body - The comment body (markdown supported)
 */
export async function postPRComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    console.error(`Failed to post summary comment: ${await response.text()}`);
  }
}

/**
 * Reads a file's content from the repository at a given ref.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path within the repository
 * @param ref - Git ref (branch, tag, or SHA)
 * @returns The decoded file content
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    {
      headers: authHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to read file ${path}: ${errorText}`);
  }

  const data = (await response.json()) as { content: string; encoding: string };
  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  return data.content;
}
