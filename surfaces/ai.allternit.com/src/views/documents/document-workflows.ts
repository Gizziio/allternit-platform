import type { EditorPackId } from './editor-packs';

export type DocumentHost = 'word' | 'excel' | 'powerpoint' | EditorPackId;
export type DocumentOperationRisk = 'read' | 'write' | 'external';

export interface DocumentWorkflowStep {
  id: string;
  host: DocumentHost;
  instruction: string;
  capability: string;
  risk: DocumentOperationRisk;
  requiresApproval: boolean;
  verification: string;
}

export interface DocumentWorkflowDraft {
  id: string;
  name: string;
  host: DocumentHost;
  createdAt: string;
  runCount: number;
  steps: DocumentWorkflowStep[];
}

const KEY = 'allternit.document-workflow-drafts.v1';
const PROMOTED_KEY = 'allternit.document-workflows.v1';

function read(): DocumentWorkflowDraft[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as DocumentWorkflowDraft[]; } catch { return []; }
}

export function recordDocumentWorkflowIntent(host: DocumentHost, instruction: string): DocumentWorkflowDraft {
  const drafts = read();
  const normalized = instruction.trim().toLowerCase();
  const existing = drafts.find((draft) => draft.host === host && draft.name.toLowerCase() === normalized);
  if (existing) existing.runCount += 1;
  const draft = existing ?? {
    id: crypto.randomUUID(), name: instruction.trim(), host, createdAt: new Date().toISOString(), runCount: 1,
    steps: [{ id: crypto.randomUUID(), host, instruction: instruction.trim(), capability: `${host}.active-context`, risk: 'read', requiresApproval: false, verification: 'Confirm the active document still matches the requested host and report the observed result.' }],
  } satisfies DocumentWorkflowDraft;
  if (!existing) drafts.push(draft);
  localStorage.setItem(KEY, JSON.stringify(drafts));
  return draft;
}

export function listDocumentWorkflowDrafts(): DocumentWorkflowDraft[] { return read(); }

export function listPromotedDocumentWorkflows(): DocumentWorkflowDraft[] {
  try { return JSON.parse(localStorage.getItem(PROMOTED_KEY) || '[]') as DocumentWorkflowDraft[]; } catch { return []; }
}

export function promoteDocumentWorkflow(id: string): DocumentWorkflowDraft | null {
  const draft = read().find((item) => item.id === id);
  if (!draft) return null;
  const promoted = listPromotedDocumentWorkflows();
  localStorage.setItem(PROMOTED_KEY, JSON.stringify([draft, ...promoted.filter((item) => item.id !== id)]));
  window.dispatchEvent(new CustomEvent('allternit:document-workflows-changed'));
  return draft;
}
