import type { Tool } from '../harness/types.js';
import { AllternitClient } from '../gen/allternit-client.js';

interface MemoryQueryResponse {
  data?: Array<{
    chunk_type?: string;
    content?: string;
    source?: string;
  }>;
}

interface AllternitClientWithMemory {
  memory: {
    query(params: {
      query: {
        query: string;
        chunk_type?: string;
        limit?: number;
      };
    }): Promise<MemoryQueryResponse>;
  };
}

export const BRAIN_TOOL: Tool = {
  name: 'query_brain',
  description: 'Query your personal knowledge base (Brain) for facts, skills, and past events.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term or question' },
      type: { 
        type: 'string', 
        enum: ['episodic', 'semantic', 'procedural'], 
        description: 'Specific memory type to search' 
      },
      limit: { type: 'number', description: 'Max results' }
    },
    required: ['query']
  }
};

export class BrainCapability {
  constructor(private client: AllternitClient) {}

  public getTool(): Tool {
    return BRAIN_TOOL;
  }

  /**
   * Execute the brain query via the Allternit API
   */
  public async execute(args: { query: string; type?: string; limit?: number }): Promise<string> {
    try {
      const memoryClient = this.client as unknown as AllternitClientWithMemory;
      const response = await memoryClient.memory.query({
        query: {
          query: args.query,
          chunk_type: args.type,
          limit: args.limit,
        },
      });

      if (!response.data || response.data.length === 0) {
        return "No relevant memories found in your brain.";
      }

      const memories = response.data
        .map((m) => `- [${m.chunk_type ?? 'unknown'}] ${m.content ?? ''} (Source: ${m.source ?? 'unknown'})`)
        .join('\n');

      return `Found the following in your brain:\n${memories}`;
    } catch (error) {
      return `Error querying brain: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * System prompt addendum for Brain usage
   */
  public getPromptAddendum(): string {
    return `
MEMORY & KNOWLEDGE (BRAIN):
- You have access to a personal knowledge base called "The Brain".
- Use the "query_brain" tool to recall facts, project context, or past decisions.
- If you lack information about the user's preferences or project history, check the brain first.
`;
  }
}
