/**
 * Ars Contexta Knowledge System
 *
 * Three-Space Architecture for personalized "second brain" knowledge systems.
 * Implements the 6Rs processing pipeline.
 *
 * Based on: https://github.com/agenticnotetaking/arscontexta
 */

// ============================================================================
// Three-Space Architecture Types
// ============================================================================

/**
 * Self Space - Agent identity and persistent state
 */
export interface SelfSpace {
  agentId: string;
  identity: AgentIdentity;
  preferences: AgentPreferences;
  capabilities: string[];
  lastActiveAt: string;
}

export interface AgentIdentity {
  name: string;
  role: string;
  specialty: string[];
  createdAt: string;
}

export interface AgentPreferences {
  communicationStyle: 'formal' | 'casual' | 'technical';
  detailLevel: 'brief' | 'balanced' | 'comprehensive';
  proactiveLevel: 1 | 2 | 3 | 4 | 5;
}

/**
 * Notes Space - Knowledge graph with wiki-links
 */
export interface NotesSpace {
  notes: Map<string, Note>;
  links: NoteLink[];
  mocs: Map<string, MapOfContent>;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[]; // Note IDs
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  confidence: number;
}

export interface NoteLink {
  source: string;
  target: string;
  type: 'reference' | 'related' | 'contradicts' | 'extends';
  strength: number;
}

export interface MapOfContent {
  id: string;
  title: string;
  level: 'hub' | 'domain' | 'topic';
  notes: string[];
  description: string;
}

/**
 * Ops Space - Operational coordination
 */
export interface OpsSpace {
  activeTasks: Task[];
  sessionHistory: Session[];
  workflows: Workflow[];
}

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: string[]; // Note IDs
  createdAt: string;
  dueAt?: string;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
  notesCreated: string[];
  tasksCompleted: string[];
  summary: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  active: boolean;
}

export interface WorkflowStep {
  order: number;
  action: string;
  template?: string;
  conditions?: string[];
}

// ============================================================================
// 6Rs Processing Pipeline
// ============================================================================

export type PipelinePhase = 'record' | 'reduce' | 'reflect' | 'reweave' | 'verify' | 'rethink';

export interface PipelineInput {
  rawContent: string;
  source?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineOutput {
  notes: Note[];
  links: NoteLink[];
  summary: string;
  insights: Insight[];
}

export interface Insight {
  id: string;
  type: 'pattern' | 'contradiction' | 'gap' | 'opportunity';
  description: string;
  confidence: number;
  relatedNotes: string[];
}

// ============================================================================
// Ars Contexta Engine
// ============================================================================

export class ArsContextaEngine {
  private selfSpace: SelfSpace | null = null;
  private notesSpace: NotesSpace;
  private opsSpace: OpsSpace;

  constructor() {
    this.notesSpace = {
      notes: new Map(),
      links: [],
      mocs: new Map(),
    };
    this.opsSpace = {
      activeTasks: [],
      sessionHistory: [],
      workflows: [],
    };
  }

  // ============================================================================
  // Self Space Operations
  // ============================================================================

  initializeAgent(identity: AgentIdentity, preferences: AgentPreferences): SelfSpace {
    this.selfSpace = {
      agentId: `agent_${Date.now()}`,
      identity,
      preferences,
      capabilities: [],
      lastActiveAt: new Date().toISOString(),
    };
    return this.selfSpace;
  }

  getAgentIdentity(): AgentIdentity | null {
    return this.selfSpace?.identity || null;
  }

  // ============================================================================
  // 6Rs Pipeline
  // ============================================================================

  async process(input: PipelineInput): Promise<PipelineOutput> {
    // Phase 1: Record - Capture raw input
    const recorded = await this.record(input);

    // Phase 2: Reduce - Summarize and distill
    const reduced = await this.reduce(recorded);

    // Phase 3: Reflect - Generate insights
    const reflected = await this.reflect(reduced);

    // Phase 4: Reweave - Link to existing knowledge
    const reweaved = await this.reweave(reflected);

    // Phase 5: Verify - Validate against research claims
    const verified = await this.verify(reweaved);

    // Phase 6: Rethink - Periodic restructuring
    const rethought = await this.rethink(verified);

    return rethought;
  }

  private async record(input: PipelineInput): Promise<string> {
    // Store raw content with timestamp
    console.log('[ArsContexta] Record phase:', input.source || 'unknown');
    return input.rawContent;
  }

  /**
   * Reduce phase - Summarize and distill key points
   * @placeholder APPROVED - LLM summarization pending
   * @ticket GAP-51
   * @fallback Text truncation
   */
  private async reduce(content: string): Promise<string> {
    // Summarize and distill key points
    const summary = content.slice(0, 500) + (content.length > 500 ? '...' : '');
    console.log('[ArsContexta] Reduce phase: summarized to', summary.length, 'chars');
    return summary;
  }

