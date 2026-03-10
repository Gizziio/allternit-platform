/**
 * WIH (Work Item Handler) Indexer
 * 
 * Indexes all WIH files from a2r-workspace/wih/
 * to enable task pattern learning and recommendations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { MemoryOrchestrator } from '../orchestrator.js';

/**
 * WIH structure (simplified)
 */
interface WIH {
  task_id: string;
  title: string;
  description?: string;
  status?: string;
  tools?: {
    allowlist?: string[];
    denylist?: string[];
  };
  write_scope?: {
    allowed_globs?: string[];
    denied_globs?: string[];
  };
  memory?: {
    packs?: string[];
    context_files?: string[];
  };
  acceptance_checks?: Array<{
    type: string;
    criteria: string;
  }>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * WIH Indexer class
 */
export class WIHIndexer {
  private orchestrator: MemoryOrchestrator;
  private wihDir: string;
  private indexedCount = 0;
  private errorCount = 0;

  constructor(orchestrator: MemoryOrchestrator, wihDir: string) {
    this.orchestrator = orchestrator;
    this.wihDir = wihDir;
  }

  /**
   * Index all WIH files
   */
  async indexAll(): Promise<{
    total: number;
    success: number;
    errors: number;
  }> {
    console.log('WIHIndexer: Starting WIH indexing...');
    console.log(`WIHIndexer: Scanning directory: ${this.wihDir}`);

    // Find all WIH JSON files
    const wihFiles = await glob('*.wih.json', {
      cwd: this.wihDir,
      absolute: true,
    });

    console.log(`WIHIndexer: Found ${wihFiles.length} WIH files`);

    // Process each WIH
    for (const file of wihFiles) {
      try {
        await this.indexWIH(file);
        this.indexedCount++;
        
        // Progress logging every 20 WIHs
        if (this.indexedCount % 20 === 0) {
          console.log(`WIHIndexer: Indexed ${this.indexedCount}/${wihFiles.length} WIHs...`);
        }
      } catch (error) {
        this.errorCount++;
        console.error(`WIHIndexer: Error indexing ${file}:`, error);
      }
    }

    console.log('WIHIndexer: Indexing complete');
    console.log(`  - Total files: ${wihFiles.length}`);
    console.log(`  - Successfully indexed: ${this.indexedCount}`);
    console.log(`  - Errors: ${this.errorCount}`);

    return {
      total: wihFiles.length,
      success: this.indexedCount,
      errors: this.errorCount,
    };
  }

  /**
   * Index a single WIH file
   */
  private async indexWIH(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const wih = JSON.parse(content) as WIH;

    // Extract pattern information for memory
    const memoryContent = this.extractWIHPattern(wih, filePath);

    // Ingest into memory
    const source = `wih:${wih.task_id || path.basename(filePath, '.wih.json')}`;
    
    await this.orchestrator.ingest(
      JSON.stringify(memoryContent, null, 2),
      source
    );
  }

  /**
   * Extract pattern information from WIH
   */
  private extractWIHPattern(wih: WIH, filePath: string): Record<string, unknown> {
    // Build tool usage pattern
    const toolPattern = {
      allowed_tools: wih.tools?.allowlist || [],
      denied_tools: wih.tools?.denylist || [],
      tool_count: (wih.tools?.allowlist || []).length,
    };

    // Build write scope pattern
    const writeScopePattern = {
      allowed_paths: wih.write_scope?.allowed_globs || [],
      denied_paths: wih.write_scope?.denied_globs || [],
    };

    // Build acceptance criteria summary
    const acceptanceSummary = (wih.acceptance_checks || []).map(check => ({
      type: check.type,
      criteria_preview: check.criteria.substring(0, 100),
    }));

    // Build memory context summary
    const memoryContext = {
      packs: wih.memory?.packs || [],
      context_files: wih.memory?.context_files || [],
    };

    return {
      task_id: wih.task_id || 'unknown',
      title: wih.title || 'Untitled',
      description: wih.description,
      status: wih.status || 'unknown',
      tool_pattern: toolPattern,
      write_scope: writeScopePattern,
      acceptance_criteria: acceptanceSummary,
      memory_context: memoryContext,
      created_at: wih.created_at,
      updated_at: wih.updated_at,
      file_path: filePath,
      
      // Searchable tags
      tags: this.generateTags(wih),
    };
  }

  /**
   * Generate searchable tags from WIH
   */
  private generateTags(wih: WIH): string[] {
    const tags: string[] = [];

    // Tool tags
    if (wih.tools?.allowlist) {
      for (const tool of wih.tools.allowlist.slice(0, 10)) {
        tags.push(`tool:${tool}`);
      }
    }

    // Status tag
    if (wih.status) {
      tags.push(`status:${wih.status}`);
    }

    // Type tags based on task_id prefix
    if (wih.task_id) {
      const prefix = wih.task_id.split('_')[0] || wih.task_id.substring(0, 1);
      tags.push(`type:${prefix}`);
    }

    return tags;
  }

  /**
   * Query for similar WIH patterns
   */
  async findSimilarPatterns(taskDescription: string, limit = 5): Promise<unknown[]> {
    const result = await this.orchestrator.query(
      `Find task patterns similar to: ${taskDescription}`
    );

    return result.memories.slice(0, limit);
  }

  /**
   * Get WIH by task ID
   */
  async getByTaskId(taskId: string): Promise<unknown | null> {
    const result = await this.orchestrator.query(
      `Find task pattern with ID: ${taskId}`
    );

    return result.memories[0] || null;
  }

  /**
   * Get WIHs by tool usage
   */
  async getByTool(toolName: string, limit = 10): Promise<unknown[]> {
    const result = await this.orchestrator.query(
      `Find tasks that use tool: ${toolName}`
    );

    return result.memories.slice(0, limit);
  }
}

/**
 * Main function to run WIH indexing
 */
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     A2rchitech WIH Pattern Indexer                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Determine WIH directory
  const workspaceRoot = process.env.A2R_WORKSPACE_ROOT 
    || path.join(process.cwd(), '..', 'a2r-workspace');
  
  const wihDir = path.join(workspaceRoot, 'wih');

  // Check if WIH directory exists
  try {
    await fs.access(wihDir);
  } catch {
    console.error(`Error: WIH directory not found: ${wihDir}`);
    console.error('Please set A2R_WORKSPACE_ROOT environment variable or run from the correct directory');
    process.exit(1);
  }

  // Initialize memory orchestrator
  const orchestrator = new MemoryOrchestrator();
  await orchestrator.initialize();

  // Run indexing
  const indexer = new WIHIndexer(orchestrator, wihDir);
  const result = await indexer.indexAll();

  console.log('');
  console.log('Indexing Summary:');
  console.log(`  Total WIHs: ${result.total}`);
  console.log(`  Indexed: ${result.success}`);
  console.log(`  Errors: ${result.errors}`);
  console.log('');

  // Show memory stats
  const stats = orchestrator.getStats();
  console.log('Memory Statistics:');
  console.log(`  Total memories: ${stats.memories.total}`);
  console.log(`  Insights: ${stats.insights}`);
  console.log(`  Connections: ${stats.connections}`);
  console.log('');

  // Demo: Show similar patterns
  console.log('Demo: Finding patterns for "DAG validation"');
  const similar = await indexer.findSimilarPatterns('DAG validation and verification', 3);
  console.log(`  Found ${similar.length} similar patterns`);
  console.log('');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { WIHIndexer };
