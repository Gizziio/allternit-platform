/**
 * Orca Markdown Editor Types
 * 
 * Block-based markdown editor types inspired by Notion
 */

export type BlockType =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'bullet-list'
  | 'numbered-list'
  | 'todo'
  | 'code'
  | 'quote'
  | 'divider'
  | 'image'
  | 'table'
  | 'callout'
  | 'toggle'
  | 'embed'
  | 'math';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  props?: Record<string, any>;
  children?: Block[];
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  author?: string;
  tags?: string[];
  icon?: string;
  cover?: string;
  properties?: Record<string, any>;
}

export interface DocumentFile {
  id: string;
  name: string;
  type: 'document' | 'folder';
  path: string;
  parentId?: string | null;
  children?: DocumentFile[];
  documentId?: string;
  isOpen?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpenTab {
  id: string;
  documentId: string;
  title: string;
  path: string;
  isModified: boolean;
  isActive: boolean;
}

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  blockType: BlockType;
  shortcut?: string;
}

export interface EditorState {
  blocks: Block[];
  selection: Selection | null;
  isDragging: boolean;
  isComposing: boolean;
  lastSaved: string | null;
}

export interface Selection {
  blockId: string;
  start: number;
  end: number;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'heading-1', label: 'Heading 1', description: 'Large section heading', icon: 'H1', blockType: 'heading-1', shortcut: '# ' },
  { id: 'heading-2', label: 'Heading 2', description: 'Medium section heading', icon: 'H2', blockType: 'heading-2', shortcut: '## ' },
  { id: 'heading-3', label: 'Heading 3', description: 'Small section heading', icon: 'H3', blockType: 'heading-3', shortcut: '### ' },
  { id: 'bullet-list', label: 'Bullet List', description: 'Create a simple bulleted list', icon: 'List', blockType: 'bullet-list', shortcut: '- ' },
  { id: 'numbered-list', label: 'Numbered List', description: 'Create a numbered list', icon: 'ListNumbers', blockType: 'numbered-list', shortcut: '1. ' },
  { id: 'todo', label: 'To-do List', description: 'Track tasks with checkboxes', icon: 'CheckSquare', blockType: 'todo', shortcut: '[] ' },
  { id: 'code', label: 'Code Block', description: 'Capture code snippets', icon: 'Code', blockType: 'code', shortcut: '```' },
  { id: 'quote', label: 'Quote', description: 'Capture a quote', icon: 'Quotes', blockType: 'quote', shortcut: '> ' },
  { id: 'callout', label: 'Callout', description: 'Make writing stand out', icon: 'Info', blockType: 'callout' },
  { id: 'divider', label: 'Divider', description: 'Visually divide sections', icon: 'Minus', blockType: 'divider', shortcut: '---' },
  { id: 'table', label: 'Table', description: 'Add a simple table', icon: 'Table', blockType: 'table' },
  { id: 'math', label: 'Math Equation', description: 'Add a LaTeX equation', icon: 'Function', blockType: 'math' },
];

export interface EditorProps {
  document: Document;
  onChange: (document: Document) => void;
  onSave?: (document: Document) => void;
  readOnly?: boolean;
  plugins?: EditorPlugin[];
}

export interface EditorPlugin {
  id: string;
  name: string;
  renderBlock?: (block: Block, onChange: (block: Block) => void) => React.ReactNode;
  renderToolbar?: (editor: EditorAPI) => React.ReactNode;
  onKeyDown?: (event: React.KeyboardEvent, editor: EditorAPI) => boolean;
}

export interface EditorAPI {
  insertBlock: (type: BlockType, afterId?: string) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
  focusBlock: (id: string, position?: 'start' | 'end') => void;
  getBlock: (id: string) => Block | undefined;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  convertBlock: (id: string, type: BlockType) => void;
}

export interface FileSystemAdapter {
  readFile: (path: string) => Promise<Document>;
  writeFile: (path: string, document: Document) => Promise<void>;
  listFiles: (path?: string) => Promise<DocumentFile[]>;
  createFile: (name: string, parentPath?: string) => Promise<DocumentFile>;
  createFolder: (name: string, parentPath?: string) => Promise<DocumentFile>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  moveFile: (path: string, newParentPath: string) => Promise<void>;
}