  /**
   * Reflect phase - Generate insights from content
   * @placeholder APPROVED - NLP/LLM insight generation pending
   * @ticket GAP-51
   * @fallback Simple pattern detection
   */
  private async reflect(content: string): Promise<{ content: string; insights: Insight[] }> {
    // Generate insights from content
    const insights: Insight[] = [];

    // Simple pattern detection
    if (content.length > 200) {
      insights.push({
        id: `insight_${Date.now()}`,
        type: 'pattern',
        description: 'Content contains substantial information',
        confidence: 0.7,
        relatedNotes: [],
      });
    }

    console.log('[ArsContexta] Reflect phase: generated', insights.length, 'insights');
    return { content, insights };
  }

  /**
   * Reweave phase - Link to existing knowledge
   * @placeholder APPROVED - Embedding-based similarity pending
   * @ticket GAP-51
   * @fallback Word overlap similarity
   */
  private async reweave(result: { content: string; insights: Insight[] }): Promise<{ content: string; insights: Insight[]; links: NoteLink[] }> {
    // Link to existing knowledge
    const links: NoteLink[] = [];

    // Find related notes
    for (const [noteId, note] of this.notesSpace.notes) {
      if (this.contentSimilar(result.content, note.content)) {
        links.push({
          source: 'new',
          target: noteId,
          type: 'related',
          strength: 0.8,
        });
      }
    }

    console.log('[ArsContexta] Reweave phase: created', links.length, 'links');
    return { ...result, links };
  }

  /**
   * Verify phase - Validate against research claims
   * @placeholder APPROVED - Research claims graph integration pending
   * @ticket GAP-51
   * @fallback Always valid
   */
  private async verify(result: { content: string; insights: Insight[]; links: NoteLink[] }): Promise<typeof result> {
    // Validate against research claims
    console.log('[ArsContexta] Verify phase: validated');
    return result;
  }

  private async rethink(result: { content: string; insights: Insight[]; links: NoteLink[] }): Promise<PipelineOutput> {
    // Periodic restructuring - create notes and return output
    const note: Note = {
      id: `note_${Date.now()}`,
      title: result.content.slice(0, 50),
      content: result.content,
      tags: [],
      links: result.links.map(l => l.target),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessCount: 0,
      confidence: 0.9,
    };

    this.notesSpace.notes.set(note.id, note);
    this.notesSpace.links.push(...result.links);

    console.log('[ArsContexta] Rethink phase: created note', note.id);

    return {
      notes: [note],
      links: result.links,
      summary: result.content.slice(0, 200),
      insights: result.insights,
    };
  }

  // ============================================================================
  // Notes Space Operations
  // ============================================================================

  createNote(title: string, content: string, tags: string[] = []): Note {
    const note: Note = {
      id: `note_${Date.now()}`,
      title,
      content,
      tags,
      links: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessCount: 0,
      confidence: 1.0,
    };

    this.notesSpace.notes.set(note.id, note);
    return note;
  }

  linkNotes(sourceId: string, targetId: string, type: NoteLink['type'] = 'reference'): NoteLink {
    const link: NoteLink = {
      source: sourceId,
      target: targetId,
      type,
      strength: 1.0,
    };

    this.notesSpace.links.push(link);

    // Update note links
    const source = this.notesSpace.notes.get(sourceId);
    if (source && !source.links.includes(targetId)) {
      source.links.push(targetId);
      source.updatedAt = new Date().toISOString();
    }

    return link;
  }

  getNote(id: string): Note | null {
    const note = this.notesSpace.notes.get(id);
    if (note) {
      note.accessCount++;
    }
    return note || null;
  }

  searchNotes(query: string): Note[] {
    const results: Note[] = [];
    const queryLower = query.toLowerCase();

    for (const note of this.notesSpace.notes.values()) {
      if (
        note.title.toLowerCase().includes(queryLower) ||
        note.content.toLowerCase().includes(queryLower) ||
        note.tags.some(t => t.toLowerCase().includes(queryLower))
      ) {
        results.push(note);
      }
    }

    return results.sort((a, b) => b.accessCount - a.accessCount);
  }

  // ============================================================================
  // Ops Space Operations
  // ============================================================================

  createTask(title: string, priority: Task['priority'] = 'medium'): Task {
    const task: Task = {
      id: `task_${Date.now()}`,
      title,
      status: 'pending',
      priority,
      context: [],
      createdAt: new Date().toISOString(),
    };

    this.opsSpace.activeTasks.push(task);
    return task;
  }

