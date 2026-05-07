import { EventEmitter } from 'events';
import { AgentRun } from './run.js';
import { AgentStorage } from './persistence/index.js';
import { LimaEnvironment } from '../environment/lima.js';
import { HostEnvironment } from '../environment/host.js';
import { FilesystemCapability } from '../capabilities/filesystem.js';
import { ComputerUseCapability } from '../capabilities/computer-use.js';
import { HITLCapability } from '../capabilities/human-in-the-loop.js';
import { ToolRegistry } from '../tools/registry.js';
import { NativeToolBelt } from '../tools/search.js';
export class AllternitAgent extends EventEmitter {
    harness;
    storage;
    options;
    environment;
    globalToolRegistry;
    globalToolBelt;
    // Active runs for HITL resume support
    activeRuns = new Map();
    // Capabilities
    brain;
    filesystem;
    computer;
    hitl;
    constructor(harness, options = {}) {
        super();
        this.harness = harness;
        this.options = options;
        this.storage = new AgentStorage(options.persistencePath ? { path: options.persistencePath } : {});
        this.globalToolRegistry = new ToolRegistry();
        this.globalToolBelt = new NativeToolBelt(this.globalToolRegistry);
        if (options.environment === 'lima') {
            this.environment = new LimaEnvironment();
        }
        else {
            this.environment = new HostEnvironment();
        }
        // Initialize capabilities
        if (options.capabilities?.includes('brain')) {
            // Note: In real SDK, client would be passed or resolved
            // this.brain = new BrainCapability(this.client);
        }
        if (options.capabilities?.includes('filesystem')) {
            this.filesystem = new FilesystemCapability(this.environment);
            this.filesystem.getTools().forEach(t => this.globalToolRegistry.registerTool(t));
        }
        if (options.capabilities?.includes('computer-use')) {
            this.computer = new ComputerUseCapability(options.computerUseBaseUrl);
            const computerTool = this.computer.getTool();
            this.globalToolRegistry.registerDeferredTool({
                id: computerTool.name,
                name: computerTool.name,
                description: computerTool.description,
                input_schema: computerTool.input_schema,
                metadata: computerTool.metadata,
                tags: ['computer', 'browser', 'desktop', 'vision'],
                activate: () => this.computer.getTool(),
            });
        }
        this.hitl = new HITLCapability(this);
        this.globalToolRegistry.registerTool(this.hitl.getTool());
    }
    getHarness() { return this.harness; }
    /**
     * Register a tool globally at startup
     */
    registerTool(tool) {
        this.globalToolRegistry.registerTool(tool);
    }
    registerDeferredTool(tool) {
        this.globalToolRegistry.registerDeferredTool(tool);
    }
    /**
     * Start a new Run
     */
    run(request) {
        const runId = crypto.randomUUID();
        // Enriched request with prompt addendums
        const enrichedRequest = this.enrichRequestWithCapabilities(request);
        const run = new AgentRun(runId, this, enrichedRequest);
        run.runState.toolRegistry = this.globalToolRegistry.fork();
        run.runState.toolBelt = new NativeToolBelt(run.runState.toolRegistry);
        // Track active run for HITL resume support
        this.activeRuns.set(runId, run);
        run.once('completed', () => this.activeRuns.delete(runId));
        run.once('error', () => this.activeRuns.delete(runId));
        this.saveRunState(run);
        setImmediate(() => run.execute());
        return run;
    }
    enrichRequestWithCapabilities(request) {
        let systemPromptAddendum = '';
        // Pull prompt addendums from capabilities if they exist
        const messages = [...request.messages];
        if (systemPromptAddendum) {
            const systemMsg = messages.find(m => m.role === 'system');
            if (systemMsg) {
                if (typeof systemMsg.content === 'string') {
                    systemMsg.content += `\n${systemPromptAddendum}`;
                }
            }
            else {
                messages.unshift({ role: 'system', content: systemPromptAddendum });
            }
        }
        return { ...request, messages };
    }
    /**
     * Resume an existing Run from storage
     */
    async resume(runId, initialRequest) {
        const record = this.storage.getRun(runId);
        if (!record) {
            throw new Error(`Run ${runId} not found in persistence`);
        }
        const enrichedRequest = this.enrichRequestWithCapabilities(initialRequest);
        const run = new AgentRun(runId, this, enrichedRequest);
        run.runState.toolRegistry = this.globalToolRegistry.fork();
        run.runState.toolBelt = new NativeToolBelt(run.runState.toolRegistry);
        const metadata = JSON.parse(record.metadata || '{}');
        run.hydrate(record.status, JSON.parse(record.messages), metadata.toolSnapshot);
        if (record.status !== 'completed' && record.status !== 'failed') {
            setImmediate(() => run.execute());
        }
        return run;
    }
    /**
     * Submit a reply to a pending HITL request on an active run.
     * Requires the agent instance to still be in memory (same process).
     */
    async submitReply(runId, outcome) {
        const run = this.activeRuns.get(runId);
        if (!run) {
            throw new Error(`Run ${runId} is not active. HITL resume requires the agent to be cached in the same process.`);
        }
        await run.submitReply(outcome);
    }
    /**
     * Get an active run by ID. Returns undefined if the run has completed or failed.
     */
    getActiveRun(runId) {
        return this.activeRuns.get(runId);
    }
    saveRunState(run) {
        const metadata = {
            toolSnapshot: run.runState.toolRegistry.snapshot()
        };
        this.storage.saveRun(run.id, run.status, run.messages, metadata);
    }
    checkToolPermission(toolName) {
        const destructive = ['bash', 'write_file', 'delete_file', 'git_push', 'computer'];
        return destructive.includes(toolName);
    }
    async executeTool(name, args) {
        if (name === 'bash') {
            const result = await this.environment.execute('sh', ['-c', args.command]);
            return result.stdout + result.stderr;
        }
        if (this.filesystem && ['read_file', 'write_file'].includes(name)) {
            return this.filesystem.execute(name, args);
        }
        if (this.computer && name === this.computer.getTool().name) {
            return this.computer.execute(args);
        }
        return `Tool ${name} handled by registry or capability module.`;
    }
}
