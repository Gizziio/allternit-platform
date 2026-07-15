export type EditorPackId = 'documents' | 'sheets' | 'presentations';

export interface EditorPackDefinition {
  id: EditorPackId;
  name: string;
  description: string;
  formats: string[];
  accent: string;
  load: () => Promise<{ default: ComponentType<{ documentId: string; onClose: () => void }> }>;
}

export const EDITOR_PACKS: Record<EditorPackId, EditorPackDefinition> = {
  documents: {
    id: 'documents',
    name: 'Allternit Documents',
    description: 'Local-first writing and structured document editing.',
    formats: ['.docx', '.altdoc', '.txt', '.md'],
    accent: '#2B579A',
    load: () => import('./packs/DocumentEditorPack'),
  },
  sheets: {
    id: 'sheets',
    name: 'Allternit Sheets',
    description: 'A lightweight grid for tables, calculations, and agent operations.',
    formats: ['.xlsx', '.altsheet', '.csv'],
    accent: '#217346',
    load: () => import('./packs/SheetEditorPack'),
  },
  presentations: {
    id: 'presentations',
    name: 'Allternit Presentations',
    description: 'Narrative-first slide drafting without loading an editor at startup.',
    formats: ['.pptx', '.altdeck'],
    accent: '#D24726',
    load: () => import('./packs/PresentationEditorPack'),
  },
};

export function editorPackStorageKey(pack: EditorPackId, documentId: string) {
  return `allternit.editor-pack.${pack}.${documentId}`;
}
import type { ComponentType } from 'react';
