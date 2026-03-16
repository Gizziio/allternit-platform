/**
 * Quality Score System Implementation
 *
 * Based on: spec/governance/quality-score.md
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, extname } from 'path';

// ============================================================================
// Types
// ============================================================================

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface QualityMetrics {
  domain: string;
  grade: Grade;
  score: number;
  trend: 'up' | 'down' | 'stable';
  topIssues: QualityIssue[];
  history: ScoreHistory[];
}

export interface QualityIssue {
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  fix: string;
  impact: number;
}

export interface ScoreHistory {
  date: string;
  score: number;
  change: number;
  notes?: string;
}

export interface DomainScores {
  [domain: string]: QualityMetrics;
}

// ============================================================================
// Score Categories
// ============================================================================

export interface CategoryScores {
  architectureAdherence: number;
  testCoverage: number;
  observability: number;
  boundaryEnforcement: number;
  driftFrequency: number;
}

export const CATEGORY_WEIGHTS = {
  architectureAdherence: 0.30,
  testCoverage: 0.25,
  observability: 0.20,
  boundaryEnforcement: 0.15,
  driftFrequency: 0.10,
};

// ============================================================================
// Architecture Layer Definitions
// ============================================================================

interface LayerDefinition {
  name: string;
  patterns: RegExp[];
  allowedImports: string[];
}

const ARCHITECTURE_LAYERS: LayerDefinition[] = [
  {
    name: 'kernel',
    patterns: [/\/0-kernel\//, /\/1-kernel\//],
    allowedImports: ['kernel', 'shared', 'types'],
  },
  {
    name: 'infrastructure',
    patterns: [/\/1-infrastructure\//, /\/2-infrastructure\//],
    allowedImports: ['kernel', 'infrastructure', 'shared', 'types'],
  },
  {
    name: 'integration',
    patterns: [/\/2-integration\//, /\/3-integration\//],
    allowedImports: ['kernel', 'infrastructure', 'integration', 'shared', 'types'],
  },
  {
    name: 'application',
    patterns: [/\/3-application\//, /\/4-application\//],
    allowedImports: ['kernel', 'infrastructure', 'integration', 'application', 'shared', 'types'],
  },
  {
    name: 'delivery',
    patterns: [/\/4-delivery\//, /\/5-delivery\//],
    allowedImports: ['kernel', 'infrastructure', 'integration', 'application', 'delivery', 'shared', 'types'],
  },
  {
    name: 'shared',
    patterns: [/\/(shared|common|utils)\//, /\/_shared\//],
    allowedImports: ['shared', 'types'],
  },
];

// ============================================================================
// Scoring Functions - GAP-24 to GAP-28 Implementation
// ============================================================================

/**
 * GAP-25: Calculate architecture adherence score
 * Detects layer violation patterns using import analysis
 * @param basePath - Path to the domain/module to analyze
 * @returns Score from 0-100
 */
export function calculateArchitectureAdherence(basePath: string): number {
  if (!existsSync(basePath)) {
    return 50; // Neutral score if path doesn't exist
  }

  const sourceFiles = findSourceFiles(basePath);
  if (sourceFiles.length === 0) {
    return 50;
  }

  let totalViolations = 0;
  let totalImports = 0;

  for (const file of sourceFiles) {
    const content = readFileContent(file);
    if (!content) continue;

    const fileLayer = detectLayer(file);
    const imports = extractImports(content, file);

    totalImports += imports.length;

    for (const imp of imports) {
      const importedLayer = detectLayerFromImport(imp, basePath);
      if (importedLayer && fileLayer && !isImportAllowed(fileLayer, importedLayer)) {
        totalViolations++;
      }
    }
  }

  if (totalImports === 0) {
    return 70; // Base score if no imports found
  }

  // Calculate score: 100 - (violation rate * 100)
  const violationRate = totalViolations / totalImports;
  const score = Math.max(0, Math.min(100, Math.round(100 - violationRate * 100)));

  return score;
}

/**
 * GAP-26: Calculate test coverage score
 * Analyzes test file presence and test-to-code ratio
 * @param basePath - Path to the domain/module to analyze
 * @returns Score from 0-100
 */
