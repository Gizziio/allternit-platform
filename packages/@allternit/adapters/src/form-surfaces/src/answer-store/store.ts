/**
 * Answer Store
 * 
 * Data layer for form answers with versioning and locking.
 */

import type { FormAnswer, AnswerEdit, AnswerMetadata } from '../schema/FormSchema';

const STORAGE_KEY = 'allternit_form_answers';

/**
 * Answer Store interface
 */
export interface AnswerStore {
  /** Create new answer */
  create(formId: string, values: Record<string, unknown>, source?: string): FormAnswer;
  /** Get answer by ID */
  get(answerId: string): FormAnswer | undefined;
  /** Update answer */
  update(answerId: string, values: Record<string, unknown>, editedBy?: string): FormAnswer;
  /** Delete answer */
  delete(answerId: string): void;
  /** List answers (optionally filtered by formId) */
  list(formId?: string): FormAnswer[];
  /** Lock fields in answer */
  lock(answerId: string, fieldIds: string[]): FormAnswer;
  /** Unlock fields in answer */
  unlock(answerId: string, fieldIds: string[]): FormAnswer;
  /** Export answer */
  export(answerId: string, format: 'json' | 'markdown'): string;
  /** Import answer */
  import(data: string, format: 'json'): FormAnswer;
}

/**
 * In-memory answer store with localStorage persistence
 */
class AnswerStoreImpl implements AnswerStore {
  private answers: Map<string, FormAnswer> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  create(formId: string, values: Record<string, unknown>, source?: string): FormAnswer {
    const id = `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const answer: FormAnswer = {
      id,
      formId,
      values,
      version: 1,
      createdAt: now,
      updatedAt: now,
      locks: [],
      metadata: {
        source,
        versionCount: 1,
        editHistory: [],
      },
    };

    this.answers.set(id, answer);
    this.saveToStorage();
    return answer;
  }

  get(answerId: string): FormAnswer | undefined {
    return this.answers.get(answerId);
  }

  update(answerId: string, values: Record<string, unknown>, editedBy?: string): FormAnswer {
    const existing = this.answers.get(answerId);
    if (!existing) {
      throw new Error(`Answer not found: ${answerId}`);
    }

    // Check locks
    const changedLockedFields = Object.keys(values).filter(
      (key) => existing.locks.includes(key) && values[key] !== existing.values[key]
    );
    
    if (changedLockedFields.length > 0) {
      throw new Error(`Cannot update locked fields: ${changedLockedFields.join(', ')}`);
    }

    // Record changes
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== existing.values[key]) {
        changes[key] = { from: existing.values[key], to: value };
      }
    }

    const edit: AnswerEdit = {
      timestamp: new Date(),
      editedBy,
      changes,
    };

    const updated: FormAnswer = {
      ...existing,
      values,
      version: existing.version + 1,
      updatedAt: new Date(),
      metadata: {
        ...existing.metadata,
        lastEditedBy: editedBy,
        versionCount: (existing.metadata?.versionCount || 1) + 1,
        editHistory: [...(existing.metadata?.editHistory || []), edit],
      },
    };

    this.answers.set(answerId, updated);
    this.saveToStorage();
    return updated;
  }

  delete(answerId: string): void {
    this.answers.delete(answerId);
    this.saveToStorage();
  }

  list(formId?: string): FormAnswer[] {
    const all = Array.from(this.answers.values());
    if (formId) {
      return all.filter((a) => a.formId === formId);
    }
    return all;
  }

  lock(answerId: string, fieldIds: string[]): FormAnswer {
    const existing = this.answers.get(answerId);
    if (!existing) {
      throw new Error(`Answer not found: ${answerId}`);
    }

    const updated: FormAnswer = {
      ...existing,
      locks: [...new Set([...existing.locks, ...fieldIds])],
      updatedAt: new Date(),
    };

    this.answers.set(answerId, updated);
    this.saveToStorage();
    return updated;
  }

  unlock(answerId: string, fieldIds: string[]): FormAnswer {
    const existing = this.answers.get(answerId);
    if (!existing) {
      throw new Error(`Answer not found: ${answerId}`);
    }

    const updated: FormAnswer = {
      ...existing,
      locks: existing.locks.filter((id) => !fieldIds.includes(id)),
      updatedAt: new Date(),
    };

    this.answers.set(answerId, updated);
    this.saveToStorage();
    return updated;
  }

  export(answerId: string, format: 'json' | 'markdown'): string {
    const answer = this.answers.get(answerId);
    if (!answer) {
      throw new Error(`Answer not found: ${answerId}`);
    }

    if (format === 'json') {
      return JSON.stringify(answer, null, 2);
    }

    // Markdown format
    const lines = [
      '# Form Answer',
      '',
      `**Form ID:** ${answer.formId}`,
      `**Answer ID:** ${answer.id}`,
      `**Version:** ${answer.version}`,
      `**Created:** ${answer.createdAt.toISOString()}`,
      `**Updated:** ${answer.updatedAt.toISOString()}`,
      '',
      '## Values',
      '',
    ];

    for (const [key, value] of Object.entries(answer.values)) {
      lines.push(`### ${key}`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (answer.locks.length > 0) {
      lines.push('## Locked Fields');
      lines.push('');
      answer.locks.forEach((field) => lines.push(`- ${field}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  import(data: string, format: 'json'): FormAnswer {
    if (format === 'json') {
      const parsed = JSON.parse(data) as FormAnswer;
      
      // Validate required fields
      if (!parsed.id || !parsed.formId || !parsed.values) {
        throw new Error('Invalid answer data: missing required fields');
      }

      // Convert dates
      const answer: FormAnswer = {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };

      this.answers.set(answer.id, answer);
      this.saveToStorage();
      return answer;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as FormAnswer[];
        parsed.forEach((answer) => {
          this.answers.set(answer.id, {
            ...answer,
            createdAt: new Date(answer.createdAt),
            updatedAt: new Date(answer.updatedAt),
          });
        });
      }
    } catch (error) {
      console.error('Failed to load answers from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const data = JSON.stringify(Array.from(this.answers.values()));
      localStorage.setItem(STORAGE_KEY, data);
    } catch (error) {
      console.error('Failed to save answers to storage:', error);
    }
  }
}

// Global instance
let globalStore: AnswerStore | null = null;

export function getAnswerStore(): AnswerStore {
  if (!globalStore) {
    globalStore = new AnswerStoreImpl();
  }
  return globalStore;
}

export function resetAnswerStore(): void {
  globalStore = null;
}

export { AnswerStoreImpl };
