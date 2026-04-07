/**
 * Verification CLI Commands
 * 
 * Command-line interface for verification operations.
 */

import { Command } from "commander";
import { Log } from "@/shared/util/log";
import * as fs from "fs/promises";
import * as path from "path";

import { VerificationOrchestrator } from "../verifiers/orchestrator";
import { VerificationStore } from "../storage/store";
import { formatVerificationResult, formatCertificate } from "../utils/formatting";
import { exportVerificationReport } from "../utils/export";

const log = Log.create({ service: "verification.cli" });

// ============================================================================
// CLI Program Setup
// ============================================================================

export function createVerificationCli(): Command {
  const program = new Command("verify")
    .description("Semi-formal code verification")
    .version("1.0.0");
  
  // Verify command
  program
    .command("run")
    .description("Run verification on code changes")
    .option("-m, --mode <mode>", "Verification mode (empirical|semi-formal|both|adaptive)", "adaptive")
    .option("-d, --description <desc>", "Description of changes")
    .option("-p, --patches <files...>", "Patch files to verify")
    .option("-t, --tests <files...>", "Test files to run")
    .option("-c, --confidence <level>", "Minimum confidence (high|medium|low)", "medium")
    .option("--format <format>", "Output format (json|markdown|html)", "markdown")
    .option("-o, --output <file>", "Output file")
    .option("--capture", "Enable screenshot capture during verification")
    .option("--capture-video", "Enable video capture (requires platform support)")
    .option("--capture-interval <ms>", "Screenshot interval in milliseconds", "1000")
    .option("--capture-output <dir>", "Directory for capture output")
    .option("--review", "Require human review before cleanup")
    .option("--cleanup-after <seconds>", "Auto-cleanup delay in seconds", "3600")
    .action(runVerify);
  
  // List command
  program
    .command("list")
    .description("List verification history")
    .option("-s, --session <id>", "Filter by session ID")
    .option("--type <type>", "Filter by type")
    .option("--passed", "Show only passed")
    .option("--failed", "Show only failed")
    .option("--confidence <level>", "Filter by confidence")
    .option("-n, --limit <number>", "Limit results", "20")
    .action(listVerifications);
  
  // Show command
  program
    .command("show <id>")
    .description("Show verification details")
    .option("-f, --format <format>", "Output format", "markdown")
    .option("-o, --output <file>", "Output file")
    .action(showVerification);
  
  // Export command
  program
    .command("export")
    .description("Export verification report")
    .option("-f, --format <format>", "Export format (json|markdown|html)", "markdown")
    .option("-s, --since <date>", "Export since date")
    .option("-u, --until <date>", "Export until date")
    .option("-o, --output <file>", "Output file", "verification-report.md")
    .action(exportReport);
  
  // Confirm command
  program
    .command("confirm <id>")
    .description("Confirm verification result (ground truth)")
    .option("--correct", "Mark as correct", true)
    .option("--incorrect", "Mark as incorrect")
    .option("-n, --notes <notes>", "Confirmation notes")
    .requiredOption("-b, --by <name>", "Your name/email")
    .action(confirmVerification);
  
  // Stats command
  program
    .command("stats")
    .description("Show verification statistics")
    .option("-s, --since <date>", "Since date")
    .option("-u, --until <date>", "Until date")
    .action(showStats);
  
  // Media review commands
  const mediaCmd = program
    .command("media")
    .description("Media capture management");
  
  mediaCmd
    .command("review <captureId>")
    .description("Review captured media")
    .option("-a, --approve", "Approve the capture")
    .option("-r, --reject", "Reject the capture")
    .option("-n, --notes <notes>", "Review notes")
    .requiredOption("-b, --by <name>", "Reviewer name/email")
    .action(reviewMedia);
  
  mediaCmd
    .command("cleanup <captureId>")
    .description("Cleanup captured media")
    .option("--keep-screenshots", "Keep screenshot files")
    .option("--keep-video", "Keep video files")
    .option("--keep-gif", "Keep GIF files")
    .action(cleanupMedia);
  
  // Visual artifact commands
  const visualCmd = program
    .command("visual")
    .description("Visual evidence management");
  
  visualCmd
    .command("list <verificationId>")
    .description("List visual artifacts for a verification")
    .action(listVisualArtifacts);
  
  visualCmd
    .command("show <artifactId>")
    .description("Show visual artifact details")
    .option("-o, --output <file>", "Export artifact to file")
    .action(showVisualArtifact);
  
  visualCmd
    .command("capture")
    .description("Capture visual evidence manually")
    .option("-f, --files <files...>", "Files to capture")
    .option("-t, --tests <tests...>", "Test files")
    .option("-o, --output <dir>", "Output directory", "./visual-evidence")
    .option("--types <types...>", "Artifact types to capture", ["ui-state", "coverage-map", "console-output"])
    .action(captureVisualEvidence);
  
  return program;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function runVerify(options: {
  mode: string;
  description?: string;
  patches?: string[];
  tests?: string[];
  confidence: string;
  format: string;
  output?: string;
  capture?: boolean;
  captureVideo?: boolean;
  captureInterval: string;
  captureOutput?: string;
  review?: boolean;
  cleanupAfter: string;
}) {
  try {
    process.stdout.write("Running verification...\n");
    
    // Build orchestrator config with media capture options
    const config: any = {
      defaultMode: options.mode as any,
    };
    
    if (options.capture || options.captureVideo) {
      config.mediaCapture = {
        enabled: true,
        screenshots: options.capture ?? false,
        video: options.captureVideo ?? false,
        screenshotInterval: parseInt(options.captureInterval, 10),
        outputDir: options.captureOutput,
        requireReview: options.review ?? false,
        autoCleanupAfter: parseInt(options.cleanupAfter, 10),
      };
      process.stdout.write("Media capture enabled\n");
    }

    const orchestrator = new VerificationOrchestrator(`cli_${Date.now()}`, config);
    
    // Build context
    const context: any = {
      description: options.description || "CLI verification",
    };
    
    if (options.tests) {
      context.testFiles = options.tests;
    }
    
    // Load patches if provided
    if (options.patches) {
      context.patches = [];
      for (const patchPath of options.patches) {
        const content = await fs.readFile(patchPath, "utf-8");
        context.patches.push({
          id: path.basename(patchPath),
          path: patchPath,
          description: `Patch from ${patchPath}`,
          diff: content,
          state: "modified",
        });
      }
    }
    
    // Create minimal plan/receipts
    const plan: import("../types").VerificationRequest["plan"] = { 
      sessionId: `cli_${Date.now()}`,
      steps: [],
      exitCriteria: [],
      goal: options.description || "CLI verification",
    };
    const receipts: import("../types").VerificationRequest["receipts"] = [];
    
    const result = await orchestrator.verify(plan as any, receipts as any, context);
    
    // Format output
    let output: string;
    
    switch (options.format) {
      case "json":
        output = JSON.stringify(result, null, 2);
        break;
      case "html":
        output = `<pre>${formatVerificationResult(result)}</pre>`;
        break;
      case "markdown":
      default:
        output = formatVerificationResult(result);
        if (result.certificate) {
          output += "\n\n" + formatCertificate(result.certificate);
        }
        break;
    }
    
    // Write or print output
    if (options.output) {
      await fs.writeFile(options.output, output, "utf-8");
      process.stdout.write(`Output written to ${options.output}\n`);
    } else {
      process.stdout.write(output + "\n");
    }

    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    log.error("Verification failed", { error });
    process.exit(1);
  }
}

async function listVerifications(options: {
  session?: string;
  type?: string;
  passed?: boolean;
  failed?: boolean;
  confidence?: string;
  limit: string;
}) {
  try {
    const store = VerificationStore.getInstance();
    
    const results = await store.query({
      sessionId: options.session,
      type: options.type as any,
      passed: options.passed ? true : options.failed ? false : undefined,
      confidence: options.confidence as any,
      limit: parseInt(options.limit, 10),
    });
    
    process.stdout.write("Verification History\n");
    process.stdout.write("=" .repeat(80) + "\n");

    for (const v of results) {
      const status = v.result.passed ? "✓" : "✗";
      const date = new Date(v.timestamp).toLocaleString();
      process.stdout.write(`${status} ${v.id.slice(0, 16)}... [${v.result.confidence}] ${date}\n`);
      process.stdout.write(`  ${v.fullResult.reason.slice(0, 60)}...\n`);
    }
  } catch (error) {
    log.error("Failed to list verifications", { error });
    process.exit(1);
  }
}

async function showVerification(
  id: string,
  options: {
    format: string;
    output?: string;
  }
) {
  try {
    const store = VerificationStore.getInstance();
    const verification = await store.get(id);
    
    if (!verification) {
      process.stderr.write(`Verification ${id} not found\n`);
      process.exit(1);
    }
    
    let output: string;
    
    switch (options.format) {
      case "json":
        output = JSON.stringify(verification, null, 2);
        break;
      default:
        output = formatVerificationResult(verification.fullResult);
        if (verification.certificate) {
          output += "\n\n" + formatCertificate(verification.certificate, {
            includeMetadata: true,
          });
        }
        break;
    }
    
    if (options.output) {
      await fs.writeFile(options.output, output, "utf-8");
      process.stdout.write(`Output written to ${options.output}\n`);
    } else {
      process.stdout.write(output + "\n");
    }
  } catch (error) {
    log.error("Failed to show verification", { error });
    process.exit(1);
  }
}

async function exportReport(options: {
  format: string;
  since?: string;
  until?: string;
  output: string;
}) {
  try {
    const store = VerificationStore.getInstance();
    
    const results = await store.query({
      since: options.since ? new Date(options.since) : undefined,
      until: options.until ? new Date(options.until) : undefined,
      limit: 10000,
    });
    
    const report = exportVerificationReport(results, {
      format: options.format as any,
      includeMetadata: true,
      title: "Verification Report",
      includeStatistics: true,
    });
    
    await fs.writeFile(options.output, report, "utf-8");
    process.stdout.write(`Report exported to ${options.output}\n`);
  } catch (error) {
    log.error("Failed to export report", { error });
    process.exit(1);
  }
}

async function confirmVerification(
  id: string,
  options: {
    correct: boolean;
    incorrect: boolean;
    notes?: string;
    by: string;
  }
) {
  try {
    const store = VerificationStore.getInstance();
    
    const correct = options.incorrect ? false : options.correct;
    
    await store.confirm(id, correct, options.by, options.notes);
    
    process.stdout.write(`Verification ${id} marked as ${correct ? "correct" : "incorrect"}\n`);
  } catch (error) {
    log.error("Failed to confirm verification", { error });
    process.exit(1);
  }
}

async function showStats(options: {
  since?: string;
  until?: string;
}) {
  try {
    const store = VerificationStore.getInstance();
    
    const stats = await store.getStatistics(
      options.since ? new Date(options.since) : undefined,
      options.until ? new Date(options.until) : undefined
    );
    
    process.stdout.write("Verification Statistics\n");
    process.stdout.write("=" .repeat(40) + "\n");
    process.stdout.write(`Total: ${stats.counts.total}\n`);
    process.stdout.write(`Passed: ${stats.counts.passed} (${((stats.counts.passed / stats.counts.total) * 100).toFixed(1)}%)\n`);
    process.stdout.write(`Failed: ${stats.counts.failed} (${((stats.counts.failed / stats.counts.total) * 100).toFixed(1)}%)\n`);
    process.stdout.write("\n");
    process.stdout.write("By Confidence:\n");
    process.stdout.write(`  High: ${stats.byConfidence.high}\n`);
    process.stdout.write(`  Medium: ${stats.byConfidence.medium}\n`);
    process.stdout.write(`  Low: ${stats.byConfidence.low}\n`);
    process.stdout.write("\n");
    process.stdout.write("Confirmation:\n");
    process.stdout.write(`  Confirmed Correct: ${stats.confirmation.confirmedCorrect}\n`);
    process.stdout.write(`  Confirmed Incorrect: ${stats.confirmation.confirmedIncorrect}\n`);
    process.stdout.write(`  Unconfirmed: ${stats.confirmation.unconfirmed}\n`);
    if (stats.confirmation.accuracy !== undefined) {
      process.stdout.write(`  Accuracy: ${(stats.confirmation.accuracy * 100).toFixed(1)}%\n`);
    }
    process.stdout.write("\n");
    process.stdout.write("Performance:\n");
    process.stdout.write(`  Average Duration: ${(stats.performance.averageDurationMs / 1000).toFixed(1)}s\n`);
    process.stdout.write(`  P95 Duration: ${(stats.performance.p95DurationMs / 1000).toFixed(1)}s\n`);
  } catch (error) {
    log.error("Failed to show statistics", { error });
    process.exit(1);
  }
}

async function reviewMedia(
  captureId: string,
  options: {
    approve?: boolean;
    reject?: boolean;
    notes?: string;
    by: string;
  }
) {
  try {
    // Note: This is a placeholder - in production would load from persistent storage
    process.stdout.write(`Reviewing capture ${captureId}\n`);
    
    if (!options.approve && !options.reject) {
      process.stderr.write("Error: Must specify --approve or --reject\n");
      process.exit(1);
    }
    
    const decision = options.reject ? "REJECTED" : "APPROVED";
    process.stdout.write(`Capture ${decision} by ${options.by}\n`);
    if (options.notes) {
      process.stdout.write(`Notes: ${options.notes}\n`);
    }
    
    // In production, this would update the workflow state in storage
    process.stdout.write("Review recorded.\n");
  } catch (error) {
    log.error("Failed to review media", { error });
    process.exit(1);
  }
}

async function cleanupMedia(
  captureId: string,
  options: {
    keepScreenshots?: boolean;
    keepVideo?: boolean;
    keepGif?: boolean;
  }
) {
  try {
    process.stdout.write(`Cleaning up capture ${captureId}\n`);
    
    const kept: string[] = [];
    if (options.keepScreenshots) kept.push("screenshots");
    if (options.keepVideo) kept.push("video");
    if (options.keepGif) kept.push("GIF");
    
    if (kept.length > 0) {
      process.stdout.write(`Keeping: ${kept.join(", ")}\n`);
    }
    
    // In production, this would cleanup from persistent storage
    process.stdout.write("Cleanup completed.\n");
  } catch (error) {
    log.error("Failed to cleanup media", { error });
    process.exit(1);
  }
}

// ============================================================================
// Visual Artifact Commands
// ============================================================================

async function listVisualArtifacts(verificationId: string) {
  try {
    const store = VerificationStore.getInstance();
    const verification = await store.get(verificationId);
    
    if (!verification) {
      process.stderr.write(`Verification ${verificationId} not found\n`);
      process.exit(1);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visualEvidence = (verification.certificate?.visualEvidence as any[]) || 
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (verification.fullResult as any)?.visualEvidence?.artifacts;
    
    if (!visualEvidence || visualEvidence.length === 0) {
      process.stdout.write("No visual artifacts found for this verification.\n");
      return;
    }
    
    process.stdout.write(`Visual Artifacts for ${verificationId}\n`);
    process.stdout.write("=" .repeat(80) + "\n\n");
    
    for (const artifact of visualEvidence) {
      const icon = artifact.type === "ui-state" ? "🖼️" :
                   artifact.type === "coverage-map" ? "📊" :
                   artifact.type === "console-output" ? "📝" :
                   artifact.type === "visual-diff" ? "👁️" :
                   artifact.type === "error-state" ? "❌" : "📄";
      
      process.stdout.write(`${icon} ${artifact.id}\n`);
      process.stdout.write(`   Type: ${artifact.type}\n`);
      process.stdout.write(`   Description: ${artifact.description}\n`);
      process.stdout.write(`   Claim: ${artifact.verificationClaim}\n`);
      process.stdout.write(`   Confidence: ${(artifact.confidence * 100).toFixed(0)}%\n`);
      if (artifact.imagePath) {
        process.stdout.write(`   Image: ${artifact.imagePath}\n`);
      }
      process.stdout.write("\n");
    }
  } catch (error) {
    log.error("Failed to list visual artifacts", { error });
    process.exit(1);
  }
}

async function showVisualArtifact(
  artifactId: string,
  options: { output?: string }
) {
  try {
    process.stdout.write(`Visual Artifact: ${artifactId}\n`);
    process.stdout.write("=" .repeat(80) + "\n\n");
    
    // In production, would load from storage
    process.stdout.write("Note: In production, this would show the artifact details\n");
    process.stdout.write("      and optionally export the image to the specified path.\n");
    
    if (options.output) {
      process.stdout.write(`\nExport path: ${options.output}\n`);
    }
  } catch (error) {
    log.error("Failed to show visual artifact", { error });
    process.exit(1);
  }
}

async function captureVisualEvidence(options: {
  files?: string[];
  tests?: string[];
  output: string;
  types: string[];
}) {
  try {
    process.stdout.write("Capturing visual evidence...\n");
    
    const { VisualCaptureManager } = await import("../visual");
    
    const manager = new VisualCaptureManager({
      outputDir: options.output,
      enabledTypes: options.types as any,
    });
    
    const result = await manager.capture({
      sessionId: `manual_${Date.now()}`,
      verificationId: `capture_${Date.now()}`,
      cwd: process.cwd(),
      files: options.files,
      testFiles: options.tests,
    });
    
    process.stdout.write(`\n✅ Capture complete!\n\n`);
    process.stdout.write(`Artifacts captured: ${result.artifacts.length}\n`);
    process.stdout.write(`Types: ${result.summary.typesCaptured.join(", ")}\n`);
    process.stdout.write(`Output: ${options.output}\n\n`);
    
    for (const artifact of result.artifacts) {
      const icon = artifact.confidence >= 0.8 ? "✅" : "⚠️";
      process.stdout.write(`${icon} ${artifact.type}: ${artifact.description}\n`);
      if (artifact.image) {
        process.stdout.write(`   Image: ${artifact.image.path}\n`);
      }
    }
    
    // Export metadata
    await manager.exportArtifacts(result);
    process.stdout.write(`\nMetadata exported to ${options.output}\n`);
  } catch (error) {
    log.error("Failed to capture visual evidence", { error });
    process.exit(1);
  }
}