export function calculateTestCoverage(basePath: string): number {
  if (!existsSync(basePath)) {
    return 0;
  }

  const sourceFiles = findSourceFiles(basePath);
  const testFiles = findTestFiles(basePath);

  if (sourceFiles.length === 0) {
    return 0;
  }

  // Calculate test-to-code ratio
  const sourceLines = countTotalLines(sourceFiles);
  const testLines = countTotalLines(testFiles);

  // Score based on test file ratio (aim for 1:1 ratio = 100 points)
  const fileRatio = testFiles.length / sourceFiles.length;
  const fileScore = Math.min(50, fileRatio * 50);

  // Score based on lines ratio (aim for 1:1 test-to-code ratio)
  const lineRatio = sourceLines > 0 ? testLines / sourceLines : 0;
  const lineScore = Math.min(50, lineRatio * 50);

  // Bonus for having test configuration
  const configBonus = hasTestConfig(basePath) ? 10 : 0;

  return Math.min(100, Math.round(fileScore + lineScore + configBonus));
}

/**
 * GAP-27: Calculate observability score
 * Detects logging frameworks, tracing, and metrics collection
 * @param basePath - Path to the domain/module to analyze
 * @returns Score from 0-100
 */
export function calculateObservability(basePath: string): number {
  if (!existsSync(basePath)) {
    return 0;
  }

  const sourceFiles = findSourceFiles(basePath);
  if (sourceFiles.length === 0) {
    return 0;
  }

  let hasLogging = false;
  let hasTracing = false;
  let hasMetrics = false;
  let structuredLoggingScore = 0;
  let logCoverage = 0;

  const loggingFrameworks = [
    'winston', 'pino', 'bunyan', 'log4js', 'morgan',
    'consola', 'signale', 'tracer', 'npmlog'
  ];

  const tracingFrameworks = [
    '@opentelemetry', 'jaeger-client', 'zipkin',
    'dd-trace', 'aws-xray-sdk', 'honeycomb-beeline'
  ];

  const metricsFrameworks = [
    'prom-client', 'statsd-client', 'node-statsd',
    '@opentelemetry/metrics', 'datadog-metrics'
  ];

  const logPatterns = [
    /console\.(log|info|warn|error|debug)\(/g,
    /logger\.(info|warn|error|debug|trace)\(/g,
    /log\.(info|warn|error|debug)\(/g,
  ];

  let filesWithLogging = 0;
  let totalLogStatements = 0;

  for (const file of sourceFiles) {
    const content = readFileContent(file);
    if (!content) continue;

    // Check for logging frameworks
    for (const framework of loggingFrameworks) {
      if (content.includes(`'${framework}'`) || content.includes(`"${framework}"`) || content.includes(`require('${framework}')`)) {
        hasLogging = true;
        structuredLoggingScore += 25;
      }
    }

    // Check for tracing frameworks
    for (const framework of tracingFrameworks) {
      if (content.includes(`'${framework}'`) || content.includes(`"${framework}"`) || content.includes(`require('${framework}')`)) {
        hasTracing = true;
      }
    }

    // Check for metrics frameworks
    for (const framework of metricsFrameworks) {
      if (content.includes(`'${framework}'`) || content.includes(`"${framework}"`) || content.includes(`require('${framework}')`)) {
        hasMetrics = true;
      }
    }

    // Count log statements
    let fileHasLogging = false;
    for (const pattern of logPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalLogStatements += matches.length;
        fileHasLogging = true;
      }
    }
    if (fileHasLogging) filesWithLogging++;
  }

  // Calculate log coverage (files with logging / total files)
  logCoverage = Math.round((filesWithLogging / sourceFiles.length) * 100);

  // Structured logging score (cap at 50)
  structuredLoggingScore = Math.min(50, structuredLoggingScore);

  // Component scores
  const loggingScore = hasLogging ? 25 : Math.min(15, logCoverage / 4);
  const tracingScore = hasTracing ? 25 : 0;
  const metricsScore = hasMetrics ? 25 : 0;

  // Additional score for log coverage
  const coverageScore = Math.min(25, logCoverage / 4);

  return Math.min(100, loggingScore + tracingScore + metricsScore + coverageScore + structuredLoggingScore);
}

/**
 * GAP-28: Calculate drift frequency score
 * Tracks spec drift by analyzing spec files vs implementation
 * @param basePath - Path to the domain/module to analyze
 * @param specPath - Path to the spec files
 * @returns Score from 0-100 (higher = less drift)
 */
export function calculateDriftFrequency(basePath: string, specPath?: string): number {
  if (!existsSync(basePath)) {
    return 50;
  }

  // Find spec files
  const specsDir = specPath || join(basePath, '..', '..', 'spec');
  const specFiles = existsSync(specsDir) ? findSpecFiles(specsDir) : [];

  const sourceFiles = findSourceFiles(basePath);

  if (specFiles.length === 0 && sourceFiles.length === 0) {
    return 50;
  }

  // Calculate spec coverage (specs per source file)
  const specCoverage = sourceFiles.length > 0 ? specFiles.length / sourceFiles.length : 0;

  // Analyze spec freshness (check if specs have recent updates)
  const specFreshness = calculateSpecFreshness(specFiles, sourceFiles);

  // Calculate drift rate based on implementation changes without spec updates
  const driftRate = calculateDriftRate(sourceFiles, specFiles);

  // Score formula: higher coverage and freshness = better score
  const coverageScore = Math.min(40, specCoverage * 40);
  const freshnessScore = specFreshness * 30;
  const driftScore = Math.max(0, 30 - driftRate * 30);

  return Math.round(coverageScore + freshnessScore + driftScore);
}

/**
 * Calculate boundary enforcement score
 * Detects boundary violations between domains
 * @param basePath - Path to the domain/module to analyze
 * @returns Score from 0-100
 */
export function calculateBoundaryEnforcement(basePath: string): number {
  if (!existsSync(basePath)) {
    return 50;
  }

  const sourceFiles = findSourceFiles(basePath);
  if (sourceFiles.length === 0) {
    return 50;
  }

  const domainName = getDomainName(basePath);
  let boundaryViolations = 0;
  let totalExternalImports = 0;

  // Get allowed dependencies from package.json or config
  const allowedDeps = getAllowedDependencies(basePath);

  for (const file of sourceFiles) {
    const content = readFileContent(file);
    if (!content) continue;

    const imports = extractImports(content, file);

    for (const imp of imports) {
      // Check if import crosses domain boundaries
      const importedDomain = extractDomainFromImport(imp);
      if (importedDomain && importedDomain !== domainName) {
        totalExternalImports++;
        if (!allowedDeps.includes(importedDomain)) {
          boundaryViolations++;
        }
      }
    }
  }

  if (totalExternalImports === 0) {
    return 70; // Base score if no external imports
  }

  const violationRate = boundaryViolations / totalExternalImports;
  return Math.max(0, Math.min(100, Math.round(100 - violationRate * 100)));
}

// ============================================================================
// GAP-24: CategoryScores calculation with real metrics
// ============================================================================

/**
 * GAP-24: Calculate all category scores for a domain
 * @param domainPath - Path to the domain directory
 * @param specPath - Optional path to spec files
 * @returns Complete category scores
 */
export function calculateCategoryScores(
  domainPath: string,
  specPath?: string
): CategoryScores {
  return {
    architectureAdherence: calculateArchitectureAdherence(domainPath),
    testCoverage: calculateTestCoverage(domainPath),
    observability: calculateObservability(domainPath),
    boundaryEnforcement: calculateBoundaryEnforcement(domainPath),
    driftFrequency: calculateDriftFrequency(domainPath, specPath),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function findSourceFiles(dir: string, extensions = ['.ts', '.js', '.tsx', '.jsx']): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory() && !isExcludedDir(entry.name)) {
        traverse(fullPath);
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        // Exclude test files from source files
        if (!isTestFile(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  const testPatterns = ['.test.ts', '.test.js', '.spec.ts', '.spec.js', '_test.ts', '_test.js'];

  function traverse(currentDir: string) {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory() && !isExcludedDir(entry.name)) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        if (testPatterns.some(pattern => entry.name.endsWith(pattern)) ||
            entry.name.includes('.test.') ||
            entry.name.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

function findSpecFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function isExcludedDir(name: string): boolean {
  const excluded = ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.tmp'];
  return excluded.includes(name) || name.startsWith('.');
}

function isTestFile(name: string): boolean {
  return name.includes('.test.') || name.includes('.spec.') || 
         name.includes('_test.') || name.includes('_spec.');
}

function readFileContent(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];

  // ES6 imports
  const es6Pattern = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6Pattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // CommonJS requires
  const cjsPattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic imports
  const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function detectLayer(filePath: string): string | null {
  for (const layer of ARCHITECTURE_LAYERS) {
    for (const pattern of layer.patterns) {
      if (pattern.test(filePath)) {
        return layer.name;
      }
    }
  }
  return null;
}

function detectLayerFromImport(importPath: string, basePath: string): string | null {
  for (const layer of ARCHITECTURE_LAYERS) {
    for (const pattern of layer.patterns) {
      if (pattern.test(importPath) || pattern.test(join(basePath, importPath))) {
        return layer.name;
      }
    }
  }
  return null;
}

function isImportAllowed(fileLayer: string, importedLayer: string): boolean {
  const layer = ARCHITECTURE_LAYERS.find(l => l.name === fileLayer);
  if (!layer) return true;
  return layer.allowedImports.includes(importedLayer) || fileLayer === importedLayer;
}

function countTotalLines(files: string[]): number {
  let total = 0;
  for (const file of files) {
    const content = readFileContent(file);
    if (content) {
      total += content.split('\n').length;
    }
  }
  return total;
}

function hasTestConfig(basePath: string): boolean {
  const configFiles = ['jest.config.js', 'vitest.config.ts', 'playwright.config.ts', 'mocha.opts', '.mocharc.json'];
  const parentDir = dirname(basePath);

  for (const config of configFiles) {
    if (existsSync(join(basePath, config)) || existsSync(join(parentDir, config))) {
      return true;
    }
  }
  return false;
}

function calculateSpecFreshness(specFiles: string[], sourceFiles: string[]): number {
  if (specFiles.length === 0 || sourceFiles.length === 0) {
    return 0;
  }

  let totalFreshness = 0;
  let checkedPairs = 0;

  // Get last modified times
  const specAges = specFiles.map(f => {
    try {
      return statSync(f).mtime.getTime();
    } catch {
      return Date.now();
    }
  });

  const sourceAges = sourceFiles.map(f => {
    try {
      return statSync(f).mtime.getTime();
    } catch {
      return Date.now();
    }
  });

  const avgSpecAge = specAges.reduce((a, b) => a + b, 0) / specAges.length;
  const avgSourceAge = sourceAges.reduce((a, b) => a + b, 0) / sourceAges.length;

  // If specs are newer or close to source age, they're fresh
  const ageDiff = avgSpecAge - avgSourceAge;
  if (ageDiff > 0) {
    return 1; // Specs are newer than source
  } else if (ageDiff > -7 * 24 * 60 * 60 * 1000) {
    return 0.8; // Specs within a week
  } else if (ageDiff > -30 * 24 * 60 * 60 * 1000) {
    return 0.5; // Specs within a month
  } else {
    return 0.2; // Old specs
  }
}

function calculateDriftRate(sourceFiles: string[], specFiles: string[]): number {
  if (specFiles.length === 0) {
    return sourceFiles.length > 0 ? 1 : 0;
  }

  // Calculate ratio of implementation to spec coverage
  const expectedSpecs = Math.ceil(sourceFiles.length / 5); // Assume 1 spec per 5 source files
  const actualSpecs = specFiles.length;

  if (actualSpecs >= expectedSpecs) {
    return 0;
  }

  return Math.min(1, (expectedSpecs - actualSpecs) / expectedSpecs);
}

function getDomainName(basePath: string): string {
  const parts = basePath.split(/[\/\\]/);
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown';
}

function extractDomainFromImport(importPath: string): string | null {
  // Extract domain from import path patterns like '@a2r/domain-name' or '../domain-name/...'
  const patterns = [
    /@a2r\/([^\/]+)/,
    /\.{1,2}\/([^\/]+)/,
    /\/([^\/]+)\/src/
  ];

  for (const pattern of patterns) {
    const match = importPath.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function getAllowedDependencies(basePath: string): string[] {
  try {
    const packageJsonPath = join(basePath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = Object.keys(pkg.dependencies || {});
      // Extract domain names from @a2r/* packages
      return deps
        .filter((d: string) => d.startsWith('@a2r/'))
        .map((d: string) => d.replace('@a2r/', ''));
    }
  } catch {
    // Ignore errors
  }
  return [];
}

// ============================================================================
// Quality Score Engine - GAP-29: History Tracking
// ============================================================================

export interface QualityScoreEngineOptions {
  historyStorage?: 'memory' | 'file';
  historyFilePath?: string;
  maxHistoryEntries?: number;
}

export class QualityScoreEngine {
  private scores: Map<string, QualityMetrics>;
  private history: Map<string, ScoreHistory[]>;
  private options: QualityScoreEngineOptions;

  constructor(options: QualityScoreEngineOptions = {}) {
    this.scores = new Map();
    this.history = new Map();
    this.options = {
      historyStorage: 'memory',
      maxHistoryEntries: 30,
      ...options,
    };

    // GAP-29: Load history from file if configured
    if (this.options.historyStorage === 'file' && this.options.historyFilePath) {
      this.loadHistoryFromFile();
    }
  }

  /**
   * GAP-24: Calculate overall score from category scores
   */
  calculateScore(categories: CategoryScores): number {
    return Math.round(
      categories.architectureAdherence * CATEGORY_WEIGHTS.architectureAdherence +
      categories.testCoverage * CATEGORY_WEIGHTS.testCoverage +
      categories.observability * CATEGORY_WEIGHTS.observability +
      categories.boundaryEnforcement * CATEGORY_WEIGHTS.boundaryEnforcement +
      categories.driftFrequency * CATEGORY_WEIGHTS.driftFrequency
    );
  }

  /**
   * Convert score to grade
   */
  scoreToGrade(score: number): Grade {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * GAP-29: Enhanced update score with history tracking
   */
  updateScore(domain: string, categories: CategoryScores): QualityMetrics {
    const score = this.calculateScore(categories);
    const grade = this.scoreToGrade(score);

    const existing = this.scores.get(domain);
    const trend = this.calculateTrend(existing?.score, score);

    const metrics: QualityMetrics = {
      domain,
      grade,
      score,
      trend,
      topIssues: this.generateIssues(categories),
      history: this.getHistory(domain),
    };

    this.scores.set(domain, metrics);
    this.recordHistory(domain, score, categories);

    // GAP-29: Persist history if file storage is configured
    if (this.options.historyStorage === 'file' && this.options.historyFilePath) {
      this.saveHistoryToFile();
    }

    return metrics;
  }

  /**
   * GAP-24: Analyze domain and calculate all scores
   */
  analyzeDomain(domain: string, domainPath: string, specPath?: string): QualityMetrics {
    const categories = calculateCategoryScores(domainPath, specPath);
    return this.updateScore(domain, categories);
  }

  /**
   * Get metrics for domain
   */
  getMetrics(domain: string): QualityMetrics | null {
    return this.scores.get(domain) || null;
  }

  /**
   * Get all domain scores
   */
  getAllScores(): DomainScores {
    const result: DomainScores = {};
    for (const [domain, metrics] of this.scores) {
      result[domain] = metrics;
    }
    return result;
  }

  /**
   * GAP-29: Get score history with trend calculation
   */
  getHistory(domain: string): ScoreHistory[] {
    return this.history.get(domain) || [];
  }

  /**
   * GAP-29: Get trend analysis for a domain
   */
  getTrendAnalysis(domain: string): {
    direction: 'improving' | 'stable' | 'declining';
    changePercent: number;
    period: number;
  } {
    const history = this.getHistory(domain);
    if (history.length < 2) {
      return { direction: 'stable', changePercent: 0, period: 0 };
    }

    const recent = history.slice(-7); // Last 7 entries
    const oldest = recent[0].score;
    const newest = recent[recent.length - 1].score;
    const change = newest - oldest;
    const changePercent = oldest > 0 ? (change / oldest) * 100 : 0;

    let direction: 'improving' | 'stable' | 'declining';
    if (change > 5) {
      direction = 'improving';
    } else if (change < -5) {
      direction = 'declining';
    } else {
      direction = 'stable';
    }

    return {
      direction,
      changePercent: Math.abs(changePercent),
      period: recent.length,
    };
  }

  /**
   * GAP-29: Export all history data
   */
  exportHistory(): Record<string, ScoreHistory[]> {
    const result: Record<string, ScoreHistory[]> = {};
    for (const [domain, history] of this.history) {
      result[domain] = history;
    }
    return result;
  }

  /**
   * GAP-29: Import history data
   */
  importHistory(data: Record<string, ScoreHistory[]>): void {
    for (const [domain, history] of Object.entries(data)) {
      this.history.set(domain, history);
    }
  }

  private calculateTrend(previous: number | undefined, current: number): 'up' | 'down' | 'stable' {
    if (previous === undefined) return 'stable';
    const diff = current - previous;
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'stable';
  }

  private generateIssues(categories: CategoryScores): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (categories.architectureAdherence < 70) {
      issues.push({
        category: 'architecture',
        severity: 'high',
        description: 'Architecture adherence below threshold (<' + categories.architectureAdherence + '%)',
        fix: 'Review layer violations and fix dependency direction',
        impact: 10,
      });
    }

    if (categories.testCoverage < 80) {
      issues.push({
        category: 'testing',
        severity: 'medium',
        description: `Test coverage below 80% (${categories.testCoverage}%)`,
        fix: 'Add unit tests for uncovered modules',
        impact: 8,
      });
    }

    if (categories.observability < 70) {
      issues.push({
        category: 'observability',
        severity: 'medium',
        description: `Insufficient logging and tracing (${categories.observability}%)`,
        fix: 'Add structured logging and distributed tracing',
        impact: 6,
      });
    }

    if (categories.boundaryEnforcement < 70) {
      issues.push({
        category: 'boundaries',
        severity: 'medium',
        description: `Boundary enforcement weak (${categories.boundaryEnforcement}%)`,
        fix: 'Review cross-domain imports and enforce boundaries',
        impact: 7,
      });
    }

    if (categories.driftFrequency < 60) {
      issues.push({
        category: 'spec-drift',
        severity: 'low',
        description: `Spec drift detected (${categories.driftFrequency}%)`,
        fix: 'Update specifications to match implementation',
        impact: 5,
      });
    }

    return issues.sort((a, b) => b.impact - a.impact);
  }

  /**
   * GAP-29: Record history with category details
   */
  private recordHistory(domain: string, score: number, categories?: CategoryScores): void {
    const history = this.history.get(domain) || [];
    const previous = history.length > 0 ? history[history.length - 1].score : score;

    const entry: ScoreHistory = {
      date: new Date().toISOString(),
      score,
      change: score - previous,
    };

    if (categories) {
      entry.notes = `A:${categories.architectureAdherence} T:${categories.testCoverage} O:${categories.observability}`;
    }

    history.push(entry);

    // GAP-29: Keep max entries configurable
    const maxEntries = this.options.maxHistoryEntries || 30;
    if (history.length > maxEntries) {
      history.shift();
    }

    this.history.set(domain, history);
  }

  /**
   * GAP-29: Load history from file
   */
  private loadHistoryFromFile(): void {
    if (!this.options.historyFilePath) return;

    try {
      if (existsSync(this.options.historyFilePath)) {
        const content = readFileSync(this.options.historyFilePath, 'utf-8');
        const data = JSON.parse(content);
        this.importHistory(data);
      }
    } catch (error) {
      console.warn('Failed to load quality score history:', error);
    }
  }

  /**
   * GAP-29: Save history to file
   */
  private saveHistoryToFile(): void {
    if (!this.options.historyFilePath) return;

    try {
      const fs = require('fs');
      const data = this.exportHistory();
      fs.writeFileSync(this.options.historyFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save quality score history:', error);
    }
  }
}

// ============================================================================
// GC Integration
// ============================================================================

export interface GCReport {
  entropyScore: number;
  autoFixesApplied: number;
}

export interface QualityDelta {
  previousScore: number;
  newScore: number;
  change: number;
  contributor: string;
}

export class GCQualityIntegration {
  private qualityEngine: QualityScoreEngine;

  constructor(qualityEngine: QualityScoreEngine) {
    this.qualityEngine = qualityEngine;
  }

  async onGCComplete(domain: string, report: GCReport): Promise<QualityDelta> {
    const previousMetrics = this.qualityEngine.getMetrics(domain);
    const previousScore = previousMetrics?.score || 50;

    // Update score based on GC results
    const improvement = report.autoFixesApplied > 0 ? 2 : 0;
    const entropyPenalty = Math.floor(report.entropyScore / 10);
    const newScore = Math.min(100, Math.max(0, previousScore + improvement - entropyPenalty));

    // Calculate category adjustments based on GC report
    const currentMetrics = previousMetrics || {
      domain,
      grade: 'C' as Grade,
      score: 50,
      trend: 'stable' as const,
      topIssues: [],
      history: [],
    };

    // Derive categories from GC impact
    const categories: CategoryScores = {
      architectureAdherence: Math.max(0, Math.min(100, newScore + (report.autoFixesApplied * 2))),
      testCoverage: currentMetrics.score || 50,
      observability: currentMetrics.score || 50,
      boundaryEnforcement: Math.max(0, Math.min(100, newScore - entropyPenalty)),
      driftFrequency: Math.max(0, Math.min(100, 100 - report.entropyScore)),
    };

    this.qualityEngine.updateScore(domain, categories);

    return {
      previousScore,
      newScore,
      change: newScore - previousScore,
      contributor: 'gc-agents',
    };
  }
}

// ============================================================================
// Singleton Exports
// ============================================================================

export const qualityScoreEngine = new QualityScoreEngine();
export const gcQualityIntegration = new GCQualityIntegration(qualityScoreEngine);

// Scoring functions are already exported above, no need for duplicate exports
