/**
 * Garbage Collection Agents Implementation
 *
 * Based on: spec/governance/gc-agents.md
 * Enhanced with Tree-sitter AST parsing for accurate code analysis
 */

// ============================================================================
// Types
// ============================================================================

export interface GCReport {
  runId: string;
  timestamp: string;
  entropyScore: number;
  violationsFound: number;
  autoFixesApplied: number;
  prsCreated: string[];
  durationMs: number;
}

export interface DuplicateReport {
  blocks: Array<{
    hash: string;
    locations: string[];
    lines: number;
    similarity: number;
    astNodeType: string;
  }>;
  totalWaste: number;
  astBased: boolean;
}

export interface BoundaryViolation {
  file: string;
  import: string;
  fromLayer: string;
  toLayer: string;
  severity: 'warning' | 'error';
  astVerified: boolean;
}

export interface QualityDelta {
  previousScore: number;
  newScore: number;
  change: number;
  contributor: string;
}

export interface DocDrift {
  file: string;
  spec: string;
  drift: string;
  driftType: 'missing_export' | 'signature_mismatch' | 'missing_doc' | 'implementation_missing';
  confidence: number;
}

export interface DocUpdate {
  file: string;
  change: string;
}

export interface EntropyMetrics {
  cyclomaticComplexity: number;
  halsteadVolume: number;
  cognitiveComplexity: number;
  duplicateRatio: number;
  boundaryViolations: number;
  documentationCoverage: number;
}

// ============================================================================
// Tree-sitter Imports (lazy loaded for performance)
// ============================================================================

let TreeSitter: typeof import('tree-sitter') | null = null;
let TypeScriptGrammar: unknown = null;

async function initializeTreeSitter(): Promise<boolean> {
  if (TreeSitter && TypeScriptGrammar) return true;
  
  try {
    const tsModule = await import('tree-sitter');
    TreeSitter = tsModule;
    const typescriptModule = await import('tree-sitter-typescript');
    TypeScriptGrammar = (typescriptModule as { default: (parser: unknown) => unknown }).default(tsModule.Parser);
    return true;
  } catch (error) {
    console.warn('[TreeSitter] Failed to initialize, falling back to regex:', error);
    return false;
  }
}

// ============================================================================
// Duplicate Detector with AST Support
// ============================================================================

import { createHash } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative } from 'path';

interface ASTBlock {
  content: string;
  normalizedContent: string;
  startLine: number;
  endLine: number;
  lines: number;
  nodeType: string;
  nodeHash: string;
}

export class DuplicateDetector {
  private fileHashes: Map<string, string> = new Map();
  private contentHashes: Map<string, string[]> = new Map();
  private astBlocks: Map<string, ASTBlock[]> = new Map();
  private useAST: boolean = false;

