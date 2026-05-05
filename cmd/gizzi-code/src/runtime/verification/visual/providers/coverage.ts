/**
 * Coverage Map Capture Provider
 * 
 * Generates visual coverage heatmaps (SVG/PNG) from test coverage data.
 */

import { VisualCaptureProvider, type CaptureContext } from "./base";
import type { CoverageMapArtifact, VisualArtifact, ImageData } from "../types";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";

interface CoverageJSON {
  [file: string]: {
    path: string;
    statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
    fnMap: Record<string, { name: string; line: number }>;
    branchMap: Record<string, { line: number; type: string }>;
    s: Record<string, number>;
    f: Record<string, number>;
    b: Record<string, number[]>;
  };
}

export class CoverageCaptureProvider extends VisualCaptureProvider {
  readonly type = "coverage-map" as const;
  readonly name = "Coverage Map";
  readonly supported = true;
  
  async checkAvailability(): Promise<boolean> {
    try {
      await fs.access("coverage/coverage-final.json");
      return true;
    } catch {
      return false;
    }
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    const artifacts: CoverageMapArtifact[] = [];
    
    await this.ensureCoverageExists(context);
    
    const coverageData = await this.loadCoverageData();
    if (!coverageData) return artifacts;
    
    const relevantFiles = this.getRelevantFiles(context, coverageData);
    
    for (const file of relevantFiles.slice(0, 5)) { // Limit files
      const artifact = await this.generateCoverageArtifact(file, coverageData[file]);
      if (artifact) artifacts.push(artifact);
    }
    
    return artifacts;
  }
  
  private async ensureCoverageExists(context: CaptureContext): Promise<void> {
    try {
      await fs.access("coverage/coverage-final.json");
      return;
    } catch {
      // Need to generate
    }
    
    try {
      const testCommand = context.testFiles?.length 
        ? `npm test -- --coverage ${context.testFiles.join(" ")}`
        : "npm test -- --coverage";
      
      execSync(testCommand, { cwd: context.cwd, timeout: 120000, stdio: "pipe" });
    } catch {
      // Tests may fail but coverage still generated
    }
  }
  
  private async loadCoverageData(): Promise<CoverageJSON | null> {
    try {
      const content = await fs.readFile("coverage/coverage-final.json", "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  private getRelevantFiles(context: CaptureContext, coverageData: CoverageJSON): string[] {
    const files = Object.keys(coverageData);
    
    if (context.files?.length) {
      return files.filter(f => context.files!.some(vf => f.includes(vf) || vf.includes(f)));
    }
    
    if (context.patches?.length) {
      return files.filter(f => context.patches!.some(p => f.includes(p.path) || p.path.includes(f)));
    }
    
    return files.filter(f => !f.includes(".test.") && !f.includes(".spec.") && !f.includes("__tests__"));
  }
  
  private async generateCoverageArtifact(
    filePath: string,
    data: CoverageJSON[string]
  ): Promise<CoverageMapArtifact | null> {
    try {
      const sourceLines = await this.readSourceFile(filePath);
      if (!sourceLines) return null;
      
      const lineCoverage = this.calculateLineCoverage(data, sourceLines);
      const metrics = this.calculateMetrics(data);
      
      // Generate visual SVG
      const svgPath = await this.generateCoverageSVG(filePath, sourceLines, lineCoverage, metrics);
      
      // Generate summary image (PNG placeholder for now)
      const imageData = svgPath ? await this.createImageData(svgPath, "svg") : undefined;
      
      // Create artifact
      const artifact: CoverageMapArtifact = {
        id: this.generateId("coverage"),
        type: "coverage-map",
        description: `Test coverage: ${path.basename(filePath)}`,
        timestamp: new Date().toISOString(),
        verificationClaim: `${metrics.lines.percentage.toFixed(1)}% line coverage (${metrics.lines.covered}/${metrics.lines.total})`,
        confidence: metrics.lines.percentage >= 80 ? 0.9 : metrics.lines.percentage >= 50 ? 0.6 : 0.3,
        image: imageData,
        annotations: [
          this.createAnnotation("LINES", `${metrics.lines.percentage.toFixed(0)}%`, { 
            color: metrics.lines.percentage >= 80 ? "green" : metrics.lines.percentage >= 50 ? "orange" : "red"
          }),
          this.createAnnotation("FUNCS", `${metrics.functions.percentage.toFixed(0)}%`, {
            color: metrics.functions.percentage >= 80 ? "green" : "orange"
          }),
          ...(metrics.lines.percentage < 80 ? [this.createAnnotation(
            "WARNING",
            "Low coverage - add tests",
            { color: "orange", severity: "warning" }
          )] : []),
        ],
        sourceRefs: [{ file: filePath }],
        llmContext: this.formatForLLM(filePath, metrics, lineCoverage),
        data: {
          file: filePath,
          metrics,
          lineCoverage: lineCoverage.slice(0, 100), // Limit data
        },
      };
      
      return artifact;
    } catch (error) {
      console.error(`Failed to generate coverage for ${filePath}:`, error);
      return null;
    }
  }
  
  private async readSourceFile(filePath: string): Promise<string[] | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content.split("\n");
    } catch {
      return null;
    }
  }
  
