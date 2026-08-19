import { NativeWebTools } from './web.js';
import { attachMcpServer, createMcpServerAttachment, loadMcpServerDirectory, } from './mcp.js';
import { TextEditorTool } from './text-editor.js';
import { BashTool } from './bash.js';
import { CodeExecutionTool } from './code-execution.js';
import { MemoryTool } from './memory.js';
import { PdfTool } from './pdf.js';
/**
 * tool_search Tool Definition
 */
export const TOOL_SEARCH_DEFINITION = {
    name: 'tool_search',
    description: 'Search for available tools that are not yet active in this session. Returns a list of tool IDs and descriptions.',
    input_schema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search term (e.g., "browser", "database", "git")' }
        },
        required: ['query']
    }
};
/**
 * tool_activate Tool Definition
 */
export const TOOL_ACTIVATE_DEFINITION = {
    name: 'tool_activate',
    description: 'Activate (install) a deferred tool discovered via tool_search so it can be used in this session.',
    input_schema: {
        type: 'object',
        properties: {
            toolId: { type: 'string', description: 'The ID of the tool to activate' }
        },
        required: ['toolId']
    }
};
export class NativeToolBelt {
    registry;
    /** Resolves once the initial ~/.allternit/mcp-servers.json directory load finishes. */
    mcpDirectoryLoaded;
    constructor(registry, options = {}) {
        this.registry = registry;
        // Register the search and activate tools themselves
        this.registry.registerTool({
            ...TOOL_SEARCH_DEFINITION,
            execute: async (args) => {
                const results = this.registry.search(args.query);
                return results.map(r => ({ id: r.id, name: r.name, description: r.description }));
            }
        });
        this.registry.registerTool({
            ...TOOL_ACTIVATE_DEFINITION,
            execute: async (args) => {
                this.registry.activateTool(args.toolId);
                return `Tool ${args.toolId} successfully activated and ready for use.`;
            }
        });
        for (const tool of new NativeWebTools(options).definitions()) {
            this.registry.registerTool(tool, { strict: true });
        }
        this.registry.registerTool(new TextEditorTool(options).definition(), { strict: true });
        this.registry.registerTool(new BashTool({ runner: options.bashRunner }).definition(), { strict: true });
        this.registry.registerTool(new CodeExecutionTool({ runner: options.codeExecutionRunner }).definition(), { strict: true });
        this.registry.registerTool(new MemoryTool(options).definition(), { strict: true });
        this.registry.registerTool(new PdfTool(options).definition(), { strict: true });
        this.mcpDirectoryLoaded = loadMcpServerDirectory({ attachMcpServer: (cfg) => this.attachMcpServer(cfg) }, { path: options.mcpDirectoryPath, fetch: options.fetch });
    }
    attachMcpServer(serverOrConfig) {
        if ('listTools' in serverOrConfig) {
            return attachMcpServer(this.registry, serverOrConfig);
        }
        return attachMcpServer(this.registry, createMcpServerAttachment(serverOrConfig));
    }
    getRegistry() {
        return this.registry;
    }
}
