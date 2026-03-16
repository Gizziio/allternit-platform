/**
 * Visual Diff Capture Provider
 * 
 * Generates before/after visual comparisons using existing browser skills.
 */

import { VisualCaptureProvider, type CaptureContext } from "./base";
import type { VisualDiffArtifact, VisualArtifact, ImageData } from "../types";
import { BrowserAdapter } from "../browser/adapter";
import * as path from "path";
import * as fs from "fs/promises";
import { execSync } from "child_process";

interface FileVersion {
  content: string;
  commit?: string;
  label: string;
}

export class VisualDiffCaptureProvider extends VisualCaptureProvider {
  readonly type = "visual-diff" as const;
  readonly name = "Visual Diff";
  readonly supported = true;
  
  private browser: BrowserAdapter | null = null;
  
  async checkAvailability(): Promise<boolean> {
    const available = await BrowserAdapter.detectAvailable();
    return available !== null;
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    const artifacts: VisualDiffArtifact[] = [];
    
    if (!context.patches || context.patches.length === 0) {
      return artifacts;
    }
    
    // Detect which browser automation to use
    const browserType = await BrowserAdapter.detectAvailable();
    if (!browserType) {
      console.warn("No browser automation available for visual diff");
      return artifacts;
    }
    
    // Initialize browser adapter
    this.browser = new BrowserAdapter({
      type: browserType,
      outputDir: this.options.outputDir,
      viewport: this.options.viewport,
    });
    
    for (const patch of context.patches) {
      if (!this.isUIFile(patch.path)) continue;
      
      const artifact = await this.generateVisualDiff(patch, context);
      if (artifact) artifacts.push(artifact);
    }
    
    return artifacts;
  }
  
  private async generateVisualDiff(
    patch: { path: string; before?: string; after: string },
    context: CaptureContext
  ): Promise<VisualDiffArtifact | null> {
    try {
      // Get before version from git
      const beforeVersion = await this.getBeforeVersion(patch.path, context.cwd);
      
      // Get after version (current)
      const afterVersion: FileVersion = {
        content: patch.after,
        label: "after (current)",
      };
      
      // Render both versions
      const beforeResult = await this.renderVersion(patch.path, beforeVersion, "before");
      const afterResult = await this.renderVersion(patch.path, afterVersion, "after");
      
      if (!beforeResult || !afterResult) {
        return null;
      }
      
      // Compare screenshots
      const comparison = await this.browser!.compareScreenshots(
        beforeResult.screenshotPath,
        afterResult.screenshotPath
      );
      
      const artifact: VisualDiffArtifact = {
        id: this.generateId("diff"),
        type: "visual-diff",
        description: `Visual diff: ${path.basename(patch.path)}`,
        timestamp: new Date().toISOString(),
        verificationClaim: `UI changes in ${path.basename(patch.path)}: ${comparison.diffPercentage.toFixed(1)}% visual difference`,
        confidence: comparison.matches ? 0.95 : 0.85,
        annotations: [
          this.createAnnotation("FILE", patch.path, { color: "blue" }),
          this.createAnnotation("CHANGE", `${comparison.diffPercentage.toFixed(1)}% visual difference`, {
            color: comparison.diffPercentage > 10 ? "orange" : "green",
            severity: comparison.diffPercentage > 30 ? "warning" : undefined,
          }),
        ],
        sourceRefs: [{ file: patch.path }],
        llmContext: this.formatForLLM(patch.path, beforeVersion, afterVersion, comparison),
        data: {
          before: {
            image: beforeResult.imageData,
            description: `Version before changes (${beforeVersion.label})`,
            commit: beforeVersion.commit,
          },
          after: {
            image: afterResult.imageData,
            description: `Version after changes (${afterVersion.label})`,
          },
          diff: {
            image: await this.createImageData(comparison.diffPath, "png"),
            pixelDifference: comparison.pixelDifference,
            changedRegions: [], // Would be populated with actual diff analysis
          },
        },
      };
      
      return artifact;
    } catch (error) {
      console.error(`Failed to generate visual diff for ${patch.path}:`, error);
      return null;
    }
  }
  
