import type { ToolDefinition } from './types.js';
export type TextEditorCommand = 'view' | 'str_replace' | 'create' | 'insert' | 'undo' | 'undo_edit';
export interface TextEditorOptions {
    workspaceRoot?: string;
}
interface TextEditorInput {
    command: TextEditorCommand;
    path: string;
    file_text?: string;
    old_str?: string;
    new_str?: string;
    insert_line?: number;
    view_range?: [number, number];
}
export declare class TextEditorTool {
    private readonly root;
    private readonly history;
    constructor(options?: TextEditorOptions);
    definition(): ToolDefinition;
    execute(args: TextEditorInput): Promise<string>;
    private view;
    private undo;
    private remember;
    private readIfPresent;
    private workspacePath;
}
export {};
