/**
 * Orca Markdown Editor
 * 
 * A Notion-style block-based markdown editor for the Allternit platform.
 * Integrated into the PluginManager file viewer.
 */

export { OrcaEditor } from './OrcaEditor';
export { BlockRenderer } from './BlockRenderer';
export { SlashCommandMenu } from './SlashCommandMenu';
export { FileTree } from './FileTree';
export { TabBar } from './TabBar';

export type {
  Block,
  BlockType,
  Document,
  DocumentMetadata,
  DocumentFile,
  OpenTab,
  SlashCommand,
  EditorState,
  Selection,
  EditorProps,
  EditorPlugin,
  EditorAPI,
  FileSystemAdapter,
} from './types';

export { SLASH_COMMANDS } from './types';

// Utility functions
export const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
