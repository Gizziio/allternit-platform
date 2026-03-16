/**
 * UI State Capture Provider
 * 
 * Captures rendered UI components using existing browser automation skills.
 */

import { VisualCaptureProvider, type CaptureContext } from "./base";
import type { UIStateArtifact, VisualArtifact, ImageData } from "../types";
import { BrowserAdapter, checkDevServer } from "../browser/adapter";
import * as path from "path";
import * as fs from "fs/promises";

interface UIComponent {
  name: string;
  file: string;
  props?: Record<string, unknown>;
  selector?: string;
}

export class UIStateCaptureProvider extends VisualCaptureProvider {
  readonly type = "ui-state" as const;
  readonly name = "UI State";
  readonly supported = true;
  
  private detectedComponents: UIComponent[] = [];
  private browser: BrowserAdapter | null = null;
  
  async checkAvailability(): Promise<boolean> {
    const available = await BrowserAdapter.detectAvailable();
    return available !== null;
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    const artifacts: UIStateArtifact[] = [];
    
    // Detect UI components
    this.detectedComponents = await this.detectComponents(context);
    
    if (this.detectedComponents.length === 0) {
      return artifacts;
    }
    
    // Detect which browser automation to use
    const browserType = await BrowserAdapter.detectAvailable();
    if (!browserType) {
      console.warn("No browser automation available");
      return artifacts;
    }
    
    // Initialize browser adapter
    this.browser = new BrowserAdapter({
      type: browserType,
      outputDir: this.options.outputDir,
      viewport: this.options.viewport,
    });
    
    try {
      // Capture each component with screenshots
      for (const component of this.detectedComponents) {
        const artifact = await this.captureComponentWithScreenshot(component, context);
        if (artifact) artifacts.push(artifact);
      }
      
      // Capture full app state if dev server running
      const appArtifact = await this.captureAppStateWithScreenshot(context);
      if (appArtifact) artifacts.push(appArtifact);
    } finally {
      // No cleanup needed for adapter
    }
    
    return artifacts;
  }
  
