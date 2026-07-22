import * as fs from 'fs/promises';
import * as path from 'path';

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  lines: number;
  exports: string[];
  imports: string[];
}

interface IngestionResult {
  repo: string;
  timestamp: string;
  files: FileInfo[];
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

export async function ingest(options: { repo: string; entry: string; depth: string }) {
  const repoPath = path.resolve(options.repo);
  const entryPath = path.join(repoPath, options.entry);
  const maxDepth = parseInt(options.depth);

  console.log(`🔍 Ingesting ${repoPath}...`);
  console.log(`   Entry: ${options.entry}`);
  console.log(`   Max depth: ${maxDepth}`);

  const files = await scanDirectory(entryPath, repoPath, 0, maxDepth);

  const result: IngestionResult = {
    repo: repoPath,
    timestamp: new Date().toISOString(),
    files,
    stats: {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      languages: files.reduce((acc, f) => {
        acc[f.extension] = (acc[f.extension] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  };

  const outputFile = 'ingestion.json';
  await fs.writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ Ingested ${files.length} files`);
  console.log(`   Total lines: ${result.stats.totalLines.toLocaleString()}`);
  console.log(`   Languages: ${Object.entries(result.stats.languages).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  console.log(`   Output: ${outputFile}`);
}

async function scanDirectory(dir: string, repoRoot: string, currentDepth: number, maxDepth: number): Promise<FileInfo[]> {
  if (currentDepth > maxDepth) return [];

  const files: FileInfo[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await scanDirectory(fullPath, repoRoot, currentDepth + 1, maxDepth));
        }
      } else if (isSourceFile(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        files.push({
          path: fullPath,
          relativePath: path.relative(repoRoot, fullPath),
          size: content.length,
          extension: path.extname(entry.name),
          lines: lines.length,
          exports: extractExports(content),
          imports: extractImports(content),
        });
      }
    }
  } catch { /* ignore */ }

  return files;
}

function isSourceFile(name: string): boolean {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java'];
  return exts.some(ext => name.endsWith(ext)) && !name.endsWith('.d.ts');
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const matches = content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/g);
  for (const match of matches) {
    exports.push(match[1]);
  }
  return exports;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const matches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
  for (const match of matches) {
    imports.push(match[1]);
  }
  return [...new Set(imports)];
}