  private calculateLineCoverage(
    data: CoverageJSON[string],
    sourceLines: string[]
  ): CoverageMapArtifact["data"]["lineCoverage"] {
    const coverage: CoverageMapArtifact["data"]["lineCoverage"] = [];
    
    for (let i = 0; i < sourceLines.length; i++) {
      const lineNumber = i + 1;
      const hits = this.getLineHits(data, lineNumber);
      
      coverage.push({
        line: lineNumber,
        code: sourceLines[i],
        status: hits === undefined ? "uncovered" : hits > 0 ? "covered" : "uncovered",
        hits: hits || 0,
      });
    }
    
    return coverage;
  }
  
  private getLineHits(data: CoverageJSON[string], lineNumber: number): number | undefined {
    for (const [stmtId, stmt] of Object.entries(data.statementMap)) {
      if (stmt.start.line <= lineNumber && stmt.end.line >= lineNumber) {
        return data.s[stmtId];
      }
    }
    return undefined;
  }
  
  private calculateMetrics(data: CoverageJSON[string]) {
    const statements = Object.values(data.s);
    const functions = Object.values(data.f);
    const branches = Object.values(data.b).flat();
    
    const coveredStatements = statements.filter(h => h > 0).length;
    const coveredFunctions = functions.filter(h => h > 0).length;
    const coveredBranches = branches.filter(h => h > 0).length;
    
    return {
      lines: {
        total: statements.length,
        covered: coveredStatements,
        percentage: statements.length > 0 ? (coveredStatements / statements.length) * 100 : 0,
      },
      functions: {
        total: functions.length,
        covered: coveredFunctions,
        percentage: functions.length > 0 ? (coveredFunctions / functions.length) * 100 : 0,
      },
      branches: {
        total: branches.length,
        covered: coveredBranches,
        percentage: branches.length > 0 ? (coveredBranches / branches.length) * 100 : 0,
      },
    };
  }
  