  private async getBeforeVersion(filePath: string, cwd: string): Promise<FileVersion> {
    try {
      // Try to get the file from git HEAD
      const content = execSync(`git show HEAD:"${filePath}"`, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      
      // Get commit info
      const commit = execSync("git rev-parse --short HEAD", {
        cwd,
        encoding: "utf-8",
      }).trim();
      
      return {
        content,
        commit,
        label: `before (${commit})`,
      };
    } catch {
      // File might be new, return empty
      return {
        content: "<!-- New file -->",
        label: "before (new file)",
      };
    }
  }
  
  private async renderVersion(
    filePath: string,
    version: FileVersion,
    label: string
  ): Promise<{
    screenshotPath: string;
    imageData: ImageData;
  } | null> {
    if (!this.browser) return null;
    
    try {
      // Build HTML for rendering
      const html = this.buildVersionHtml(filePath, version);
      
      // Render and screenshot
      const renderResult = await this.browser.renderHTML(html, {
        waitForTimeout: 500,
      });
      
      const imageData = await this.createImageData(renderResult.screenshot.path, "png");
      
      return {
        screenshotPath: renderResult.screenshot.path,
        imageData,
      };
    } catch (error) {
      console.error(`Failed to render ${label} version:`, error);
      return null;
    }
  }
  
  private buildVersionHtml(filePath: string, version: FileVersion): string {
    const extension = path.extname(filePath).toLowerCase();
    
    let content: string;
    
    if (extension === ".html" || extension === ".htm") {
      content = version.content;
    } else if ([".tsx", ".jsx", ".vue", ".svelte"].includes(extension)) {
      const componentName = path.basename(filePath, extension);
      content = this.extractJSX(version.content) || `<div>Component: ${componentName}</div>`;
    } else if ([".css", ".scss", ".less"].includes(extension)) {
      content = this.buildCSSPreview(version.content);
    } else {
      content = `<pre>${version.content.substring(0, 1000)}</pre>`;
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, sans-serif;
      background: #f5f5f5;
    }
    #root {
      display: inline-block;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    ${extension.startsWith(".") && [".css", ".scss", ".less"].some(e => extension === e) ? version.content : ""}
  </style>
</head>
<body>
  <div id="root">
    ${content}
  </div>
</body>
</html>
    `;
  }
  
  private extractJSX(content: string): string | null {
    const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\}/);
    if (returnMatch) {
      return returnMatch[1].trim();
    }
    return null;
  }
  
  private buildCSSPreview(css: string): string {
    const selectors = css.match(/[.#][\w-]+/g) || [];
    const uniqueSelectors = [...new Set(selectors)].slice(0, 5);
    
    const samples = uniqueSelectors.map(sel => {
      const tag = sel.startsWith(".") ? "div" : sel.startsWith("#") ? "div" : sel;
      const attr = sel.startsWith(".") ? `class="${sel.slice(1)}"` : 
                   sel.startsWith("#") ? `id="${sel.slice(1)}"` : "";
      return `<${tag} ${attr}>Sample ${sel}</${tag}>`;
    }).join("\n");
    
    return samples || "<div>CSS Preview</div>";
  }
  
  private formatForLLM(
    filePath: string,
    before: FileVersion,
    after: FileVersion,
    comparison: { pixelDifference: number; diffPercentage: number; matches: boolean }
  ): string {
    let context = `Visual Diff: ${filePath}\n\n`;
    context += `Before: ${before.label}\n`;
    context += `After: ${after.label}\n\n`;
    
    context += `Changes:\n`;
    context += `  Visual difference: ${comparison.diffPercentage.toFixed(1)}%\n`;
    context += `  Visual match: ${comparison.matches ? "Yes" : "No"}\n\n`;
    
    if (comparison.diffPercentage > 10) {
      context += "⚠️ Significant visual changes detected.\n";
    } else if (comparison.diffPercentage === 0) {
      context += "✓ No visual changes detected.\n";
    }
    
    return context;
  }
  
  private isUIFile(file: string): boolean {
    const uiExtensions = [".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss", ".less", ".html", ".htm"];
    return uiExtensions.some(ext => file.endsWith(ext));
  }
}