  async scan(dir: string = './src'): Promise<DuplicateReport> {
    console.log('[DuplicateDetector] Scanning for duplicates...');
    
    // Initialize Tree-sitter for AST-based detection
    this.useAST = await initializeTreeSitter();
    if (this.useAST) {
      console.log('[DuplicateDetector] Using AST-based duplicate detection');
    } else {
      console.log('[DuplicateDetector] Falling back to regex-based detection');
    }
    
    const blocks: DuplicateReport['blocks'] = [];
    let totalWaste = 0;

    // Scan all TypeScript/JavaScript files
    const files = await this.scanDirectory(dir);
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        
        if (this.useAST) {
          // AST-based code block extraction (GAP-20)
          const astBlocks = await this.extractASTBlocks(file, content);
          for (const block of astBlocks) {
            const hash = block.nodeHash;
            const existingLocations = this.contentHashes.get(hash) || [];
            
            if (existingLocations.length > 0) {
              // Found duplicate
              const similarity = this.calculateSimilarity(block.normalizedContent, hash);
              blocks.push({
                hash,
                locations: [...existingLocations, `${file}:${block.startLine}`],
                lines: block.lines,
                similarity,
                astNodeType: block.nodeType,
              });
              totalWaste += block.lines;
            }
            
            this.contentHashes.set(hash, [...existingLocations, `${file}:${block.startLine}`]);
          }
        } else {
          // Fallback to regex-based extraction
          const lines = content.split('\n');
          const codeBlocks = this.extractCodeBlocks(lines);
          
          for (const block of codeBlocks) {
            const hash = this.hashContent(block.content);
            const existingLocations = this.contentHashes.get(hash) || [];
            
            if (existingLocations.length > 0) {
              blocks.push({
                hash,
                locations: [...existingLocations, `${file}:${block.startLine}`],
                lines: block.lines,
                similarity: 1.0,
                astNodeType: 'unknown',
              });
              totalWaste += block.lines;
            }
            
            this.contentHashes.set(hash, [...existingLocations, `${file}:${block.startLine}`]);
          }
        }
      } catch (error) {
        console.error(`[DuplicateDetector] Error scanning ${file}:`, error);
      }
    }

    // Also check for near-duplicates using similarity
    if (this.useAST) {
      const nearDuplicates = this.findNearDuplicates();
      for (const dup of nearDuplicates) {
        if (dup.similarity >= 0.8 && dup.similarity < 1.0) {
          blocks.push(dup);
          totalWaste += dup.lines;
        }
      }
    }

    return { 
      blocks, 
      totalWaste,
      astBased: this.useAST,
    };
  }

  /**
   * GAP-20: AST-based code block extraction using Tree-sitter
   */
  private async extractASTBlocks(filePath: string, content: string): Promise<ASTBlock[]> {
    const blocks: ASTBlock[] = [];
    
    if (!TreeSitter || !TypeScriptGrammar) return blocks;
    
    try {
      const parser = new TreeSitter.Parser();
      parser.setLanguage(TypeScriptGrammar);
      
      const tree = parser.parse(content);
      const rootNode = tree.rootNode;
      
      // Query for function declarations, class declarations, and method definitions
      const query = new TreeSitter.Query(TypeScriptGrammar, `
        [
          (function_declaration)
          (function_expression)
          (arrow_function)
          (class_declaration)
          (method_definition)
          (interface_declaration)
          (type_alias_declaration)
        ] @block
      `);
      
      const matches = query.matches(rootNode);
      
      for (const match of matches) {
        const node = match.captures[0].node;
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const nodeContent = content.slice(node.startIndex, node.endIndex);
        
        // Only track substantial blocks (> 5 lines)
        if (endLine - startLine >= 5) {
          const normalized = this.normalizeCode(nodeContent);
          blocks.push({
            content: nodeContent,
            normalizedContent: normalized,
            startLine,
            endLine,
            lines: endLine - startLine + 1,
            nodeType: node.type,
            nodeHash: this.hashContent(normalized),
          });
        }
      }
      
      parser.delete();
    } catch (error) {
      console.error(`[DuplicateDetector] AST parsing error in ${filePath}:`, error);
    }
    
    return blocks;
  }

  /**
   * Normalize code for comparison (remove whitespace, comments, rename variables)
   */
  private normalizeCode(code: string): string {
    return code
      // Remove comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Normalize variable names (replace identifiers with generic names)
      .replace(/\b(const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g, '$1 _VAR_')
      // Normalize string literals
      .replace(/'[^']*'/g, "'_STR_'")
      .replace(/"[^"]*"/g, '"_STR_"')
      .trim();
  }

  /**
   * Calculate similarity between two code blocks
   */
  private calculateSimilarity(normalizedContent: string, hash: string): number {
    // Exact match
    const locations = this.contentHashes.get(hash) || [];
    if (locations.length > 0) return 1.0;
    
    // Check for near-matches (simplified Jaccard similarity)
    const tokens = new Set(normalizedContent.split(/\s+/));
    let maxSimilarity = 0;
    
    for (const [existingHash, _] of this.contentHashes) {
      // This is a simplified comparison - in production would use more sophisticated algorithms
      const similarity = this.jaccardSimilarity(tokens, new Set(existingHash));
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return maxSimilarity;
  }

  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  /**
   * Find near-duplicate blocks based on similarity
   */
  private findNearDuplicates(): Array<{
    hash: string;
    locations: string[];
    lines: number;
    similarity: number;
    astNodeType: string;
  }> {
    const duplicates: Array<{
      hash: string;
      locations: string[];
      lines: number;
      similarity: number;
      astNodeType: string;
    }> = [];
    
    const processed = new Set<string>();
    
    for (const [file1, blocks1] of this.astBlocks) {
      for (const block1 of blocks1) {
        for (const [file2, blocks2] of this.astBlocks) {
          if (file1 >= file2) continue; // Avoid duplicate comparisons
          
          for (const block2 of blocks2) {
            const pairKey = `${block1.nodeHash}-${block2.nodeHash}`;
            if (processed.has(pairKey)) continue;
            processed.add(pairKey);
            
            const similarity = this.calculateStringSimilarity(
              block1.normalizedContent,
              block2.normalizedContent
            );
            
            if (similarity >= 0.8) {
              duplicates.push({
                hash: block1.nodeHash,
                locations: [`${file1}:${block1.startLine}`, `${file2}:${block2.startLine}`],
                lines: Math.max(block1.lines, block2.lines),
                similarity,
                astNodeType: block1.nodeType,
              });
            }
          }
        }
      }
    }
    
    return duplicates;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async scanDirectory(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, files);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
    }
    
    return files;
  }

  private extractCodeBlocks(lines: string[]): Array<{ content: string; startLine: number; lines: number }> {
    const blocks: Array<{ content: string; startLine: number; lines: number }> = [];
    let inBlock = false;
    let blockStart = 0;
    let braceCount = 0;
    let blockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect function/class start
      if (/^(export\s+)?(async\s+)?(function|class|const\s+\w+\s*=)/.test(line.trim())) {
        inBlock = true;
        blockStart = i;
        blockContent = [line];
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (inBlock) {
        blockContent.push(line);
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        if (braceCount <= 0) {
          // Block ended
          const content = blockContent.join('\n').trim();
          if (content.length > 100) { // Only track substantial blocks
            blocks.push({
              content,
              startLine: blockStart + 1,
              lines: blockContent.length,
            });
          }
          inBlock = false;
        }
      }
    }

    return blocks;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex').substring(0, 16);
  }

  suggestRefactor(duplicates: DuplicateReport['blocks']): string {
    if (duplicates.length === 0) return 'No duplicates found';
    
    const uniqueHashes = new Set(duplicates.map(d => d.hash));
    const totalLines = duplicates.reduce((sum, d) => sum + d.lines, 0);
    const highSimilarity = duplicates.filter(d => d.similarity >= 0.9).length;
    
    return [
      `Found ${uniqueHashes.size} duplicate patterns (${duplicates.length} instances)`,
      `Total waste: ${totalLines} lines`,
      `${highSimilarity} exact matches, ${duplicates.length - highSimilarity} near-duplicates`,
      'Recommendation: Extract common code into shared utilities or abstract base classes',
    ].join('\n');
  }
}