  private async generateCoverageSVG(
    filePath: string,
    sourceLines: string[],
    lineCoverage: CoverageMapArtifact["data"]["lineCoverage"],
    metrics: CoverageMapArtifact["data"]["metrics"]
  ): Promise<string | null> {
    try {
      const fileName = path.basename(filePath).replace(/[^a-zA-Z0-9]/g, "_");
      const outputPath = path.join(this.options.outputDir, `coverage_${fileName}_${Date.now()}.svg`);
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      // Generate SVG with syntax highlighting
      const lineHeight = 20;
      const maxLines = Math.min(sourceLines.length, 100);
      const width = 800;
      const height = 120 + maxLines * lineHeight;
      
      let linesSvg = "";
      for (let i = 0; i < maxLines; i++) {
        const cov = lineCoverage[i];
        const y = 100 + i * lineHeight;
        const isEmpty = !sourceLines[i]?.trim();
        
        // Background color based on coverage
        let bgColor = "#ffffff";
        if (!isEmpty) {
          if (cov.status === "covered") bgColor = "#d4edda"; // Light green
          else if (cov.status === "uncovered") bgColor = "#f8d7da"; // Light red
        }
        
        // Line number
        linesSvg += `<rect x="0" y="${y}" width="50" height="${lineHeight}" fill="#f5f5f5" />`;
        linesSvg += `<text x="45" y="${y + 14}" font-family="monospace" font-size="12" fill="#666" text-anchor="end">${i + 1}</text>`;
        
        // Line background
        linesSvg += `<rect x="50" y="${y}" width="${width - 50}" height="${lineHeight}" fill="${bgColor}" />`;
        
        // Code text (escaped)
        const code = this.escapeXml(sourceLines[i].substring(0, 80));
        linesSvg += `<text x="60" y="${y + 14}" font-family="monospace" font-size="12" fill="#333">${code}</text>`;
        
        // Coverage indicator
        if (!isEmpty) {
          const indicatorColor = cov.status === "covered" ? "#28a745" : cov.status === "uncovered" ? "#dc3545" : "#6c757d";
          linesSvg += `<rect x="50" y="${y}" width="4" height="${lineHeight}" fill="${indicatorColor}" />`;
        }
      }
      
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .header { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; }
      .metric { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; font-weight: bold; }
    </style>
  </defs>
  
  <!-- Header -->
  <rect width="${width}" height="80" fill="#f8f9fa" />
  <text x="20" y="30" class="header" font-size="16" font-weight="bold" fill="#333">${path.basename(filePath)}</text>
  <text x="20" y="55" class="header" font-size="12" fill="#666">${filePath}</text>
  
  <!-- Metrics -->
  <rect x="${width - 200}" y="10" width="180" height="60" rx="4" fill="${metrics.lines.percentage >= 80 ? '#d4edda' : metrics.lines.percentage >= 50 ? '#fff3cd' : '#f8d7da'}" />
  <text x="${width - 190}" y="35" class="metric" font-size="24" fill="${metrics.lines.percentage >= 80 ? '#155724' : metrics.lines.percentage >= 50 ? '#856404' : '#721c24'}">${metrics.lines.percentage.toFixed(1)}%</text>
  <text x="${width - 190}" y="55" class="header" font-size="11" fill="#666">${metrics.lines.covered}/${metrics.lines.total} lines</text>
  
  <!-- Legend -->
  <rect x="20" y="65" width="12" height="12" fill="#d4edda" />
  <text x="38" y="75" class="header" font-size="10" fill="#666">Covered</text>
  <rect x="100" y="65" width="12" height="12" fill="#f8d7da" />
  <text x="118" y="75" class="header" font-size="10" fill="#666">Uncovered</text>
  
  <!-- Lines -->
  ${linesSvg}
</svg>`;
      
      await fs.writeFile(outputPath, svg);
      return outputPath;
    } catch (error) {
      console.error("Failed to generate SVG:", error);
      return null;
    }
  }
  
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
  
  private formatForLLM(
    filePath: string,
    metrics: CoverageMapArtifact["data"]["metrics"],
    lineCoverage: CoverageMapArtifact["data"]["lineCoverage"]
  ): string {
    let context = `File: ${filePath}\n\n`;
    context += `Coverage Summary:\n`;
    context += `  Lines: ${metrics.lines.percentage.toFixed(1)}% (${metrics.lines.covered}/${metrics.lines.total})\n`;
    context += `  Functions: ${metrics.functions.percentage.toFixed(1)}% (${metrics.functions.covered}/${metrics.functions.total})\n`;
    context += `  Branches: ${metrics.branches.percentage.toFixed(1)}% (${metrics.branches.covered}/${metrics.branches.total})\n\n`;
    
    const uncovered = lineCoverage.filter(l => l.status === "uncovered" && l.code.trim());
    if (uncovered.length > 0) {
      context += `Uncovered lines (${Math.min(uncovered.length, 15)} shown):\n`;
      for (const line of uncovered.slice(0, 15)) {
        context += `  Line ${line.line}: ${line.code.slice(0, 60)}\n`;
      }
    } else {
      context += `✓ All lines covered\n`;
    }
    
    return context;
  }
}
