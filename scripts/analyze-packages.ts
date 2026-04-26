#!/usr/bin/env npx tsx
/**
 * Package Analyzer for A://Labs
 *
 * Scans Allternit packages to extract:
 * - Exported functions, types, interfaces
 * - Complexity scores
 * - Dependency graphs
 * - Topic maps for curriculum generation
 * - Challenge ideas based on code patterns
 *
 * Usage:
 *   npx tsx scripts/analyze-packages.ts [--package packages/@allternit/plugin-sdk]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface PackageAnalysis {
  name: string;
  path: string;
  exports: ExportInfo[];
  types: TypeInfo[];
  complexity: ComplexityScore;
  topics: Topic[];
  challengeIdeas: ChallengeIdea[];
  dependencies: string[];
  fileCount: number;
  lineCount: number;
}

interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface';
  line: number;
  params?: string[];
  returns?: string;
  isAsync?: boolean;
  isDefault?: boolean;
  docstring?: string;
}

interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  fields: string[];
  line: number;
}

interface ComplexityScore {
  cyclomatic: number;      // Rough estimate based on branching
  cognitive: number;       // Based on nesting depth
  lines: number;
  exports: number;
}

interface Topic {
  name: string;
  concepts: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  relatedExports: string[];
}

interface ChallengeIdea {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedExports: string[];
  skills: string[];
}

const PACKAGE_ROOT = 'packages/@allternit';

// Keywords that map to curriculum topics
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Architecture': ['interface', 'abstract', 'pattern', 'system', 'architecture', 'design'],
  'State Management': ['state', 'store', 'reducer', 'dispatch', 'action'],
  'Concurrency': ['async', 'await', 'promise', 'queue', 'scheduler', 'parallel', 'concurrent'],
  'Error Handling': ['error', 'catch', 'try', 'fallback', 'retry', 'circuit', 'timeout'],
  'API Design': ['api', 'endpoint', 'request', 'response', 'client', 'fetch', 'http'],
  'Security': ['auth', 'permission', 'token', 'sign', 'verify', 'encrypt', 'sandbox'],
  'Testing': ['test', 'mock', 'stub', 'assert', 'expect', 'describe'],
  'Validation': ['validate', 'schema', 'zod', 'parse', 'check'],
  'Serialization': ['serialize', 'deserialize', 'json', 'encode', 'decode'],
  'Events': ['event', 'emit', 'subscribe', 'listener', 'observer', 'pubsub'],
  'Caching': ['cache', 'memo', 'ttl', 'expire', 'store'],
  'Plugin System': ['plugin', 'host', 'register', 'hook', 'extension', 'manifest'],
  'Workflow': ['workflow', 'node', 'dag', 'graph', 'connection', 'edge'],
  'Adapter Pattern': ['adapter', 'transform', 'convert', 'map', 'port'],
  'Provider': ['provider', 'service', 'client', 'driver', 'backend'],
};

async function findTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        files.push(...await findTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist
  }
  return files;
}

function parseExports(content: string, filename: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export function
    const funcMatch = line.match(/export\s+(async\s+)?function\s+(\w+)\s*\((.*?)\)(?:\s*:\s*(\w+))?/);
    if (funcMatch) {
      exports.push({
        name: funcMatch[2],
        type: 'function',
        line: i + 1,
        params: funcMatch[3].split(',').map(p => p.trim()).filter(Boolean),
        returns: funcMatch[4],
        isAsync: !!funcMatch[1],
      });
      continue;
    }

    // export const / let
    const constMatch = line.match(/export\s+const\s+(\w+)\s*[:=]/);
    if (constMatch && !line.includes('=>')) {
      exports.push({
        name: constMatch[1],
        type: 'const',
        line: i + 1,
      });
      continue;
    }

    // export const with arrow function
    const arrowMatch = line.match(/export\s+const\s+(\w+)\s*=\s*(async\s+)?\((.*?)\)\s*=>/);
    if (arrowMatch) {
      exports.push({
        name: arrowMatch[1],
        type: 'function',
        line: i + 1,
        params: arrowMatch[3].split(',').map(p => p.trim()).filter(Boolean),
        isAsync: !!arrowMatch[2],
      });
      continue;
    }

    // export interface
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: i + 1,
      });
      continue;
    }

    // export type
    const typeMatch = line.match(/export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        type: 'type',
        line: i + 1,
      });
      continue;
    }

    // export class
    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        line: i + 1,
      });
      continue;
    }

    // default export
    const defaultMatch = line.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultMatch) {
      exports.push({
        name: defaultMatch[1],
        type: 'function',
        line: i + 1,
        isDefault: true,
      });
    }
  }

  return exports;
}

function parseTypes(content: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // interface
    const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)\s*\{/);
    if (interfaceMatch) {
      const fields: string[] = [];
      let j = i + 1;
      let depth = 1;
      while (j < lines.length && depth > 0) {
        const l = lines[j];
        if (l.includes('{')) depth++;
        if (l.includes('}')) depth--;
        if (depth === 1 && l.match(/^\s+\w+\??\s*:/)) {
          const fieldMatch = l.match(/^\s+(\w+\??)\s*:/);
          if (fieldMatch) fields.push(fieldMatch[1]);
        }
        j++;
      }
      types.push({ name: interfaceMatch[1], kind: 'interface', fields, line: i + 1 });
    }

    // type alias (simple ones)
    const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*=/);
    if (typeMatch && !line.includes('=>')) {
      types.push({ name: typeMatch[1], kind: 'type', fields: [], line: i + 1 });
    }
  }

  return types;
}

function computeComplexity(content: string): ComplexityScore {
  const lines = content.split('\n');
  let cyclomatic = 1;
  let maxNesting = 0;
  let currentNesting = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/\b(if|while|for|switch|catch|\?\?)\b/)) cyclomatic++;
    if (trimmed.includes('{')) currentNesting++;
    if (trimmed.includes('}')) currentNesting--;
    maxNesting = Math.max(maxNesting, currentNesting);
  }

  const exports = content.match(/export\s+/g)?.length || 0;

  return {
    cyclomatic,
    cognitive: maxNesting * 2 + cyclomatic * 0.5,
    lines: lines.length,
    exports,
  };
}

function inferTopics(exports: ExportInfo[], types: TypeInfo[], content: string): Topic[] {
  const topics: Topic[] = [];
  const allNames = [...exports.map(e => e.name), ...types.map(t => t.name)];
  const allContent = content.toLowerCase();

  for (const [topicName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const matchedExports: string[] = [];
    const concepts: string[] = [];

    for (const keyword of keywords) {
      if (allContent.includes(keyword.toLowerCase())) {
        concepts.push(keyword);
      }
    }

    for (const exp of exports) {
      for (const keyword of keywords) {
        if (exp.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (exp.docstring && exp.docstring.toLowerCase().includes(keyword.toLowerCase()))) {
          matchedExports.push(exp.name);
        }
      }
    }

    if (concepts.length > 0 || matchedExports.length > 0) {
      const complexity = matchedExports.length > 5 ? 'advanced' :
                        matchedExports.length > 2 ? 'intermediate' : 'beginner';
      topics.push({
        name: topicName,
        concepts: [...new Set(concepts)],
        complexity,
        relatedExports: [...new Set(matchedExports)],
      });
    }
  }

  return topics.sort((a, b) => b.relatedExports.length - a.relatedExports.length);
}

function generateChallengeIdeas(exports: ExportInfo[], types: TypeInfo[], topics: Topic[]): ChallengeIdea[] {
  const ideas: ChallengeIdea[] = [];

  // Generate challenges based on function signatures
  const functions = exports.filter(e => e.type === 'function');
  const interfaces = exports.filter(e => e.type === 'interface');

  if (functions.length > 0) {
    ideas.push({
      title: `Implement a Wrapper for ${functions[0].name}`,
      description: `Write a wrapper function around ${functions[0].name} that adds logging, input validation, and error handling.`,
      difficulty: 'medium',
      relatedExports: [functions[0].name],
      skills: ['error-handling', 'logging', 'wrappers'],
    });
  }

  if (interfaces.length > 0) {
    ideas.push({
      title: `Extend ${interfaces[0].name}`,
      description: `Create a new interface that extends ${interfaces[0].name} with at least 3 additional fields. Write a factory function that constructs valid objects.`,
      difficulty: 'easy',
      relatedExports: [interfaces[0].name],
      skills: ['typescript', 'interfaces', 'factories'],
    });
  }

  if (functions.some(f => f.isAsync)) {
    ideas.push({
      title: 'Add Retry Logic',
      description: 'Pick an async function and wrap it with exponential backoff retry. Handle max retries and circuit breaking.',
      difficulty: 'hard',
      relatedExports: functions.filter(f => f.isAsync).map(f => f.name),
      skills: ['async', 'retry', 'error-handling'],
    });
  }

  if (topics.some(t => t.name === 'Plugin System')) {
    ideas.push({
      title: 'Build a Plugin Loader',
      description: 'Implement a plugin discovery and loading system that validates manifests before activation.',
      difficulty: 'hard',
      relatedExports: [],
      skills: ['plugins', 'validation', 'dynamic-loading'],
    });
  }

  if (topics.some(t => t.name === 'Concurrency')) {
    ideas.push({
      title: 'Implement a Task Queue',
      description: 'Build a priority task queue with max concurrency, cancellation support, and progress tracking.',
      difficulty: 'hard',
      relatedExports: [],
      skills: ['concurrency', 'queues', 'scheduling'],
    });
  }

  return ideas;
}

async function analyzePackage(packagePath: string): Promise<PackageAnalysis | null> {
  const name = path.basename(packagePath);
  const fullPath = path.resolve(packagePath);

  try {
    await fs.access(fullPath);
  } catch {
    console.error(`Package not found: ${packagePath}`);
    return null;
  }

  const tsFiles = await findTsFiles(path.join(fullPath, 'src'));
  if (tsFiles.length === 0) {
    console.warn(`No TypeScript files found in ${packagePath}/src`);
  }

  let allContent = '';
  let allExports: ExportInfo[] = [];
  let allTypes: TypeInfo[] = [];
  let totalLines = 0;

  for (const file of tsFiles) {
    const content = await fs.readFile(file, 'utf-8');
    allContent += content + '\n';
    totalLines += content.split('\n').length;

    allExports.push(...parseExports(content, file));
    allTypes.push(...parseTypes(content));
  }

  // Read package.json for dependencies
  let dependencies: string[] = [];
  try {
    const pkgJson = JSON.parse(await fs.readFile(path.join(fullPath, 'package.json'), 'utf-8'));
    dependencies = Object.keys(pkgJson.dependencies || {});
  } catch {
    // No package.json
  }

  const complexity = computeComplexity(allContent);
  const topics = inferTopics(allExports, allTypes, allContent);
  const challengeIdeas = generateChallengeIdeas(allExports, allTypes, topics);

  return {
    name,
    path: packagePath,
    exports: allExports,
    types: allTypes,
    complexity,
    topics,
    challengeIdeas,
    dependencies,
    fileCount: tsFiles.length,
    lineCount: totalLines,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const packageIdx = args.indexOf('--package');

  let packages: string[] = [];
  if (packageIdx !== -1) {
    packages = [args[packageIdx + 1]];
  } else {
    // Analyze all packages
    try {
      const entries = await fs.readdir(PACKAGE_ROOT);
      packages = entries
        .filter(e => !e.startsWith('.'))
        .map(e => path.join(PACKAGE_ROOT, e));
    } catch {
      console.error(`Cannot read ${PACKAGE_ROOT}`);
      process.exit(1);
    }
  }

  console.log(`🔍 Analyzing ${packages.length} package(s)...\n`);

  const results: PackageAnalysis[] = [];
  for (const pkg of packages) {
    const analysis = await analyzePackage(pkg);
    if (analysis) results.push(analysis);
  }

  // Print summary
  for (const r of results) {
    console.log(`📦 ${r.name}`);
    console.log(`   Files: ${r.fileCount}  Lines: ${r.lineCount}  Exports: ${r.exports.length}  Types: ${r.types.length}`);
    console.log(`   Complexity: cyclomatic=${r.complexity.cyclomatic}  cognitive=${Math.round(r.complexity.cognitive)}`);
    console.log(`   Topics: ${r.topics.map(t => t.name).join(', ')}`);
    console.log(`   Challenges: ${r.challengeIdeas.length} ideas`);
    console.log('');
  }

  // Save full analysis
  const outputDir = 'alabs-generated-courses/analysis';
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'package-analysis.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 Full analysis saved to ${outputPath}`);

  // Generate curriculum map
  const curriculum = generateCurriculumMap(results);
  const curriculumPath = path.join(outputDir, 'curriculum-map.json');
  await fs.writeFile(curriculumPath, JSON.stringify(curriculum, null, 2), 'utf-8');
  console.log(`📚 Curriculum map saved to ${curriculumPath}`);
}

function generateCurriculumMap(analyses: PackageAnalysis[]) {
  const modules: Array<{
    package: string;
    title: string;
    topics: string[];
    concepts: string[];
    complexity: string;
    challengeCount: number;
    prerequisites: string[];
  }> = [];

  for (const a of analyses) {
    const mainTopics = a.topics.slice(0, 3);
    for (let i = 0; i < mainTopics.length; i++) {
      const topic = mainTopics[i];
      modules.push({
        package: a.name,
        title: `${topic.name} in ${a.name}`,
        topics: [topic.name],
        concepts: topic.concepts,
        complexity: topic.complexity,
        challengeCount: a.challengeIdeas.filter(c =>
          c.skills.some(s => topic.concepts.includes(s))
        ).length,
        prerequisites: i > 0 ? [mainTopics[i - 1].name] : [],
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPackages: analyses.length,
    totalModules: modules.length,
    modules: modules.sort((a, b) => {
      const complexityOrder = { beginner: 0, intermediate: 1, advanced: 2 };
      return complexityOrder[a.complexity as keyof typeof complexityOrder] -
             complexityOrder[b.complexity as keyof typeof complexityOrder];
    }),
  };
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
