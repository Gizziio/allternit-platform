import { AllternitHarness } from '../harness/index.js';
import { AllternitClient } from '../dist/gen/allternit-client.js';
import { AgentRun } from './run.js';
import { AgentStorage } from './persistence/index.js';
import { LimaEnvironment } from '../environment/lima.js';
import { HostEnvironment } from '../environment/host.js';
import { BrainCapability } from '../capabilities/brain.js';
import { FilesystemCapability } from '../capabilities/filesystem.js';
import { ComputerCapability } from '../capabilities/computer.js';
import type { IEnvironment } from '../environment/types.js';
import type { StreamRequest, Tool } from '../harness/types.js';
import type { AgentOptions } from './types.js';

export class AllternitAgent {
  private harness: AllternitHarness;
  private client: AllternitClient;
  private storage: AgentStorage;
  private options: AgentOptions;
  private environment: IEnvironment;
  
  // Capabilities
  private brain?: BrainCapability;
  private filesystem?: FilesystemCapability;
  private computer?: ComputerCapability;

  constructor(
    harness: AllternitHarness,
    client: AllternitClient,
    options: AgentOptions = {}
  ) {
    this.harness = harness;
    this.client = client;
    this.options = options;
    this.storage = new AgentStorage(options.persistencePath);
    
    if (options.environment === 'lima') {
      this.environment = new LimaEnvironment() as unknown as IEnvironment;
    } else {
      this.environment = new HostEnvironment();
    }

    // Initialize capabilities
    if (options.capabilities?.includes('brain')) {
      this.brain = new BrainCapability(this.client);
    }
    if (options.capabilities?.includes('filesystem')) {
      this.filesystem = new FilesystemCapability(this.environment);
    }
    if (options.capabilities?.includes('computer-use')) {
      this.computer = new ComputerCapability(this.client);
    }
  }

  public getHarness() { return this.harness; }

  /**
   * Start a new Run
   */
  public run(request: StreamRequest): AgentRun {
    const runId = crypto.randomUUID();
    
    // Inject capability tools and prompt addendums
    const enrichedRequest = this.enrichRequestWithCapabilities(request);
    
    const run = new AgentRun(runId, this, enrichedRequest);
    this.saveRunState(run);
    
    setImmediate(() => run.execute());
    
    return run;
  }

  private enrichRequestWithCapabilities(request: StreamRequest): StreamRequest {
    const tools: Tool[] = [...(request.tools || [])];
    let systemPromptAddendum = '';

    if (this.brain) {
      tools.push(this.brain.getTool());
      systemPromptAddendum += this.brain.getPromptAddendum();
    }
    if (this.filesystem) {
      tools.push(...this.filesystem.getTools());
    }
    if (this.computer) {
      tools.push(this.computer.getTool());
      systemPromptAddendum += this.computer.getPromptAddendum();
    }

    const messages = [...request.messages];
    if (systemPromptAddendum) {
      const systemMsg = messages.find(m => m.role === 'system');
      if (systemMsg) {
        if (typeof systemMsg.content === 'string') {
          systemMsg.content += `\n${systemPromptAddendum}`;
        }
      } else {
        messages.unshift({ role: 'system', content: systemPromptAddendum });
      }
    }

    return { ...request, tools, messages };
  }

  /**
   * Resume an existing Run from storage
   */
  public async resume(runId: string, initialRequest: StreamRequest): Promise<AgentRun> {
    const record = this.storage.getRun(runId);
    if (!record) {
      throw new Error(`Run ${runId} not found in persistence`);
    }

    const enrichedRequest = this.enrichRequestWithCapabilities(initialRequest);
    const run = new AgentRun(runId, this, enrichedRequest);
    
    // Rehydrate state including tool registry snapshot
    const metadata = JSON.parse(record.metadata || '{}');
    run.hydrate(record.status, JSON.parse(record.messages), metadata.toolSnapshot);
    
    if (record.status !== 'completed' && record.status !== 'failed') {
      setImmediate(() => run.execute());
    }

    return run;
  }

  public saveRunState(run: AgentRun) {
    const metadata = {
      toolSnapshot: run.runState.toolRegistry.snapshot()
    };
    this.storage.saveRun(run.id, run.status, run.messages, metadata);
  }

  public checkToolPermission(toolName: string): boolean {
    const destructive = ['bash', 'write_file', 'delete_file', 'git_push', 'computer'];
    return destructive.includes(toolName);
  }

  /**
   * Execute tool by routing to the appropriate capability
   */
  public async executeTool(name: string, args: any): Promise<string> {
    if (name === 'bash') {
      const result = await this.environment.execute('sh', ['-c', args.command]);
      return result.stdout + result.stderr;
    }
    
    if (this.brain && name === 'query_brain') {
      return this.brain.execute(args);
    }
    
    if (this.filesystem && ['read_file', 'write_file'].includes(name)) {
      return this.filesystem.execute(name, args);
    }

    if (this.computer && name === 'computer') {
      return this.computer.execute(args);
    }
    
    return `Tool ${name} not supported or capability not enabled.`;
  }
}
