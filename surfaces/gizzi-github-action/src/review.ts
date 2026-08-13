import { AllternitClient } from "./client";
import {
  getRepoContext,
  getPullRequestFiles,
  createReviewComment,
  postPRComment,
} from "./github";
import { ActionResult, ReviewComment } from "./types";

/**
 * File extensions to include in review. Skips binary and generated files.
 */
const REVIEWABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".rs", ".go", ".java", ".kt",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
  ".html", ".css", ".scss", ".less",
  ".yaml", ".yml", ".json", ".toml",
  ".sh", ".bash", ".zsh",
  ".sql", ".graphql",
  ".md", ".mdx",
]);

/**
 * Determines whether a file should be reviewed based on its name.
 * @param filename - The file path to check
 * @returns True if the file should be reviewed
 */
function isReviewable(filename: string): boolean {
  const ext = "." + filename.split(".").pop();
  return REVIEWABLE_EXTENSIONS.has(ext);
}

/**
 * Parses the AI review response into structured review comments.
 * Extracts severity, line numbers, and descriptions from the markdown output.
 * @param reviewText - The raw review text from the AI
 * @param filename - The file being reviewed
 * @returns Array of review comments ready to post
 */
function parseReviewFindings(
  reviewText: string,
  filename: string
): ReviewComment[] {
  const comments: ReviewComment[] = [];

  // Look for structured findings with severity markers
  const findingBlocks = reviewText.split(/(?=🔴|🟡|🔵)/);

  for (const block of findingBlocks) {
    const severityMatch = block.match(/^(🔴|🟡|🔵)\s*(.*)/);
    if (!severityMatch) {
      continue;
    }

    const lineMatch = block.match(/line\s+(\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

    comments.push({
      path: filename,
      body: block.trim(),
      line,
      side: "RIGHT",
    });
  }

  // If no structured findings, post as a single summary comment
  if (comments.length === 0 && !reviewText.includes("✅ No issues found")) {
    comments.push({
      path: filename,
      body: `**Gizzi Code Review:**\n\n${reviewText}`,
    });
  }

  return comments;
}

/**
 * Reviews all changed files in a pull request using the Allternit API.
 * Posts individual line comments for specific findings and a summary
 * comment with the overall review results.
 * @param client - The Allternit API client
 * @returns The action result with review summary
 */
export async function reviewPullRequest(client: AllternitClient): Promise<ActionResult> {
  const ctx = getRepoContext();

  if (!ctx.prNumber) {
    return {
      success: false,
      result: "No pull request context found. This action must run on a pull_request event.",
      summary: "No PR context available",
    };
  }

  const files = await getPullRequestFiles(ctx.owner, ctx.repo, ctx.prNumber);
  const reviewableFiles = files.filter((f) => isReviewable(f.filename) && f.patch);

  if (reviewableFiles.length === 0) {
    return {
      success: true,
      result: "No reviewable files found in this PR.",
      summary: "Skipped — no reviewable files",
    };
  }

  const findings: Array<{ file: string; review: string; commentCount: number }> = [];
  let totalComments = 0;

  for (const file of reviewableFiles) {
    try {
      const review = await client.reviewDiff(file.patch!, file.filename);
      const comments = parseReviewFindings(review, file.filename);

      // Post individual comments for each finding
      if (ctx.sha) {
        for (const comment of comments) {
          await createReviewComment(
            ctx.owner,
            ctx.repo,
            ctx.prNumber,
            comment,
            ctx.sha
          );
        }
      }

      findings.push({
        file: file.filename,
        review,
        commentCount: comments.length,
      });
      totalComments += comments.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      findings.push({
        file: file.filename,
        review: `Error reviewing: ${msg}`,
        commentCount: 0,
      });
    }
  }

  // Build and post summary
  const summary = buildReviewSummary(findings, totalComments);
  await postPRComment(ctx.owner, ctx.repo, ctx.prNumber, summary);

  return {
    success: true,
    result: `Reviewed ${reviewableFiles.length} files, posted ${totalComments} comments.`,
    summary,
  };
}

/**
 * Builds a markdown summary of the review findings.
 * @param findings - Array of per-file review results
 * @param totalComments - Total number of comments posted
 * @returns Markdown summary string
 */
function buildReviewSummary(
  findings: Array<{ file: string; review: string; commentCount: number }>,
  totalComments: number
): string {
  const lines: string[] = [
    "## 🔍 Gizzi Code Review Summary",
    "",
    `**Files reviewed:** ${findings.length}`,
    `**Comments posted:** ${totalComments}`,
    "",
    "---",
    "",
  ];

  for (const finding of findings) {
    lines.push(`### \`${finding.file}\` (${finding.commentCount} findings)`);
    lines.push("");
    lines.push(finding.review);
    lines.push("");
  }

  lines.push("---");
  lines.push("_Review powered by Gizzi Code by Allternit_");

  return lines.join("\n");
}