  private async detectComponents(context: CaptureContext): Promise<UIComponent[]> {
    const components: UIComponent[] = [];
    const files = context.files || context.patches?.map(p => p.path) || [];
    
    for (const file of files) {
      if (!this.isUIFile(file)) continue;
      
      try {
        const content = await fs.readFile(path.join(context.cwd, file), "utf-8");
        
        // Detect React components
        const componentMatches = content.match(/export\s+(?:default\s+)?(?:function|class)\s+(\w+)/g);
        if (componentMatches) {
          for (const match of componentMatches) {
            const name = match.match(/\b(\w+)\s*$/)?.[1];
            if (name && !name.startsWith("use")) { // Skip hooks
              components.push({
                name,
                file,
                selector: `[data-testid="${name.toLowerCase()}"], .${name}, #${name}`,
              });
            }
          }
        }
        
        // Detect Vue components
        if (file.endsWith(".vue")) {
          const name = path.basename(file, ".vue");
          components.push({ name, file, selector: `[data-testid="${name}"]` });
        }
        
        // Detect styled components / CSS changes
        if (file.endsWith(".css") || file.endsWith(".scss") || file.endsWith(".less")) {
          const selectors = this.extractCSSSelectors(content);
          for (const selector of selectors.slice(0, 3)) {
            components.push({
              name: `style-${selector.replace(/[^a-zA-Z0-9]/g, "-")}`,
              file,
              selector,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
    
    // Limit to prevent too many screenshots
    return components.slice(0, 5);
  }
  
  private async captureComponentWithScreenshot(
    component: UIComponent,
    context: CaptureContext
  ): Promise<UIStateArtifact | null> {
    if (!this.browser) return null;
    
    try {
      // Try to extract component source and render it
      const sourceCode = await this.extractComponentSource(component, context);
      
      // Build HTML for rendering
      const html = this.buildComponentHtml(component, sourceCode);
      
      // Render and screenshot
      const renderResult = await this.browser.renderHTML(html, {
        waitForTimeout: 500,
      });
      
      // Create image data from screenshot
      const imageData = await this.createImageData(
        renderResult.screenshot.path,
        "png"
      );
      
      // Build verification claim
      const verificationClaim = `Component "${component.name}" renders without errors`;
      
      // Build annotations
      const annotations = [
        this.createAnnotation("COMPONENT", component.name, { color: "blue" }),
        this.createAnnotation("FILE", path.basename(component.file), { color: "green" }),
      ];
      
      // Check for errors
      if (renderResult.errors.length > 0) {
        annotations.push(this.createAnnotation(
          "ERRORS",
          `${renderResult.errors.length} errors`,
          { color: "red", severity: "error" }
        ));
      }
      
      const artifact: UIStateArtifact = {
        id: this.generateId("ui"),
        type: "ui-state",
        description: `Rendered UI: ${component.name}`,
        timestamp: new Date().toISOString(),
        verificationClaim,
        confidence: renderResult.errors.length === 0 ? 0.9 : 0.5,
        image: imageData,
        annotations,
        sourceRefs: [{ file: component.file, symbol: component.name }],
        llmContext: this.formatComponentForLLM(component, renderResult),
        data: {
          componentName: component.name,
          viewport: this.options.viewport || { width: 1280, height: 720 },
        },
      };
      
      return artifact;
    } catch (error) {
      console.error(`Failed to capture ${component.name}:`, error);
      return this.createFallbackArtifact(component, error as Error);
    }
  }
  
  private async captureAppStateWithScreenshot(context: CaptureContext): Promise<UIStateArtifact | null> {
    if (!this.browser) return null;
    
    // Check for dev server on common ports
    const ports = [3000, 5173, 8080, 3001];
    let runningPort: number | null = null;
    
    for (const port of ports) {
      if (await checkDevServer(port)) {
        runningPort = port;
        break;
      }
    }
    
    if (!runningPort) return null;
    
    try {
      const renderResult = await this.browser.renderURL(`http://localhost:${runningPort}`, {
        waitForTimeout: 1000,
      });
      
      const imageData = await this.createImageData(renderResult.screenshot.path, "png");
      
      return {
        id: this.generateId("ui-app"),
        type: "ui-state",
        description: `Running application at localhost:${runningPort}`,
        timestamp: new Date().toISOString(),
        verificationClaim: "Application renders without errors",
        confidence: renderResult.errors.length === 0 ? 0.85 : 0.4,
        image: imageData,
        annotations: [
          this.createAnnotation("SERVER", `localhost:${runningPort}`, { color: "green" }),
          this.createAnnotation("ERRORS", `${renderResult.errors.length} errors`, { 
            color: renderResult.errors.length > 0 ? "red" : "green",
            severity: renderResult.errors.length > 0 ? "error" : undefined
          }),
        ],
        llmContext: `Application running at localhost:${runningPort}. Screenshot captured. Errors: ${renderResult.errors.join(", ") || "none"}`,
        data: {
          url: `http://localhost:${runningPort}`,
          viewport: this.options.viewport || { width: 1280, height: 720 },
        },
      };
    } catch (error) {
      console.error("Failed to capture app state:", error);
      return null;
    }
  }
  
  private async extractComponentSource(
    component: UIComponent,
    context: CaptureContext
  ): Promise<{ html?: string; styles?: string } | null> {
    try {
      const filePath = path.join(context.cwd, component.file);
      const content = await fs.readFile(filePath, "utf-8");
      
      // Extract JSX/HTML from component
      const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\}/);
      if (returnMatch) {
        return { html: returnMatch[1].trim() };
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  private buildComponentHtml(
    component: UIComponent,
    sourceCode: { html?: string; styles?: string } | null
  ): string {
    const componentHtml = sourceCode?.html || `<div class="${component.name}">Component: ${component.name}</div>`;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
    }
    #root {
      display: inline-block;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    ${sourceCode?.styles || ""}
  </style>
</head>
<body>
  <div id="root">
    ${componentHtml}
  </div>
</body>
</html>
    `;
  }
  
  private createFallbackArtifact(component: UIComponent, error: Error): UIStateArtifact {
    return {
      id: this.generateId("ui-fallback"),
      type: "ui-state",
      description: `Component ${component.name} (screenshot failed)`,
      timestamp: new Date().toISOString(),
      verificationClaim: `Component "${component.name}" detected but could not render`,
      confidence: 0.3,
      annotations: [
        this.createAnnotation("ERROR", error.message, { color: "red", severity: "error" }),
        this.createAnnotation("FILE", component.file, { color: "orange" }),
      ],
      sourceRefs: [{ file: component.file, symbol: component.name }],
      llmContext: `Component ${component.name} was found in ${component.file} but screenshot capture failed: ${error.message}. Code analysis only.`,
      data: {
        componentName: component.name,
        viewport: this.options.viewport || { width: 1280, height: 720 },
      },
    };
  }
  
  private formatComponentForLLM(
    component: UIComponent,
    renderResult: {
      consoleLogs: Array<{ type: string; text: string }>;
      errors: string[];
    }
  ): string {
    let context = `Component: ${component.name}\n`;
    context += `File: ${component.file}\n\n`;
    
    if (renderResult.errors.length > 0) {
      context += "ERRORS:\n";
      for (const err of renderResult.errors.slice(0, 5)) {
        context += `  ❌ ${err}\n`;
      }
      context += "\n";
    }
    
    if (renderResult.consoleLogs.length > 0) {
      const errors = renderResult.consoleLogs.filter(l => l.type === "error");
      if (errors.length > 0) {
        context += "Console Errors:\n";
        for (const log of errors.slice(0, 5)) {
          context += `  ❌ ${log.text}\n`;
        }
      }
    }
    
    return context;
  }
  
  private isUIFile(file: string): boolean {
    const uiExtensions = [".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss", ".less", ".html"];
    return uiExtensions.some(ext => file.endsWith(ext));
  }
  
  private extractCSSSelectors(css: string): string[] {
    const selectors: string[] = [];
    const matches = css.match(/[.#][\w-]+/g);
    if (matches) {
      selectors.push(...matches.slice(0, 20));
    }
    return [...new Set(selectors)];
  }
}