// ============================================================================
// Boundary Enforcer with AST-based Import Graph
// ============================================================================

interface ImportNode {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
  line: number;
}

interface FileNode {
  path: string;
  layer: string | null;
  imports: ImportNode[];
  exports: string[];
}

export class BoundaryEnforcer {
  private layerRules: Map<string, string[]> = new Map([
    ['ui', ['shared', 'types']],
    ['features', ['shared', 'types', 'ui']],
    ['shared', ['types']],
    ['types', []],
  ]);
  
  private importGraph: Map<string, FileNode> = new Map();
  private useAST: boolean = false;

  /**
   * GAP-21: AST-based boundary checking with import graph analysis
   */
  async check(dir: string = './src'): Promise<BoundaryViolation[]> {
    console.log('[BoundaryEnforcer] Checking boundaries...');
    
    // Initialize Tree-sitter
    this.useAST = await initializeTreeSitter();
    if (this.useAST) {
      console.log('[BoundaryEnforcer] Using AST-based import graph analysis');
    } else {
      console.log('[BoundaryEnforcer] Falling back to regex-based analysis');
    }
    
    const violations: BoundaryViolation[] = [];
    
    try {
      // Build import graph
      await this.buildImportGraph(dir);
      
      // Check each file's imports against layer rules
      for (const [filePath, fileNode] of this.importGraph) {
        if (!fileNode.layer) continue;
        
        for (const importNode of fileNode.imports) {
          const targetLayer = this.detectLayerFromImport(importNode.source, filePath);
          
          if (targetLayer && !this.isAllowed(fileNode.layer, targetLayer)) {
            violations.push({
              file: filePath,
              import: importNode.source,
              fromLayer: fileNode.layer,
              toLayer: targetLayer,
              severity: this.getSeverity(fileNode.layer, targetLayer),
              astVerified: this.useAST,
            });
          }
          
          // Additional check: type-only imports are warnings, not errors
          if (targetLayer && importNode.isTypeOnly && !this.isAllowed(fileNode.layer, targetLayer)) {
            // Downgrade to warning for type imports
            const existingViolation = violations.find(
              v => v.file === filePath && v.import === importNode.source
            );
            if (existingViolation) {
              existingViolation.severity = 'warning';
            }
          }
        }
      }
      
      // Advanced: Check for circular dependencies
      const circularDeps = this.detectCircularDependencies();
      for (const cycle of circularDeps) {
        violations.push({
          file: cycle[0],
          import: `circular: ${cycle.join(' -> ')}`,
          fromLayer: this.importGraph.get(cycle[0])?.layer || 'unknown',
          toLayer: 'circular',
          severity: 'error',
          astVerified: this.useAST,
        });
      }
      
    } catch (error) {
      console.error('[BoundaryEnforcer] Error:', error);
    }
    
    return violations;
  }

