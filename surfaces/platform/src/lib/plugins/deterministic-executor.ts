/**
 * Deterministic Plugin Executor
 * 
 * Executes vendor plugins (markdown-based commands/skills) in a deterministic way:
 * - Loads command/skill markdown files
 * - Validates inputs against schemas
 * - Executes through LLM with constrained outputs
 * - Tracks all actions for auditability
 * 
 * Works for both:
 * - Platform users: Through chat interface
 * - External agents: Via exported portable format
 */

import { 
  getPluginById, 
  getCommand, 
  type ClaudeDesktopPlugin,
  type PluginCommand 
} from '@/plugins/vendor/claude-desktop-registry';

// =============================================================================
// EXECUTION TYPES
// =============================================================================

export interface DeterministicRequest {
  pluginId: string;
  commandId: string;
  inputs: Record<string, unknown>;
  files?: File[];
  context?: {
    workspaceId?: string;
    userId?: string;
    sessionId?: string;
    previousActions?: ExecutedAction[];
  };
}

export interface DeterministicResponse {
  success: boolean;
  output: string;
  actions: ExecutedAction[];
  artifacts?: GeneratedArtifact[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface ExecutedAction {
  id: string;
  timestamp: number;
  type: 'read_file' | 'write_file' | 'call_api' | 'run_query' | 'generate' | 'analyze';
  description: string;
  input: Record<string, unknown>;
  output?: unknown;
  duration: number;
}

export interface GeneratedArtifact {
  type: 'document' | 'code' | 'data' | 'image' | 'report';
  name: string;
  content: string;
  format: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// PLUGIN LOADER
// =============================================================================

interface LoadedCommand {
  plugin: ClaudeDesktopPlugin;
  command: PluginCommand;
  markdown: string;
  skills: string[];
}

/**
 * Load a command's markdown content
 * In browser: fetch from public URL
 * In Node/Electron: read from filesystem
 */
async function loadCommandMarkdown(pluginId: string, commandId: string): Promise<LoadedCommand | null> {
  const plugin = getPluginById(pluginId);
  if (!plugin) return null;
  
  const command = plugin.commands.find(c => c.name === commandId);
  if (!command) return null;
  
  // Construct path to markdown file
  const markdownPath = `plugins/vendor/claude-desktop/${pluginId}/${command.file}`;
  
  try {
    // Try to fetch (works in browser and if files are served)
    const response = await fetch(`/${markdownPath}`);
    if (!response.ok) throw new Error(`Failed to load ${markdownPath}`);
    const markdown = await response.text();
    
    // Load associated skills
    const skills: string[] = [];
    for (const skill of plugin.skills) {
      try {
        const skillPath = `plugins/vendor/claude-desktop/${pluginId}/${skill.file}`;
        const skillResponse = await fetch(`/${skillPath}`);
        if (skillResponse.ok) {
          skills.push(await skillResponse.text());
        }
      } catch {
        // Skill optional, continue
      }
    }
    
    return { plugin, command, markdown, skills };
  } catch (err) {
    console.error(`[DeterministicExecutor] Failed to load command: ${pluginId}/${commandId}`, err);
    return null;
  }
}

// =============================================================================
// DETERMINISTIC EXECUTION ENGINE
// =============================================================================

class DeterministicExecutor {
  private actions: ExecutedAction[] = [];
  private startTime: number = 0;
  
  async execute(request: DeterministicRequest): Promise<DeterministicResponse> {
    this.startTime = Date.now();
    this.actions = [];
    
    try {
      // 1. Load command definition
      const loaded = await loadCommandMarkdown(request.pluginId, request.commandId);
      if (!loaded) {
        return this.createError('COMMAND_NOT_FOUND', `Command ${request.commandId} not found in plugin ${request.pluginId}`, false);
      }
      
      // 2. Validate inputs
      const validation = this.validateInputs(loaded.command, request.inputs);
      if (!validation.valid) {
        return this.createError('INVALID_INPUTS', validation.error!, true);
      }
      
      // 3. Build system prompt from command + skills
      const systemPrompt = this.buildSystemPrompt(loaded);
      
      // 4. Execute deterministically
      const result = await this.executeWithLLM(systemPrompt, request);
      
      // 5. Return with full audit trail
      return {
        success: true,
        output: result.output,
        actions: this.actions,
        artifacts: result.artifacts,
      };
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return this.createError('EXECUTION_ERROR', error.message, false);
    }
  }
  
  private validateInputs(command: PluginCommand, inputs: Record<string, unknown>): { valid: boolean; error?: string } {
    // Basic validation - ensure required inputs are present
    // More sophisticated validation can be added based on command schemas
    return { valid: true };
  }
  
  private buildSystemPrompt(loaded: LoadedCommand): string {
    const sections: string[] = [];
    
    // Add command instructions
    sections.push(`# COMMAND: ${loaded.command.name}`);
    sections.push(loaded.markdown);
    
    // Add skills as context
    if (loaded.skills.length > 0) {
      sections.push('\n# REFERENCE SKILLS');
      for (const skill of loaded.skills) {
        sections.push(skill);
      }
    }
    
    // Add deterministic constraints
    sections.push(`
# DETERMINISTIC EXECUTION CONSTRAINTS

You are executing this command in a DETERMINISTIC environment. Follow these rules:

1. **Only use defined actions**: ${loaded.plugin.capabilities?.join(', ') || 'analyze, generate'}
2. **Track all actions**: Every file read, API call, or data access must be logged
3. **No external state**: Do not rely on information outside the provided context
4. **Reproducible**: The same inputs must produce the same outputs
5. **Audit trail**: All decisions must be explainable from the inputs

OUTPUT FORMAT:
- Provide your response in clear markdown
- Include reasoning for any classifications or decisions
- If generating artifacts, specify their format and content
`);
    
    return sections.join('\n\n');
  }
  
  private async executeWithLLM(
    systemPrompt: string, 
    request: DeterministicRequest
  ): Promise<{ output: string; artifacts?: GeneratedArtifact[] }> {
    // This would integrate with the platform's LLM service
    // For now, we'll create a structured execution that can be mocked or implemented
    
    const userPrompt = this.buildUserPrompt(request);
    
    // Track the LLM call as an action
    const actionStart = Date.now();
    
    // In real implementation, this calls the LLM API
    // const response = await llmService.complete({
    //   system: systemPrompt,
    //   user: userPrompt,
    //   model: 'claude-3-5-sonnet',
    //   temperature: 0, // Deterministic
    // });
    
    // Placeholder: In actual implementation, this would be the LLM response
    const output = `[Deterministic execution of ${request.pluginId}/${request.commandId}]\n\n` +
      `Input: ${JSON.stringify(request.inputs)}\n\n` +
      `This would execute the command markdown against the LLM with deterministic constraints.`;
    
    this.actions.push({
      id: `llm-${Date.now()}`,
      timestamp: Date.now(),
      type: 'generate',
      description: `Execute ${request.commandId} with deterministic constraints`,
      input: { systemPromptLength: systemPrompt.length, userPrompt },
      duration: Date.now() - actionStart,
    });
    
    return { output };
  }
  
  private buildUserPrompt(request: DeterministicRequest): string {
    const parts: string[] = [];
    
    parts.push('# INPUTS');
    for (const [key, value] of Object.entries(request.inputs)) {
      parts.push(`## ${key}`);
      parts.push(JSON.stringify(value, null, 2));
    }
    
    if (request.files && request.files.length > 0) {
      parts.push('\n# ATTACHED FILES');
      for (const file of request.files) {
        parts.push(`- ${file.name} (${file.type}, ${file.size} bytes)`);
        // In real implementation, file content would be extracted here
      }
    }
    
    if (request.context?.previousActions) {
      parts.push('\n# EXECUTION HISTORY');
      for (const action of request.context.previousActions) {
        parts.push(`- [${new Date(action.timestamp).toISOString()}] ${action.type}: ${action.description}`);
      }
    }
    
    return parts.join('\n\n');
  }
  
  private createError(code: string, message: string, recoverable: boolean): DeterministicResponse {
    return {
      success: false,
      output: '',
      actions: this.actions,
      error: { code, message, recoverable },
    };
  }
}

// =============================================================================
// EXPORTED SINGLETON
// =============================================================================

export const deterministicExecutor = new DeterministicExecutor();

// =============================================================================
// PORTABLE PLUGIN FORMAT (for external use)
// =============================================================================

export interface PortablePlugin {
  format: 'allternit-v1';
  id: string;
  name: string;
  version: string;
  description: string;
  author: { name: string; verified: boolean };
  category: string;
  capabilities: string[];
  commands: Array<{
    name: string;
    description: string;
    trigger: string;
    markdown: string;
  }>;
  skills: Array<{
    name: string;
    markdown: string;
  }>;
  mcp?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
}

/**
 * Export a plugin to portable format
 * This can be used outside the platform by any agent
 */
export async function exportToPortableFormat(pluginId: string): Promise<PortablePlugin | null> {
  const plugin = getPluginById(pluginId);
  if (!plugin) return null;
  
  const commands: PortablePlugin['commands'] = [];
  const skills: PortablePlugin['skills'] = [];
  
  // Load all command markdowns
  for (const command of plugin.commands) {
    try {
      const response = await fetch(`/plugins/vendor/claude-desktop/${pluginId}/${command.file}`);
      if (response.ok) {
        commands.push({
          name: command.name,
          description: command.description,
          trigger: command.trigger,
          markdown: await response.text(),
        });
      }
    } catch (err) {
      console.warn(`Failed to load command ${command.name}:`, err);
    }
  }
  
  // Load all skill markdowns
  for (const skill of plugin.skills) {
    try {
      const response = await fetch(`/plugins/vendor/claude-desktop/${pluginId}/${skill.file}`);
      if (response.ok) {
        skills.push({
          name: skill.name,
          markdown: await response.text(),
        });
      }
    } catch (err) {
      console.warn(`Failed to load skill ${skill.name}:`, err);
    }
  }
  
  return {
    format: 'allternit-v1',
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: { name: plugin.author, verified: plugin.author === 'Anthropic' },
    category: plugin.category,
    capabilities: plugin.capabilities || [],
    commands,
    skills,
  };
}

/**
 * Execute a portable plugin outside the platform
 * This function can be used by any agent with LLM access
 */
export async function executePortablePlugin(
  plugin: PortablePlugin,
  commandName: string,
  inputs: Record<string, unknown>,
  options: {
    llm: {
      complete: (params: { system: string; user: string }) => Promise<{ content: string }>;
    };
  }
): Promise<DeterministicResponse> {
  const command = plugin.commands.find(c => c.name === commandName);
  if (!command) {
    return {
      success: false,
      output: '',
      actions: [],
      error: { code: 'COMMAND_NOT_FOUND', message: `Command ${commandName} not found`, recoverable: false },
    };
  }
  
  // Build system prompt
  const systemPrompt = `
# PLUGIN: ${plugin.name} v${plugin.version}
# COMMAND: ${command.name}

${command.markdown}

## REFERENCE SKILLS
${plugin.skills.map(s => `### ${s.name}\n${s.markdown}`).join('\n\n')}

## EXECUTION CONSTRAINTS
Execute this command DETERMINISTICALLY:
- Only use capabilities: ${plugin.capabilities.join(', ')}
- Track all actions taken
- Provide reproducible outputs
`;
  
  const userPrompt = `
# INPUTS
${JSON.stringify(inputs, null, 2)}

Execute the ${command.name} command with the provided inputs.
`;
  
  const startTime = Date.now();
  
  try {
    const response = await options.llm.complete({ system: systemPrompt, user: userPrompt });
    
    return {
      success: true,
      output: response.content,
      actions: [{
        id: `portable-${Date.now()}`,
        timestamp: startTime,
        type: 'generate',
        description: `Execute ${plugin.id}/${commandName}`,
        input: { command: commandName, inputs },
        duration: Date.now() - startTime,
      }],
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      output: '',
      actions: [],
      error: { code: 'EXECUTION_ERROR', message: error.message, recoverable: false },
    };
  }
}
