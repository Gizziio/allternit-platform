/**
 * Agent Template Storage
 * 
 * Manages agent configuration templates with localStorage persistence.
 * Users can save agent configurations as templates and reuse them.
 */

import type { AgentTemplate, AgentRole } from '../types';

const STORAGE_KEY = 'allternit_agent_templates';

interface StoredTemplates {
  version: number;
  templates: AgentTemplate[];
}

const DEFAULT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'default-orchestrator',
    name: 'Orchestrator',
    description: 'Central coordinator for multi-agent workflows',
    role: 'orchestrator',
    model: 'gpt-4o',
    capabilities: ['coordination', 'planning', 'task-distribution'],
    config: {
      temperature: 0.3,
      maxTokens: 4000,
    },
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-worker',
    name: 'General Worker',
    description: 'Versatile agent for general-purpose tasks',
    role: 'worker',
    model: 'gpt-4o-mini',
    capabilities: ['code-generation', 'analysis', 'refactoring'],
    config: {
      temperature: 0.5,
      maxTokens: 2000,
    },
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-specialist',
    name: 'Code Specialist',
    description: 'Specialized in deep code analysis and optimization',
    role: 'specialist',
    model: 'claude-3-sonnet',
    capabilities: ['code-review', 'optimization', 'architecture'],
    config: {
      temperature: 0.2,
      maxTokens: 4000,
    },
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-reviewer',
    name: 'Quality Reviewer',
    description: 'Focuses on code quality and security review',
    role: 'reviewer',
    model: 'gpt-4o',
    capabilities: ['security-review', 'quality-check', 'best-practices'],
    config: {
      temperature: 0.1,
      maxTokens: 3000,
    },
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
];

class TemplateStorage {
  private templates: Map<string, AgentTemplate> = new Map();
  private listeners: Set<(templates: AgentTemplate[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
    
    // Add default templates if none exist
    if (this.templates.size === 0) {
      DEFAULT_TEMPLATES.forEach(t => this.templates.set(t.id, t));
      this.saveToStorage();
    }
  }

  /**
   * Get all templates
   */
  getAll(): AgentTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get templates by role
   */
  getByRole(role: AgentRole): AgentTemplate[] {
    return this.getAll().filter(t => t.role === role);
  }

  /**
   * Get a single template by ID
   */
  getById(id: string): AgentTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Create a new template from an existing agent
   */
  createFromAgent(
    name: string,
    description: string,
    agent: {
      role: AgentRole;
      model: string;
      capabilities: string[];
      config?: Record<string, unknown>;
    }
  ): AgentTemplate {
    const template: AgentTemplate = {
      id: `template-${Date.now()}`,
      name,
      description,
      role: agent.role,
      model: agent.model,
      capabilities: [...agent.capabilities],
      config: agent.config || {},
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    this.templates.set(template.id, template);
    this.saveToStorage();
    this.notifyListeners();

    return template;
  }

  /**
   * Create a new template from scratch
   */
  create(template: Omit<AgentTemplate, 'id' | 'createdAt' | 'usageCount'>): AgentTemplate {
    const newTemplate: AgentTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    this.templates.set(newTemplate.id, newTemplate);
    this.saveToStorage();
    this.notifyListeners();

    return newTemplate;
  }

  /**
   * Update an existing template
   */
  update(id: string, updates: Partial<Omit<AgentTemplate, 'id' | 'createdAt'>>): AgentTemplate | null {
    const existing = this.templates.get(id);
    if (!existing) return null;

    const updated: AgentTemplate = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation date
    };

    this.templates.set(id, updated);
    this.saveToStorage();
    this.notifyListeners();

    return updated;
  }

  /**
   * Delete a template
   */
  delete(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.saveToStorage();
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Increment usage count for a template
   */
  recordUsage(id: string): void {
    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Duplicate a template
   */
  duplicate(id: string, newName?: string): AgentTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const duplicated: AgentTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: newName || `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    this.templates.set(duplicated.id, duplicated);
    this.saveToStorage();
    this.notifyListeners();

    return duplicated;
  }

  /**
   * Import templates from JSON
   */
  importFromJSON(json: string): { success: number; failed: number } {
    try {
      const data = JSON.parse(json);
      const templates = Array.isArray(data) ? data : data.templates;
      
      let success = 0;
      let failed = 0;

      templates.forEach((t: Partial<AgentTemplate>) => {
        try {
          if (t.name && t.role && t.model) {
            this.create(t as Omit<AgentTemplate, 'id' | 'createdAt' | 'usageCount'>);
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      });

      return { success, failed };
    } catch {
      return { success: 0, failed: 1 };
    }
  }

  /**
   * Export templates to JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      templates: this.getAll(),
    }, null, 2);
  }

  /**
   * Search templates
   */
  search(query: string): AgentTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.role.toLowerCase().includes(lowerQuery) ||
      t.capabilities.some(c => c.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback: (templates: AgentTemplate[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this.templates.clear();
    DEFAULT_TEMPLATES.forEach(t => this.templates.set(t.id, t));
    this.saveToStorage();
    this.notifyListeners();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredTemplates = JSON.parse(stored);
        this.templates = new Map(parsed.templates.map(t => [t.id, t]));
      }
    } catch {
      this.templates = new Map();
    }
  }

  private saveToStorage(): void {
    try {
      const toStore: StoredTemplates = {
        version: 1,
        templates: this.getAll(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignore storage errors
    }
  }

  private notifyListeners(): void {
    const templates = this.getAll();
    this.listeners.forEach(cb => cb(templates));
  }
}

// Singleton instance
export const templateStorage = new TemplateStorage();