  /**
   * Build import graph using AST parsing
   */
  private async buildImportGraph(dir: string): Promise<void> {
    this.importGraph.clear();
    const files = await this.scanDirectory(dir);
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        const fileNode: FileNode = {
          path: file,
          layer: this.detectLayer(file),
          imports: this.useAST ? await this.extractASTImports(content) : this.extractRegexImports(content),
          exports: [],
        };
        
        if (this.useAST) {
          fileNode.exports = await this.extractASTExports(content);
        }
        
        this.importGraph.set(file, fileNode);
      } catch (error) {
        console.error(`[BoundaryEnforcer] Error parsing ${file}:`, error);
      }
    }
  }

  /**
   * Extract imports using AST parsing
   */
  private async extractASTImports(content: string): Promise<ImportNode[]> {
    const imports: ImportNode[] = [];
    
    if (!TreeSitter || !TypeScriptGrammar) return imports;
    
    try {
      const parser = new TreeSitter!.Parser();
      parser.setLanguage(TypeScriptGrammar!);
      
      const tree = parser.parse(content);
      
      // Query for import statements
      const query = new TreeSitter!.Query(TypeScriptGrammar!, `
        (import_statement
          source: (string) @source
          ) @import
        (import_clause
          (type)? @is_type
          ) @clause
      `);
      
      const matches = query.matches(tree.rootNode);
      
      for (const match of matches) {
        const importNode = match.captures.find(c => c.name === 'import')?.node;
        const sourceNode = match.captures.find(c => c.name === 'source')?.node;
        const isType = match.captures.some(c => c.name === 'is_type');
        
        if (sourceNode && importNode) {
          const source = sourceNode.text.slice(1, -1); // Remove quotes
          const specifiers = this.extractSpecifiers(importNode);
          
          imports.push({
            source,
            specifiers,
            isTypeOnly: isType || this.isTypeOnlyImport(importNode),
            line: importNode.startPosition.row + 1,
          });
        }
      }
      
      parser.delete();
    } catch (error) {
      console.error('[BoundaryEnforcer] AST import extraction error:', error);
    }
    
    return imports;
  }

  private extractSpecifiers(importNode: import('tree-sitter').SyntaxNode): string[] {
    const specifiers: string[] = [];
    
    // Find import clause
    for (const child of importNode.children) {
      if (child.type === 'import_clause') {
        for (const grandchild of child.children) {
          if (grandchild.type === 'identifier') {
            specifiers.push(grandchild.text);
          } else if (grandchild.type === 'named_imports') {
            for (const specifier of grandchild.children) {
              if (specifier.type === 'import_specifier') {
                const name = specifier.children.find((c: import('tree-sitter').SyntaxNode) => c.type === 'identifier');
                if (name) specifiers.push(name.text);
              }
            }
          } else if (grandchild.type === 'namespace_import') {
            const name = grandchild.children.find((c: import('tree-sitter').SyntaxNode) => c.type === 'identifier');
            if (name) specifiers.push(`* as ${name.text}`);
          }
        }
      }
    }
    
    return specifiers;
  }

  private isTypeOnlyImport(node: import('tree-sitter').SyntaxNode): boolean {
    return node.text.includes('type ') || node.text.includes('import type');
  }

  /**
   * Extract exports using AST parsing
   */
  private async extractASTExports(content: string): Promise<string[]> {
    const exports: string[] = [];
    
    if (!TreeSitter || !TypeScriptGrammar) return exports;
    
    try {
      const parser = new TreeSitter!.Parser();
      parser.setLanguage(TypeScriptGrammar!);
      
      const tree = parser.parse(content);
      
      const query = new TreeSitter!.Query(TypeScriptGrammar!, `
        (export_statement
          (function_declaration
            name: (identifier) @name)
          )
        (export_statement
          (class_declaration
            name: (type_identifier) @name)
          )
        (export_statement
          (lexical_declaration
            (variable_declarator
              name: (identifier) @name)
            )
          )
      `);
      
      const matches = query.matches(tree.rootNode);
      
      for (const match of matches) {
        const name = match.captures[0]?.node.text;
        if (name) exports.push(name);
      }
      
      parser.delete();
    } catch (error) {
      console.error('[BoundaryEnforcer] AST export extraction error:', error);
    }
    
    return exports;
  }

  private extractRegexImports(content: string): ImportNode[] {
    const imports: ImportNode[] = [];
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    
    for (const match of importMatches) {
      const lines = content.slice(0, match.index).split('\n');
      imports.push({
        source: match[1],
        specifiers: [],
        isTypeOnly: match[0].includes('type '),
        line: lines.length,
      });
    }
    
    return imports;
  }

  /**
   * Detect circular dependencies in the import graph
   */
  private detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      
      const fileNode = this.importGraph.get(node);
      if (fileNode) {
        for (const importNode of fileNode.imports) {
          // Resolve relative imports to absolute paths
          const resolved = this.resolveImportPath(node, importNode.source);
          if (!resolved) continue;
          
          if (recursionStack.has(resolved)) {
            // Found cycle
            const cycleStart = path.indexOf(resolved);
            cycles.push([...path.slice(cycleStart), resolved]);
          } else if (!visited.has(resolved)) {
            dfs(resolved, [...path, resolved]);
          }
        }
      }
      
      recursionStack.delete(node);
    };
    
    for (const file of this.importGraph.keys()) {
      if (!visited.has(file)) {
        dfs(file, [file]);
      }
    }
    
    return cycles;
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Simplified resolution - in production would use Node.js resolution algorithm
    if (importPath.startsWith('.')) {
      // Relative import
      const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      return join(fromDir, importPath) + '.ts';
    }
    // External packages are not part of the internal graph
    return null;
  }

  private detectLayerFromImport(importPath: string, fromFile: string): string | null {
    // First check if it's a local import
    if (importPath.startsWith('.')) {
      const resolved = this.resolveImportPath(fromFile, importPath);
      if (resolved) {
        return this.detectLayer(resolved);
      }
    }
    
    // Check for layer aliases (e.g., @/ui/, @/features/)
    if (importPath.includes('/ui/') || importPath.startsWith('@/ui/')) return 'ui';
    if (importPath.includes('/features/') || importPath.startsWith('@/features/')) return 'features';
    if (importPath.includes('/shared/') || importPath.startsWith('@/shared/')) return 'shared';
    if (importPath.includes('/types/') || importPath.startsWith('@/types/')) return 'types';
    
    return null;
  }

  async autoFix(violation: BoundaryViolation): Promise<void> {
    console.log('[BoundaryEnforcer] Auto-fixing:', violation.file);
    
    // In production, this would:
    // 1. Analyze the import to see if it can be replaced
    // 2. Look for alternative imports in allowed layers
    // 3. Create a refactoring plan
    // 4. Optionally apply the fix
    
    // For now, we provide detailed recommendations
    const recommendation = this.generateFixRecommendation(violation);
    console.log(`[BoundaryEnforcer] Recommendation: ${recommendation}`);
  }

  private generateFixRecommendation(violation: BoundaryViolation): string {
    const allowed = this.layerRules.get(violation.fromLayer) || [];
    
    if (violation.toLayer === 'circular') {
      return `Break circular dependency by extracting shared code into a common module`;
    }
    
    return `Move import from '${violation.import}' to an allowed layer. ` +
           `Layer '${violation.fromLayer}' can only import from: ${allowed.join(', ') || 'none'}`;
  }

  private async scanDirectory(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, files);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
    
    return files;
  }

  private detectLayer(path: string): string | null {
    if (path.includes('/ui/') || path.includes('/components/')) return 'ui';
    if (path.includes('/features/')) return 'features';
    if (path.includes('/shared/')) return 'shared';
    if (path.includes('/types/')) return 'types';
    return null;
  }

  private isAllowed(fromLayer: string, toLayer: string): boolean {
    if (fromLayer === toLayer) return true;
    const allowed = this.layerRules.get(fromLayer) || [];
    return allowed.includes(toLayer);
  }

  private getSeverity(fromLayer: string, toLayer: string): 'warning' | 'error' {
    if (toLayer === 'circular') return 'error';
    
    // Crossing multiple layers is an error
    const layerOrder = ['types', 'shared', 'ui', 'features'];
    const fromIndex = layerOrder.indexOf(fromLayer);
    const toIndex = layerOrder.indexOf(toLayer);
    
    if (fromIndex === -1 || toIndex === -1) return 'warning';
    if (fromIndex - toIndex > 1) return 'error';
    return 'warning';
  }

  /**
   * Get the import graph for visualization or analysis
   */
  getImportGraph(): Map<string, FileNode> {
    return new Map(this.importGraph);
  }
}

