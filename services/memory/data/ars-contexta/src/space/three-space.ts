/**
 * Three-Space Architecture
 * GAP-78/GAP-79: Self Space, Notes Space, Ops Space
 * 
 * The three interconnected spaces of Ars Contexta:
 * 1. Self Space - Agent identity and persistent state
 * 2. Notes Space - Knowledge graph with wiki-links
 * 3. Ops Space - Operational coordination
 * 
 * WIH: GAP-78/GAP-79, Agent: T3-A4
 */

import type { Insight, Entity, Note, NoteLink, Task, Session } from '../types.js';

// ============================================================================
// Self Space - Agent Identity
// ============================================================================

export interface SelfSpace {
  agentId: string;
  identity: AgentIdentity;
  preferences: AgentPreferences;
  capabilities: string[];
  lastActiveAt: string;
  memory: WorkingMemory;
}

export interface AgentIdentity {
  name: string;
  role: string;
  specialty: string[];
  createdAt: string;
  version: string;
}

export interface AgentPreferences {
  communicationStyle: 'formal' | 'casual' | 'technical';
  detailLevel: 'brief' | 'balanced' | 'comprehensive';
  proactiveLevel: 1 | 2 | 3 | 4 | 5;
  preferredModel: string;
  enableTui: boolean;
  enableNotifications: boolean;
}

export interface WorkingMemory {
  recentTopics: string[];
  activeContexts: string[];
  pendingTasks: string[];
  lastSessionId?: string;
}

// ============================================================================
// Notes Space - Knowledge Graph
// ============================================================================

export interface NotesSpace {
  notes: Map<string, Note>;
  links: NoteLink[];
  mocs: Map<string, MapOfContent>;
  tags: Map<string, TagIndex>;
  graphStats: GraphStatistics;
}

export interface MapOfContent {
  id: string;
  title: string;
  level: 'hub' | 'domain' | 'topic';
  notes: string[];
  description: string;
  parentId?: string;
  children: string[];
}

export interface TagIndex {
  tag: string;
  notes: string[];
  frequency: number;
  relatedTags: string[];
}

export interface GraphStatistics {
  totalNotes: number;
  totalLinks: number;
  orphanedNotes: number;
  averageLinksPerNote: number;
  mostConnectedNotes: string[];
  lastUpdated: string;
}

// ============================================================================
// Ops Space - Operational Coordination
// ============================================================================

export interface OpsSpace {
  activeTasks: Task[];
  sessionHistory: Session[];
  workflows: Workflow[];
  automations: Automation[];
  scheduler: TaskScheduler;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger: WorkflowTrigger;
  active: boolean;
  lastRun?: string;
  runCount: number;
}

export interface WorkflowStep {
  order: number;
  action: 'ingest' | 'process' | 'generate' | 'notify' | 'link';
  template?: string;
  conditions?: string[];
  config?: Record<string, unknown>;
}

export type WorkflowTrigger =
  | { type: 'manual' }
  | { type: 'scheduled'; cron: string }
  | { type: 'event'; event: string }
  | { type: 'file'; pattern: string };

export interface Automation {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

export interface TaskScheduler {
  queue: ScheduledTask[];
  running: boolean;
  maxConcurrent: number;
}

export interface ScheduledTask {
  id: string;
  taskId: string;
  scheduledAt: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ============================================================================
// Three Space Implementation
// ============================================================================

export class ThreeSpaceArchitecture {
  private selfSpace: SelfSpace;
  private notesSpace: NotesSpace;
  private opsSpace: OpsSpace;

