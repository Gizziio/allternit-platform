/**
 * Receipt Ingestion Pipeline
 * 
 * Ingests all agent execution receipts from a2r-workspace/receipts/
 * into the memory agent for queryable history
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { MemoryOrchestrator } from '../orchestrator.js';

/**
 * Receipt structure (simplified)
 */
interface Receipt {
  receipt_id: string;
  run_id: string;
  graph_id: string;
  agent_profile_id?: string;
  status: 'success' | 'failure' | 'partial';
  created_at?: string;
  node_receipts?: Array<{
    node_id: string;
    tool_calls?: Array<{
      tool_name: string;
      input?: unknown;
      output?: unknown;
    }>;
  }>;
  tool_receipts?: Array<{
    tool_id: string;
    input: unknown;
    output: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Receipt Ingester class
 */
export class ReceiptIngester {
  private orchestrator: MemoryOrchestrator;
  private receiptsDir: string;
  private processedCount = 0;
  private errorCount = 0;

  constructor(orchestrator: MemoryOrchestrator, receiptsDir: string) {
    this.orchestrator = orchestrator;
    this.receiptsDir = receiptsDir;
  }

  /**
   * Ingest all receipts from directory
   */
  async ingestAll(): Promise<{
    total: number;
    success: number;
    errors: number;
  }> {
    console.log('ReceiptIngester: Starting receipt ingestion...');
    console.log(`ReceiptIngester: Scanning directory: ${this.receiptsDir}`);

    // Find all receipt JSON files
    const receiptFiles = await glob('**/*.json', {
      cwd: this.receiptsDir,
      absolute: true,
    });

    console.log(`ReceiptIngester: Found ${receiptFiles.length} receipt files`);

    // Process each receipt
    for (const file of receiptFiles) {
      try {
        await this.ingestReceipt(file);
        this.processedCount++;
        
        // Progress logging every 10 receipts
        if (this.processedCount % 10 === 0) {
          console.log(`ReceiptIngester: Processed ${this.processedCount}/${receiptFiles.length} receipts...`);
        }
      } catch (error) {
        this.errorCount++;
        console.error(`ReceiptIngester: Error processing ${file}:`, error);
      }
    }

    console.log('ReceiptIngester: Ingestion complete');
    console.log(`  - Total files: ${receiptFiles.length}`);
    console.log(`  - Successfully ingested: ${this.processedCount}`);
    console.log(`  - Errors: ${this.errorCount}`);

    return {
      total: receiptFiles.length,
      success: this.processedCount,
      errors: this.errorCount,
    };
  }

  /**
   * Ingest a single receipt file
   */
  private async ingestReceipt(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const receipt = JSON.parse(content) as Receipt;

    // Extract key information for memory
    const memoryContent = this.extractReceiptContent(receipt, filePath);

    // Ingest into memory
    const source = `receipt:${receipt.receipt_id || path.basename(filePath)}`;
    
    await this.orchestrator.ingest(
      JSON.stringify(memoryContent, null, 2),
      source
    );
  }

  /**
   * Extract relevant content from receipt for memory
   */
  private extractReceiptContent(receipt: Receipt, filePath: string): Record<string, unknown> {
    // Extract tool calls and their results
    const toolCalls: Array<{
      tool_name: string;
      input_summary: string;
      output_summary: string;
      success: boolean;
    }> = [];

    // From node_receipts
    if (receipt.node_receipts) {
      for (const node of receipt.node_receipts) {
        if (node.tool_calls) {
          for (const call of node.tool_calls) {
            toolCalls.push({
              tool_name: call.tool_name,
              input_summary: this.summarizeValue(call.input),
              output_summary: this.summarizeValue(call.output),
              success: call.output !== null && call.output !== undefined,
            });
          }
        }
      }
    }

    // From tool_receipts
    if (receipt.tool_receipts) {
      for (const tool of receipt.tool_receipts) {
        toolCalls.push({
          tool_name: tool.tool_id,
          input_summary: this.summarizeValue(tool.input),
          output_summary: this.summarizeValue(tool.output),
          success: tool.output !== null && tool.output !== undefined,
        });
      }
    }

    return {
      receipt_id: receipt.receipt_id || 'unknown',
      run_id: receipt.run_id || 'unknown',
      graph_id: receipt.graph_id || 'unknown',
      agent_profile_id: receipt.agent_profile_id,
      status: receipt.status,
      created_at: receipt.created_at,
      tool_calls: toolCalls,
      tool_count: toolCalls.length,
      success: receipt.status === 'success',
      file_path: filePath,
    };
  }

  /**
   * Summarize a value for memory storage
   */
  private summarizeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      return value.length > 200 ? value.substring(0, 200) + '...' : value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return `[Array: ${value.length} items]`;
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return `[Object: ${keys.length} keys - ${keys.slice(0, 5).join(', ')}]`;
    }
    
    return String(value);
  }

  /**
   * Start watching for new receipts
   */
  async startWatching(): Promise<void> {
    console.log('ReceiptIngester: Starting receipt watcher...');
    
    // This would use chokidar to watch for new receipts
    // For now, just log that it would watch
    console.log(`ReceiptIngester: Would watch ${this.receiptsDir} for new receipts`);
  }
}

/**
 * Main function to run receipt ingestion
 */
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     A2rchitech Receipt Ingestion Pipeline                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Determine receipts directory
  const workspaceRoot = process.env.A2R_WORKSPACE_ROOT 
    || path.join(process.cwd(), '..', 'a2r-workspace');
  
  const receiptsDir = path.join(workspaceRoot, 'receipts');

  // Check if receipts directory exists
  try {
    await fs.access(receiptsDir);
  } catch {
    console.error(`Error: Receipts directory not found: ${receiptsDir}`);
    console.error('Please set A2R_WORKSPACE_ROOT environment variable or run from the correct directory');
    process.exit(1);
  }

  // Initialize memory orchestrator
  const orchestrator = new MemoryOrchestrator();
  await orchestrator.initialize();

  // Run ingestion
  const ingester = new ReceiptIngester(orchestrator, receiptsDir);
  const result = await ingester.ingestAll();

  console.log('');
  console.log('Ingestion Summary:');
  console.log(`  Total receipts: ${result.total}`);
  console.log(`  Ingested: ${result.success}`);
  console.log(`  Errors: ${result.errors}`);
  console.log('');

  // Show memory stats
  const stats = orchestrator.getStats();
  console.log('Memory Statistics:');
  console.log(`  Total memories: ${stats.memories.total}`);
  console.log(`  Insights: ${stats.insights}`);
  console.log(`  Connections: ${stats.connections}`);
  console.log('');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ReceiptIngester };