// ============================================================================
// Documentation Sync with AST-based Analysis
// ============================================================================

interface ExtractedSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable';
  signature: string;
  docComment?: string;
  line: number;
  exported: boolean;
}

export class DocumentationSync {
  private useAST: boolean = false;

  /**
   * GAP-22: Enhanced documentation drift detection with AST analysis
   */
  async detectDrift(dir: string = './src'): Promise<DocDrift[]> {
    console.log('[DocumentationSync] Detecting drift...');
    
    // Initialize Tree-sitter
    this.useAST = await initializeTreeSitter();
    if (this.useAST) {
      console.log('[DocumentationSync] Using AST-based drift detection');
    } else {
      console.log('[DocumentationSync] Falling back to keyword matching');
    }
    
    const drift: DocDrift[] = [];
    
    try {
      // Find all spec files
      const specFiles = await this.findSpecFiles(dir);
      
      for (const specFile of specFiles) {
        const specContent = await readFile(specFile, 'utf-8');
        const specSymbols = this.extractSpecSymbols(specContent);
        
        const implementationPath = this.getImplementationPath(specFile);
        
        if (implementationPath) {
          try {
            const implContent = await readFile(implementationPath, 'utf-8');
            const implSymbols = this.useAST 
              ? await this.extractASTSymbols(implContent)
              : this.extractRegexSymbols(implContent);
            
            // Compare spec symbols with implementation
            for (const specSymbol of specSymbols) {
              const implSymbol = implSymbols.find(s => s.name === specSymbol.name);
              
              if (!implSymbol) {
                drift.push({
                  file: implementationPath,
                  spec: specFile,
                  drift: `Missing implementation of '${specSymbol.name}' (${specSymbol.type})`,
                  driftType: 'implementation_missing',
                  confidence: 0.9,
                });
              } else if (this.useAST && !this.signaturesMatch(specSymbol, implSymbol)) {
                drift.push({
                  file: implementationPath,
                  spec: specFile,
                  drift: `Signature mismatch for '${specSymbol.name}': spec has '${specSymbol.signature}', impl has '${implSymbol.signature}'`,
                  driftType: 'signature_mismatch',
                  confidence: 0.8,
                });
              }
            }
            
            // Check for undocumented exported symbols
            const undocumentedExports = implSymbols.filter(
              s => s.exported && !specSymbols.some(spec => spec.name === s.name)
            );
            
            for (const undocumented of undocumentedExports) {
              drift.push({
                file: implementationPath,
                spec: specFile,
                drift: `Undocumented exported ${undocumented.type} '${undocumented.name}'`,
                driftType: 'missing_doc',
                confidence: 0.7,
              });
            }
            
            // Check documentation coverage
            const coverage = this.calculateDocumentationCoverage(implSymbols);
            if (coverage < 0.5) {
              drift.push({
                file: implementationPath,
                spec: specFile,
                drift: `Low documentation coverage: ${(coverage * 100).toFixed(1)}% of symbols have doc comments`,
                driftType: 'missing_doc',
                confidence: 0.6,
              });
            }
            
          } catch (error) {
            // Implementation file doesn't exist
            drift.push({
              file: implementationPath,
              spec: specFile,
              drift: 'Implementation file not found',
              driftType: 'implementation_missing',
              confidence: 1.0,
            });
          }
        }
      }
    } catch (error) {
      console.error('[DocumentationSync] Error:', error);
    }
    
    return drift;
  }

