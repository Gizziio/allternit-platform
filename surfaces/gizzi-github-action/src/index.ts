import { AllternitClient } from "./client";
import { reviewPullRequest } from "./review";
import { generateCode } from "./generate";
import { ActionInputs, ActionResult } from "./types";
import { getRepoContext, postPRComment } from "./github";
import { appendFileSync, writeFileSync } from "fs";

/**
 * Reads an action input from environment variables.
 * GitHub Actions passes inputs as INPUT_<NAME> environment variables.
 * @param name - The input name (case-insensitive)
 * @param fallback - Default value if not set
 * @returns The input value
 */
function getInput(name: string, fallback: string = ""): string {
  const envKey = `INPUT_${name.toUpperCase().replace(/-/g, "_")}`;
  return (process.env[envKey] ?? fallback).trim();
}

/**
 * Parses all action inputs from the environment.
 * @returns Parsed action inputs
 */
function parseInputs(): ActionInputs {
  const action = getInput("action", "review") as ActionInputs["action"];
  if (!["review", "generate", "fix", "explain"].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be one of: review, generate, fix, explain`);
  }

  return {
    action,
    apiUrl: getInput("api-url", "https://api.allternit.com"),
    apiKey: getInput("api-key"),
    target: getInput("target"),
    model: getInput("model", "default"),
    maxTokens: parseInt(getInput("max-tokens", "4096"), 10),
  };
}

/**
 * Sets an action output by writing to the GITHUB_OUTPUT file.
 * @param name - Output name
 * @param value - Output value
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

/**
 * Writes the job summary to GITHUB_STEP_SUMMARY.
 * @param summary - Markdown summary content
 */
function writeJobSummary(summary: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    writeFileSync(summaryFile, summary);
  }
}

/**
 * Handles the 'fix' action — reads diagnostics from a target file
 * and sends them to the API for automated fix suggestions.
 * @param client - The Allternit API client
 * @param target - The target file to fix
 * @returns The action result
 */
async function handleFix(client: AllternitClient, target: string): Promise<ActionResult> {
  if (!target) {
    return {
      success: false,
      result: "No target file specified for fix action.",
      summary: "Missing target",
    };
  }

  try {
    const { readFile } = await import("fs/promises");
    let fileContent: string;

    try {
      fileContent = await readFile(target, "utf8");
    } catch {
      return {
        success: false,
        result: `Could not read target file: ${target}`,
        summary: "File not found",
      };
    }

    const response = await client.chat([
      {
        role: "system",
        content:
          "You are a code fix assistant. Given a file, identify and fix bugs, " +
          "typos, and issues. Return the full corrected file in a markdown code block. " +
          "Explain each fix briefly.",
      },
      {
        role: "user",
        content: `Fix issues in this file (${target}):\n\n\`\`\`\n${fileContent}\n\`\`\``,
      },
    ]);

    return {
      success: true,
      result: response,
      summary: `## 🔧 Gizzi Code Fix\n\n**File:** \`${target}\`\n\n${response}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      result: `Fix failed: ${msg}`,
      summary: `Fix failed: ${msg}`,
    };
  }
}

/**
 * Handles the 'explain' action — reads a target file and generates
 * a detailed explanation of the code.
 * @param client - The Allternit API client
 * @param target - The target file to explain
 * @returns The action result
 */
async function handleExplain(client: AllternitClient, target: string): Promise<ActionResult> {
  if (!target) {
    return {
      success: false,
      result: "No target file specified for explain action.",
      summary: "Missing target",
    };
  }

  try {
    const { readFile } = await import("fs/promises");
    let fileContent: string;

    try {
      fileContent = await readFile(target, "utf8");
    } catch {
      return {
        success: false,
        result: `Could not read target file: ${target}`,
        summary: "File not found",
      };
    }

    const response = await client.chat([
      {
        role: "system",
        content:
          "You are a code explanation assistant. Provide a clear, structured explanation " +
          "of the given code. Cover:\n" +
          "- Purpose and overall functionality\n" +
          "- Key functions/classes and what they do\n" +
          "- Notable patterns or techniques\n" +
          "- Dependencies and how they're used\n" +
          "Use markdown with headers for structure.",
      },
      {
        role: "user",
        content: `Explain this file (${target}):\n\n\`\`\`\n${fileContent}\n\`\`\``,
      },
    ]);

    return {
      success: true,
      result: response,
      summary: `## 📖 Gizzi Code Explanation\n\n**File:** \`${target}\`\n\n${response}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      result: `Explanation failed: ${msg}`,
      summary: `Explanation failed: ${msg}`,
    };
  }
}

/**
 * Main entry point for the GitHub Action.
 * Parses inputs, dispatches to the appropriate handler, and sets outputs.
 */
async function main(): Promise<void> {
  try {
    const inputs = parseInputs();

    if (!inputs.apiKey) {
      throw new Error("api-key input is required. Set it using a repository secret.");
    }

    const client = new AllternitClient({
      apiUrl: inputs.apiUrl,
      apiKey: inputs.apiKey,
      model: inputs.model,
      maxTokens: inputs.maxTokens,
    });

    let result: ActionResult;

    switch (inputs.action) {
      case "review":
        result = await reviewPullRequest(client);
        break;
      case "generate":
        result = await generateCode(client, inputs.target);
        break;
      case "fix":
        result = await handleFix(client, inputs.target);
        break;
      case "explain":
        result = await handleExplain(client, inputs.target);
        break;
      default:
        throw new Error(`Unknown action: ${inputs.action}`);
    }

    // Set outputs
    setOutput("result", result.result);
    setOutput("summary", result.summary);

    // Write job summary
    writeJobSummary(result.summary);

    // Post summary as PR comment if in a PR context
    if (result.summary && result.success) {
      const ctx = getRepoContext();
      if (ctx.prNumber) {
        try {
          await postPRComment(ctx.owner, ctx.repo, ctx.prNumber, result.summary);
        } catch {
          // Non-fatal — summary was already written to job summary
        }
      }
    }

    if (!result.success) {
      console.error(`::error::${result.result}`);
      process.exit(1);
    }

    console.log(result.result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`::error::Gizzi Code action failed: ${msg}`);
    process.exit(1);
  }
}

main();
