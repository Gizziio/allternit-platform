/**
 * Answer Store
 *
 * In-memory store for form answers with versioning.
 */

import type { FormAnswer } from '../schema/FormSchema';

/**
 * Answer store interface
 */
export interface AnswerStore {
  /** Get answer by ID */
  get: (id: string) => FormAnswer | undefined;
  /** Get all answers for a form */
  getByForm: (formId: string) => FormAnswer[];
  /** Save answer */
  save: (answer: FormAnswer) => void;
  /** Delete answer */
  delete: (id: string) => boolean;
  /** Clear all answers */
  clear: () => void;
}

/**
 * In-memory answer store
 */
class InMemoryAnswerStore implements AnswerStore {
  private store: Map<string, FormAnswer> = new Map();

  get(id: string): FormAnswer | undefined {
    return this.store.get(id);
  }

  getByForm(formId: string): FormAnswer[] {
    return Array.from(this.store.values()).filter((a) => a.formId === formId);
  }

  save(answer: FormAnswer): void {
    this.store.set(answer.id, answer);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Global answer store instance
 */
let globalStore: AnswerStore | null = null;

/**
 * Get or create answer store
 */
export function getAnswerStore(): AnswerStore {
  if (!globalStore) {
    globalStore = new InMemoryAnswerStore();
  }
  return globalStore;
}

/**
 * Reset answer store
 */
export function resetAnswerStore(): void {
  globalStore = null;
}