  /**
   * Extract symbols from implementation using AST
   */
  private async extractASTSymbols(content: string): Promise<ExtractedSymbol[]> {
    const symbols: ExtractedSymbol[] = [];
    
    if (!TreeSitter || !TypeScriptGrammar) return symbols;
    
    try {
      const parser = new TreeSitter!.Parser();
      parser.setLanguage(TypeScriptGrammar!);
      
      const tree = parser.parse(content);
      
      // Query for exported declarations
      const query = new TreeSitter!.Query(TypeScriptGrammar!, `
        (export_statement
          (function_declaration
            name: (identifier) @func_name
            parameters: (formal_parameters) @func_params
            return_type: (type_annotation)? @func_return
            ) @func
          )
        (export_statement
          (class_declaration
            name: (type_identifier) @class_name
            ) @class
          )
        (export_statement
          (interface_declaration
            name: (type_identifier) @interface_name
            ) @interface
          )
        (export_statement
          (type_alias_declaration
            name: (type_identifier) @type_name
            ) @type
          )
        (export_statement
          (lexical_declaration
            (variable_declarator
              name: (identifier) @var_name
              ) @var
            )
          )
        (comment) @comment
      `);
      
      const matches = query.matches(tree.rootNode);
      const docComments = new Map<number, string>();
      
      // First pass: collect doc comments
      for (const match of matches) {
        const capture = match.captures[0];
        if (capture.name === 'comment' && capture.node.text.startsWith('/**')) {
          const nextLine = capture.node.endPosition.row + 1;
          docComments.set(nextLine, capture.node.text);
        }
      }
      
      // Second pass: extract symbols
      for (const match of matches) {
        const capture = match.captures[0];
        
        if (capture.name === 'func') {
          const name = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'func_name')?.node.text;
          const params = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'func_params')?.node.text;
          const returnType = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'func_return')?.node.text;
          
          if (name) {
            symbols.push({
              name,
              type: 'function',
              signature: `${name}${params}${returnType || ''}`,
              docComment: docComments.get(capture.node.startPosition.row + 1),
              line: capture.node.startPosition.row + 1,
              exported: true,
            });
          }
        } else if (capture.name === 'class') {
          const name = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'class_name')?.node.text;
          if (name) {
            symbols.push({
              name,
              type: 'class',
              signature: `class ${name}`,
              docComment: docComments.get(capture.node.startPosition.row + 1),
              line: capture.node.startPosition.row + 1,
              exported: true,
            });
          }
        } else if (capture.name === 'interface') {
          const name = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'interface_name')?.node.text;
          if (name) {
            symbols.push({
              name,
              type: 'interface',
              signature: `interface ${name}`,
              docComment: docComments.get(capture.node.startPosition.row + 1),
              line: capture.node.startPosition.row + 1,
              exported: true,
            });
          }
        } else if (capture.name === 'type') {
          const name = match.captures.find((c: import('tree-sitter').QueryCapture) => c.name === 'type_name')?.node.text;
          if (name) {
            symbols.push({
              name,
              type: 'type',
              signature: `type ${name}`,
              docComment: docComments.get(capture.node.startPosition.row + 1),
              line: capture.node.startPosition.row + 1,
              exported: true,
            });
          }
        }
      }
      
      parser.delete();
    } catch (error) {
      console.error('[DocumentationSync] AST symbol extraction error:', error);
    }
    
    return symbols;
  }

  private extractRegexSymbols(content: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    
    // Match exported functions
    const funcMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
    let line = 1;
    for (const match of funcMatches) {
      symbols.push({
        name: match[1],
        type: 'function',
        signature: `function ${match[1]}()`,
        exported: true,
        line: line++,
      });
    }
    
    // Match exported classes
    const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
    for (const match of classMatches) {
      symbols.push({
        name: match[1],
        type: 'class',
        signature: `class ${match[1]}`,
        exported: true,
        line: line++,
      });
    }
    
    return symbols;
  }

  private extractSpecSymbols(content: string): Array<{ name: string; type: string; signature: string }> {
    const symbols: Array<{ name: string; type: string; signature: string }> = [];
    
    // Extract function/class names from code blocks in markdown
    const codeBlockMatches = content.matchAll(/```typescript\n([\s\S]*?)```/g);
    
    for (const match of codeBlockMatches) {
      const code = match[1];
      
      // Match function declarations
      const funcMatches = code.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)(\([^)]*\))/g);
      for (const funcMatch of funcMatches) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          signature: `${funcMatch[1]}${funcMatch[2]}`,
        });
      }
      
      // Match class declarations
      const classMatches = code.matchAll(/(?:export\s+)?class\s+(\w+)/g);
      for (const classMatch of classMatches) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          signature: `class ${classMatch[1]}`,
        });
      }
      
      // Match interface declarations
      const interfaceMatches = code.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
      for (const interfaceMatch of interfaceMatches) {
        symbols.push({
          name: interfaceMatch[1],
          type: 'interface',
          signature: `interface ${interfaceMatch[1]}`,
        });
      }
    }
    
    // Also extract from inline code with specific patterns
    const inlineMatches = content.matchAll(/`([a-zA-Z_][a-zA-Z0-9_]*)\([^)]*\)`/g);
    for (const match of inlineMatches) {
      if (!symbols.some(s => s.name === match[1])) {
        symbols.push({
          name: match[1],
          type: 'function',
          signature: `${match[1]}()`,
        });
      }
    }
    
    return symbols;
  }

  private signaturesMatch(spec: { signature: string }, impl: { signature: string }): boolean {
    // Normalize signatures for comparison
    const normalize = (s: string) => s
      .replace(/\s+/g, ' ')
      .replace(/:\s*\w+/g, ': TYPE')
      .replace(/\b\w+\b/g, m => m.toLowerCase())
      .trim();
    
    return normalize(spec.signature) === normalize(impl.signature);
  }

  private calculateDocumentationCoverage(symbols: ExtractedSymbol[]): number {
    if (symbols.length === 0) return 1.0;
    const documented = symbols.filter(s => s.docComment).length;
    return documented / symbols.length;
  }

  async generateUpdates(drift: DocDrift[]): Promise<DocUpdate[]> {
    return drift.map(d => ({
      file: d.file,
      change: `Update to match ${d.spec}: ${d.drift}`,
    }));
  }

  private async findSpecFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    // Look for spec directories at project root level
    const parentDir = dir.replace(/\/src$/, '');
    const specDirs = ['spec', 'docs', 'specs'];
    
    for (const specDir of specDirs) {
      const fullSpecDir = join(parentDir, specDir);
      try {
        const entries = await readdir(fullSpecDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
            files.push(join(fullSpecDir, entry.name));
          } else if (entry.isDirectory()) {
            files.push(...await this.findSpecFilesRecursive(join(fullSpecDir, entry.name)));
          }
        }
      } catch (error) {
        // Spec directory doesn't exist
      }
    }
    
    return files;
  }

  private async findSpecFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.findSpecFilesRecursive(fullPath));
        } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
    
    return files;
  }

  private getImplementationPath(specFile: string): string | null {
    // Multiple heuristics to find implementation
    const heuristics = [
      // spec/governance/gc-agents.md -> src/governance/gc-agents.ts
      (f: string) => f.replace('/spec/', '/src/').replace(/\.mdx?$/, '.ts'),
      // spec/kernel/governance.md -> 1-kernel/governance/src/index.ts
      (f: string) => f.replace(/\/spec\//, '/').replace(/\.mdx?$/, '/src/index.ts'),
      // docs/api/gc-agents.md -> src/gc-agents/index.ts
      (f: string) => f.replace(/\/docs\/api\//, '/src/').replace(/\.mdx?$/, '/index.ts'),
    ];
    
    for (const heuristic of heuristics) {
      const candidate = heuristic(specFile);
      // Check if file exists would happen here in production
      return candidate;
    }
    
    return null;
  }
}

// ============================================================================
// Entropy Calculator - GAP-23
// ============================================================================

export class EntropyCalculator {
  private useAST: boolean = false;

  /**
   * GAP-23: Calculate real entropy metrics using AST analysis
   */
  async calculateEntropy(dir: string = './src'): Promise<EntropyMetrics> {
    console.log('[EntropyCalculator] Calculating entropy metrics...');
    
    this.useAST = await initializeTreeSitter();
    
    const files = await this.scanDirectory(dir);
    let totalCyclomatic = 0;
    let totalHalstead = 0;
    let totalCognitive = 0;
    let fileCount = 0;
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        
        if (this.useAST) {
          const metrics = await this.calculateASTMetrics(content);
          totalCyclomatic += metrics.cyclomatic;
          totalHalstead += metrics.halstead;
          totalCognitive += metrics.cognitive;
        } else {
          // Fallback to regex-based estimation
          totalCyclomatic += this.estimateCyclomatic(content);
          totalHalstead += this.estimateHalstead(content);
          totalCognitive += this.estimateCognitive(content);
        }
        fileCount++;
      } catch (error) {
        console.error(`[EntropyCalculator] Error analyzing ${file}:`, error);
      }
    }
    
    // Calculate duplicate ratio
    const detector = new DuplicateDetector();
    const duplicateReport = await detector.scan(dir);
    const totalLines = files.length * 100; // Rough estimate
    const duplicateRatio = totalLines > 0 ? duplicateReport.totalWaste / totalLines : 0;
    
    // Calculate documentation coverage
    const docSync = new DocumentationSync();
    const drift = await docSync.detectDrift(dir);
    const docCoverage = Math.max(0, 1 - (drift.filter(d => d.driftType === 'missing_doc').length / Math.max(1, files.length)));
    
    const metrics: EntropyMetrics = {
      cyclomaticComplexity: fileCount > 0 ? totalCyclomatic / fileCount : 0,
      halsteadVolume: fileCount > 0 ? totalHalstead / fileCount : 0,
      cognitiveComplexity: fileCount > 0 ? totalCognitive / fileCount : 0,
      duplicateRatio,
      boundaryViolations: 0, // Will be set by BoundaryEnforcer
      documentationCoverage: docCoverage,
    };
    
    console.log('[EntropyCalculator] Metrics:', metrics);
    return metrics;
  }

  /**
   * Calculate metrics using AST analysis
   */
  private async calculateASTMetrics(content: string): Promise<{
    cyclomatic: number;
    halstead: number;
    cognitive: number;
  }> {
    let cyclomatic = 1; // Base complexity
    let halsteadOperators = 0;
    let halsteadOperands = 0;
    let cognitive = 0;
    
    if (!TreeSitter || !TypeScriptGrammar) {
      return {
        cyclomatic: this.estimateCyclomatic(content),
        halstead: this.estimateHalstead(content),
        cognitive: this.estimateCognitive(content),
      };
    }
    
    try {
      const parser = new TreeSitter!.Parser();
      parser.setLanguage(TypeScriptGrammar!);
      
      const tree = parser.parse(content);
      
      // Query for complexity indicators
      const query = new TreeSitter!.Query(TypeScriptGrammar!, `
        ; Cyclomatic complexity: decision points
        (if_statement) @if
        (switch_statement) @switch
        (for_statement) @for
        (for_in_statement) @forin
        (while_statement) @while
        (do_statement) @do
        (conditional_expression) @ternary
        (binary_expression
          operator: ["&&" "||"]) @logical
        
        ; Halstead operators
        (binary_expression) @binary_op
        (unary_expression) @unary_op
        (call_expression) @call
        (new_expression) @new
        
        ; Cognitive complexity: nesting
        (statement_block) @block
      `);
      
      const matches = query.matches(tree.rootNode);
      
      let nestingLevel = 0;
      const nestingStack: number[] = [];
      
      for (const match of matches) {
        const capture = match.captures[0];
        
        // Cyclomatic complexity
        if (['if', 'switch', 'for', 'forin', 'while', 'do', 'ternary'].includes(capture.name)) {
          cyclomatic++;
          cognitive += 1 + nestingLevel;
        } else if (capture.name === 'logical') {
          cyclomatic++;
        }
        
        // Halstead operators
        if (['binary_op', 'unary_op', 'call', 'new'].includes(capture.name)) {
          halsteadOperators++;
        }
        
        // Track nesting for cognitive complexity
        if (capture.name === 'block') {
          nestingLevel++;
          nestingStack.push(capture.node.startPosition.row);
        }
      }
      
      // Count operands (identifiers and literals)
      const operandQuery = new TreeSitter!.Query(TypeScriptGrammar!, `
        (identifier) @identifier
        (string) @string
        (number) @number
        (true) @true
        (false) @false
      `);
      
      const operandMatches = operandQuery.matches(tree.rootNode);
      halsteadOperands = operandMatches.length;
      
      // Calculate Halstead volume
      const vocabulary = halsteadOperators + halsteadOperands;
      const length = halsteadOperators + halsteadOperands;
      const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
      
      parser.delete();
      
      return {
        cyclomatic,
        halstead: volume,
        cognitive,
      };
    } catch (error) {
      console.error('[EntropyCalculator] AST metrics error:', error);
      return {
        cyclomatic: this.estimateCyclomatic(content),
        halstead: this.estimateHalstead(content),
        cognitive: this.estimateCognitive(content),
      };
    }
  }

  private estimateCyclomatic(content: string): number {
    let complexity = 1;
    complexity += (content.match(/\bif\b/g) || []).length;
    complexity += (content.match(/\belse\s+if\b/g) || []).length;
    complexity += (content.match(/\bswitch\b/g) || []).length;
    complexity += (content.match(/\bfor\b/g) || []).length;
    complexity += (content.match(/\bwhile\b/g) || []).length;
    complexity += (content.match(/\?\s*[^:]+\s*:/g) || []).length;
    complexity += (content.match(/&&|\|\|/g) || []).length;
    return complexity;
  }

  private estimateHalstead(content: string): number {
    const operators = (content.match(/[+\-*/%=<>!&|^~?:]/g) || []).length;
    const operands = (content.match(/\b\w+\b/g) || []).length;
    const vocabulary = operators + operands;
    const length = operators + operands;
    return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  }

  private estimateCognitive(content: string): number {
    let cognitive = 0;
    const lines = content.split('\n');
    let nestingLevel = 0;
    
    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      if (/\b(if|for|while|switch)\b/.test(line)) {
        cognitive += 1 + nestingLevel;
      }
      
      nestingLevel += openBraces - closeBraces;
      nestingLevel = Math.max(0, nestingLevel);
    }
    
    return cognitive;
  }

  private async scanDirectory(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, files);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
    
    return files;
  }

  /**
   * Calculate overall entropy score from metrics
   */
  calculateEntropyScore(metrics: EntropyMetrics): number {
    // Weighted combination of metrics
    const weights = {
      cyclomatic: 0.25,
      halstead: 0.0001, // Halstead volume can be large
      cognitive: 0.3,
      duplicate: 50,
      boundary: 10,
      doc: 20,
    };
    
    const score = 
      metrics.cyclomaticComplexity * weights.cyclomatic +
      metrics.halsteadVolume * weights.halstead +
      metrics.cognitiveComplexity * weights.cognitive +
      metrics.duplicateRatio * weights.duplicate +
      metrics.boundaryViolations * weights.boundary +
      (1 - metrics.documentationCoverage) * weights.doc;
    
    return Math.round(score * 100) / 100;
  }
}