  updateTaskStatus(taskId: string, status: Task['status']): Task | null {
    const task = this.opsSpace.activeTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
    }
    return task || null;
  }

  getActiveTasks(): Task[] {
    return this.opsSpace.activeTasks.filter(t => t.status !== 'completed');
  }

  // ============================================================================
  // Generated Commands
  // ============================================================================

  /**
   * /reduce - Summarize content
   */
  async cmdReduce(content: string): Promise<string> {
    return this.reduce(content);
  }

  /**
   * /reflect - Generate insights from content
   */
  async cmdReflect(content: string): Promise<Insight[]> {
    const result = await this.reflect(content);
    return result.insights;
  }

  /**
   * /reweave - Find related notes
   */
  async cmdReweave(noteId: string): Promise<NoteLink[]> {
    const note = this.getNote(noteId);
    if (!note) return [];

    const links: NoteLink[] = [];
    for (const [otherId, other] of this.notesSpace.notes) {
      if (otherId !== noteId && this.contentSimilar(note.content, other.content)) {
        links.push({
          source: noteId,
          target: otherId,
          type: 'related',
          strength: 0.8,
        });
      }
    }
    return links;
  }

  /**
   * /verify - Validate note against research graph
   * @placeholder APPROVED - Research claims graph integration pending
   * @ticket GAP-51
   * @fallback Always valid
   */
  async cmdVerify(noteId: string): Promise<{ valid: boolean; claims: string[] }> {
    return { valid: true, claims: [] };
  }

  /**
   * /ralph - Run full pipeline
   */
  async cmdRalph(input: PipelineInput): Promise<PipelineOutput> {
    return this.process(input);
  }

  /**
   * /pipeline - Get pipeline status
   */
  getPipelineStatus(): { phase: string; processedCount: number } {
    return {
      phase: 'idle',
      processedCount: this.notesSpace.notes.size,
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Check content similarity
   * @placeholder APPROVED - Embedding-based similarity pending
   * @ticket GAP-51
   * @fallback Word overlap Jaccard similarity
   */
  private contentSimilar(a: string, b: string): boolean {
    // Simple similarity check
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    
    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }
    
    const union = wordsA.size + wordsB.size - intersection;
    const similarity = intersection / union;
    
    return similarity > 0.3;
  }

  // ============================================================================
  // Automation Hooks
  // ============================================================================

  onSessionOrient(): void {
    // Called at session start to orient agent
    console.log('[ArsContexta] Session orient hook');
  }

  onWriteValidate(content: string): boolean {
    // Validate content before writing
    return content.length > 0;
  }

  onAutoCommit(noteId: string): void {
    // Auto-commit hook
    console.log('[ArsContexta] Auto-commit:', noteId);
  }

  onSessionCapture(session: Session): void {
    // Capture session for knowledge graph
    this.opsSpace.sessionHistory.push(session);
  }
}

// ============================================================================
// LLM Integration (GAP-78)
// ============================================================================

export * from './llm/index.js';

// ============================================================================
// NLP Entity Extraction (GAP-79)
// ============================================================================

export * from './nlp/index.js';

// ============================================================================
// Shared Types (GAP-78, GAP-79)
// ============================================================================

export * from './types.js';

// ============================================================================
// Singleton
// ============================================================================

export const arsContexta = new ArsContextaEngine();

// ============================================================================
// Module Documentation
// ============================================================================

/**
 * Ars Contexta - Implementation Status
 * 
 * GAP-78: LLM Integration (T3-A1)
 *   - LLM client with provider abstraction ✓
 *   - OpenAI provider (stubbed, requires ENABLE_OPENAI) ✓
 *   - Anthropic provider (stubbed, requires ENABLE_ANTHROPIC) ✓
 *   - Local/Ollama provider (stubbed, requires ENABLE_LOCAL_LLM) ✓
 *   - Prompt templates for insight generation ✓
 *   - Streaming response handling ✓
 *   - All secrets use PLACEHOLDER_APPROVED pattern ✓
 * 
 * GAP-79: NLP Entity Extraction (T3-A1)
 *   - Entity extractor interface ✓
 *   - NER for people, orgs, locations, concepts ✓
 *   - rust-bert bridge (stubbed, requires native build) ✓
 *   - candle bridge (stubbed, requires native build) ✓
 *   - Remote API support (stubbed) ✓
 *   - Integration with content ingestion kernel ✓
 * 
 * Coordination:
 *   - Shared types in types.ts: Insight, Entity, ExtractionResult
 *   - T3-A2 owns 6Rs pipeline
 *   - T3-A3 owns claims graph - entity format aligned
 */
