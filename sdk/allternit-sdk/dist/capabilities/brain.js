export const BRAIN_TOOL = {
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
    client;
    constructor(client) {
        this.client = client;
    }
    getTool() {
        return BRAIN_TOOL;
    }
    /**
     * Execute the brain query via the Allternit API
     */
    async execute(args) {
        try {
            const response = await this.client.memory.query({
                query: {
                    query: args.query,
                    chunk_type: args.type,
                    limit: args.limit
                }
            });
            if (!response.data || response.data.length === 0) {
                return "No relevant memories found in your brain.";
            }
            const memories = response.data.map((m) => `- [${m.chunk_type}] ${m.content} (Source: ${m.source})`).join('\n');
            return `Found the following in your brain:\n${memories}`;
        }
        catch (error) {
            return `Error querying brain: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    /**
     * System prompt addendum for Brain usage
     */
    getPromptAddendum() {
        return `
MEMORY & KNOWLEDGE (BRAIN):
- You have access to a personal knowledge base called "The Brain".
- Use the "query_brain" tool to recall facts, project context, or past decisions.
- If you lack information about the user's preferences or project history, check the brain first.
`;
    }
}