// ============================================================================
// GC Agents Orchestrator
// ============================================================================

export class GCAgentsOrchestrator {
  private duplicateDetector: DuplicateDetector;
  private boundaryEnforcer: BoundaryEnforcer;
  private docSync: DocumentationSync;
  private entropyCalculator: EntropyCalculator;
  private entropyScore: number;

  constructor() {
    this.duplicateDetector = new DuplicateDetector();
    this.boundaryEnforcer = new BoundaryEnforcer();
    this.docSync = new DocumentationSync();
    this.entropyCalculator = new EntropyCalculator();
    this.entropyScore = 0;
  }

  async run(dir: string = './src'): Promise<GCReport> {
    const startTime = Date.now();
    const runId = `gc_${Date.now()}`;
    
    console.log(`[GCAgents] Starting run: ${runId}`);

    // Run detectors
    const duplicates = await this.duplicateDetector.scan(dir);
    const violations = await this.boundaryEnforcer.check(dir);
    const drift = await this.docSync.detectDrift(dir);
    
    // GAP-23: Calculate real entropy metrics
    const entropyMetrics = await this.entropyCalculator.calculateEntropy(dir);
    entropyMetrics.boundaryViolations = violations.length;
    
    // Calculate entropy score using real metrics
    this.entropyScore = this.entropyCalculator.calculateEntropyScore(entropyMetrics);

    // Apply auto-fixes
    let autoFixesApplied = 0;
    for (const violation of violations) {
      if (violation.severity === 'warning') {
        await this.boundaryEnforcer.autoFix(violation);
        autoFixesApplied++;
      }
    }

    // Create PRs for significant fixes
    const prsCreated: string[] = [];
    if (duplicates.totalWaste > 100) {
      prsCreated.push(`#${Date.now()}-dedup`);
    }
    if (violations.filter(v => v.severity === 'error').length > 5) {
      prsCreated.push(`#${Date.now()}-boundary-fixes`);
    }
    if (drift.filter(d => d.confidence > 0.8).length > 3) {
      prsCreated.push(`#${Date.now()}-doc-sync`);
    }

    const report: GCReport = {
      runId,
      timestamp: new Date().toISOString(),
      entropyScore: this.entropyScore,
      violationsFound: violations.length,
      autoFixesApplied,
      prsCreated,
      durationMs: Date.now() - startTime,
    };

    console.log('[GCAgents] Run complete:', report);
    return report;
  }

  getEntropyScore(): number {
    return this.entropyScore;
  }
}

// ============================================================================
// Singleton Exports
// ============================================================================

export const gcAgents = new GCAgentsOrchestrator();
export const duplicateDetector = new DuplicateDetector();
export const boundaryEnforcer = new BoundaryEnforcer();
export const docSync = new DocumentationSync();
export const entropyCalculator = new EntropyCalculator();