  constructor(agentConfig?: Partial<SelfSpace>) {
    this.selfSpace = this.initializeSelfSpace(agentConfig);
    this.notesSpace = this.initializeNotesSpace();
    this.opsSpace = this.initializeOpsSpace();
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  private initializeSelfSpace(config?: Partial<SelfSpace>): SelfSpace {
    const now = new Date().toISOString();
    
    return {
      agentId: config?.agentId || `agent_${Date.now()}`,
      identity: config?.identity || {
        name: 'Ars Contexta',
        role: 'Knowledge Assistant',
        specialty: ['note-taking', 'knowledge-graph', 'insight-generation'],
        createdAt: now,
        version: '1.0.0',
      },
      preferences: config?.preferences || {
        communicationStyle: 'casual',
        detailLevel: 'balanced',
        proactiveLevel: 3,
        preferredModel: 'gpt-4o-mini',
        enableTui: true,
        enableNotifications: false,
      },
      capabilities: config?.capabilities || [
        'entity-extraction',
        'insight-generation',
        'note-creation',
        'link-suggestion',
        'summarization',
      ],
      lastActiveAt: now,
      memory: {
        recentTopics: [],
        activeContexts: [],
        pendingTasks: [],
      },
    };
  }

  private initializeNotesSpace(): NotesSpace {
    return {
      notes: new Map(),
      links: [],
      mocs: new Map(),
      tags: new Map(),
      graphStats: {
        totalNotes: 0,
        totalLinks: 0,
        orphanedNotes: 0,
        averageLinksPerNote: 0,
        mostConnectedNotes: [],
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  private initializeOpsSpace(): OpsSpace {
    return {
      activeTasks: [],
      sessionHistory: [],
      workflows: [],
      automations: [],
      scheduler: {
        queue: [],
        running: false,
        maxConcurrent: 3,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Self Space Operations
  // -------------------------------------------------------------------------

  getSelfSpace(): SelfSpace {
    return { ...this.selfSpace };
  }

  updateIdentity(identity: Partial<AgentIdentity>): void {
    this.selfSpace.identity = { ...this.selfSpace.identity, ...identity };
    this.touch();
  }

  updatePreferences(preferences: Partial<AgentPreferences>): void {
    this.selfSpace.preferences = { ...this.selfSpace.preferences, ...preferences };
    this.touch();
  }

  addCapability(capability: string): void {
    if (!this.selfSpace.capabilities.includes(capability)) {
      this.selfSpace.capabilities.push(capability);
    }
  }

  updateWorkingMemory(update: Partial<WorkingMemory>): void {
    this.selfSpace.memory = { ...this.selfSpace.memory, ...update };
  }

  // -------------------------------------------------------------------------
  // Notes Space Operations
  // -------------------------------------------------------------------------

  getNotesSpace(): NotesSpace {
    return {
      ...this.notesSpace,
      notes: new Map(this.notesSpace.notes),
      mocs: new Map(this.notesSpace.mocs),
      tags: new Map(this.notesSpace.tags),
    };
  }

  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
    const now = new Date().toISOString();
    const newNote: Note = {
      ...note,
      id: `note_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    this.notesSpace.notes.set(newNote.id, newNote);
    this.updateGraphStats();
    this.indexNoteTags(newNote);
    
    return newNote;
  }

  getNote(id: string): Note | undefined {
    const note = this.notesSpace.notes.get(id);
    if (note) {
      note.accessCount++;
      note.updatedAt = new Date().toISOString();
    }
    return note;
  }

  updateNote(id: string, updates: Partial<Note>): Note | undefined {
    const note = this.notesSpace.notes.get(id);
    if (!note) return undefined;

    const updated = { ...note, ...updates, updatedAt: new Date().toISOString() };
    this.notesSpace.notes.set(id, updated);
    
    if (updates.tags) {
      this.indexNoteTags(updated);
    }
    
    return updated;
  }

  deleteNote(id: string): boolean {
    // Remove links to/from this note
    this.notesSpace.links = this.notesSpace.links.filter(
      l => l.source !== id && l.target !== id
    );
    
    // Remove from MOCs
    this.notesSpace.mocs.forEach(moc => {
      moc.notes = moc.notes.filter(n => n !== id);
    });
    
    return this.notesSpace.notes.delete(id);
  }

  createLink(sourceId: string, targetId: string, type: NoteLink['type'] = 'reference'): NoteLink {
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
    }

    this.updateGraphStats();
    return link;
  }

  createMoc(moc: Omit<MapOfContent, 'id' | 'children'>): MapOfContent {
    const newMoc: MapOfContent = {
      ...moc,
      id: `moc_${Date.now()}`,
      children: [],
    };

    this.notesSpace.mocs.set(newMoc.id, newMoc);
    
    // Update parent if specified
    if (moc.parentId) {
      const parent = this.notesSpace.mocs.get(moc.parentId);
      if (parent) {
        parent.children.push(newMoc.id);
      }
    }

    return newMoc;
  }

  searchNotes(query: string): Note[] {
    const lower = query.toLowerCase();
    return Array.from(this.notesSpace.notes.values()).filter(note =>
      note.title.toLowerCase().includes(lower) ||
      note.content.toLowerCase().includes(lower) ||
      note.tags.some(t => t.toLowerCase().includes(lower))
    );
  }

  getOrphanedNotes(): Note[] {
    const linkedIds = new Set(this.notesSpace.links.map(l => l.target));
    linkedIds.add(...this.notesSpace.links.map(l => l.source));
    
    return Array.from(this.notesSpace.notes.values()).filter(
      n => !linkedIds.has(n.id) && n.links.length === 0
    );
  }

  // -------------------------------------------------------------------------
  // Ops Space Operations
  // -------------------------------------------------------------------------

  getOpsSpace(): OpsSpace {
    return {
      ...this.opsSpace,
      activeTasks: [...this.opsSpace.activeTasks],
      sessionHistory: [...this.opsSpace.sessionHistory],
    };
  }

  createTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.opsSpace.activeTasks.push(newTask);
    this.selfSpace.memory.pendingTasks.push(newTask.id);
    
    return newTask;
  }

  updateTaskStatus(taskId: string, status: Task['status']): Task | undefined {
    const task = this.opsSpace.activeTasks.find(t => t.id === taskId);
    if (!task) return undefined;

    task.status = status;

    if (status === 'completed') {
      // Remove from pending
      this.selfSpace.memory.pendingTasks =
        this.selfSpace.memory.pendingTasks.filter(id => id !== taskId);
    }

    return task;
  }

  startSession(): Session {
    const session: Session = {
      id: `session_${Date.now()}`,
      startedAt: new Date().toISOString(),
      notesCreated: [],
      tasksCompleted: [],
      summary: '',
    };

    this.opsSpace.sessionHistory.push(session);
    this.selfSpace.memory.lastSessionId = session.id;
    
    return session;
  }

  endSession(sessionId: string, summary: string): Session | undefined {
    const session = this.opsSpace.sessionHistory.find(s => s.id === sessionId);
    if (!session) return undefined;

    session.endedAt = new Date().toISOString();
    session.summary = summary;

    return session;
  }

  createWorkflow(workflow: Omit<Workflow, 'id' | 'runCount'>): Workflow {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `workflow_${Date.now()}`,
      runCount: 0,
    };

    this.opsSpace.workflows.push(newWorkflow);
    return newWorkflow;
  }

  createAutomation(automation: Omit<Automation, 'id' | 'triggerCount'>): Automation {
    const newAutomation: Automation = {
      ...automation,
      id: `automation_${Date.now()}`,
      triggerCount: 0,
    };

    this.opsSpace.automations.push(newAutomation);
    return newAutomation;
  }

  getActiveTasks(): Task[] {
    return this.opsSpace.activeTasks.filter(t => t.status !== 'completed');
  }

  // -------------------------------------------------------------------------
  // Cross-Space Operations
  // -------------------------------------------------------------------------

  /**
   * Ingest content through full pipeline (all 3 spaces)
   */
  async ingestContent(
    content: string,
    options: {
      generateInsights?: boolean;
      extractEntities?: boolean;
      createTask?: boolean;
    } = {}
  ): Promise<{ note: Note; insights: Insight[]; entities: Entity[] }> {
    // This would integrate with T3-A1 (LLM/NLP) and T3-A2 (6Rs)
    // For now, create basic note
    
    const note = this.createNote({
      title: content.slice(0, 50),
      content,
      tags: ['ingested'],
      links: [],
      confidence: 1.0,
    });

    if (options.createTask) {
      this.createTask({
        title: `Process: ${note.title}`,
        status: 'pending',
        priority: 'medium',
        context: [note.id],
      });
    }

    return {
      note,
      insights: [],
      entities: [],
    };
  }

  /**
   * Get system state across all spaces
   */
  getSystemState(): {
    self: SelfSpace;
    notes: GraphStatistics;
    ops: { taskCount: number; activeWorkflows: number };
  } {
    return {
      self: this.getSelfSpace(),
      notes: this.notesSpace.graphStats,
      ops: {
        taskCount: this.opsSpace.activeTasks.length,
        activeWorkflows: this.opsSpace.workflows.filter(w => w.active).length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private touch(): void {
    this.selfSpace.lastActiveAt = new Date().toISOString();
  }

  private updateGraphStats(): void {
    const notes = Array.from(this.notesSpace.notes.values());
    const totalLinks = this.notesSpace.links.length;
    
    this.notesSpace.graphStats = {
      totalNotes: notes.length,
      totalLinks,
      orphanedNotes: this.getOrphanedNotes().length,
      averageLinksPerNote: notes.length > 0 ? totalLinks / notes.length : 0,
      mostConnectedNotes: notes
        .sort((a, b) => b.links.length - a.links.length)
        .slice(0, 5)
        .map(n => n.id),
      lastUpdated: new Date().toISOString(),
    };
  }

  private indexNoteTags(note: Note): void {
    for (const tag of note.tags) {
      const index = this.notesSpace.tags.get(tag) || {
        tag,
        notes: [],
        frequency: 0,
        relatedTags: [],
      };

      if (!index.notes.includes(note.id)) {
        index.notes.push(note.id);
        index.frequency++;
      }

      // Find related tags
      for (const otherTag of note.tags) {
        if (otherTag !== tag && !index.relatedTags.includes(otherTag)) {
          index.relatedTags.push(otherTag);
        }
      }

      this.notesSpace.tags.set(tag, index);
    }
  }
}

// Export all types
export type {
  SelfSpace,
  AgentIdentity,
  AgentPreferences,
  WorkingMemory,
  NotesSpace,
  MapOfContent,
  TagIndex,
  GraphStatistics,
  OpsSpace,
  Workflow,
  WorkflowStep,
  WorkflowTrigger,
  Automation,
  TaskScheduler,
  ScheduledTask,
};
