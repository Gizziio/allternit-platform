import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
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

export class TextEditorTool {
  private readonly root: string;
  private readonly history = new Map<string, Array<string | undefined>>();

  constructor(options: TextEditorOptions = {}) {
    this.root = resolve(options.workspaceRoot ?? process.cwd());
  }

  definition(): ToolDefinition {
    return {
      name: 'str_replace_editor',
      description: 'View and edit text files within the active workspace.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', enum: ['view', 'str_replace', 'create', 'insert', 'undo', 'undo_edit'] },
          path: { type: 'string', description: 'Absolute or workspace-relative file path' },
          file_text: { type: 'string', description: 'Contents for create' },
          old_str: { type: 'string', description: 'Unique text to replace' },
          new_str: { type: 'string', description: 'Replacement text' },
          insert_line: { type: 'integer', description: 'Zero-based line after which to insert' },
          view_range: { type: 'array', items: { type: 'integer' }, description: 'One-based inclusive [start, end] line range' },
        },
        required: ['command', 'path'],
      },
      metadata: { category: 'filesystem', isDestructive: true, anthropicType: 'text_editor_20250124' },
      execute: (args: TextEditorInput) => this.execute(args),
    };
  }

  async execute(args: TextEditorInput): Promise<string> {
    const path = await this.workspacePath(args.path, args.command === 'create');
    if (args.command === 'view') return this.view(path, args.view_range);
    if (args.command === 'undo' || args.command === 'undo_edit') return this.undo(path);

    const previous = await this.readIfPresent(path);
    let next: string;
    if (args.command === 'create') {
      if (previous !== undefined) throw new Error(`File already exists: ${args.path}`);
      next = requiredString(args.file_text, 'file_text');
    } else if (args.command === 'str_replace') {
      if (previous === undefined) throw new Error(`File does not exist: ${args.path}`);
      const oldText = requiredString(args.old_str, 'old_str');
      const occurrences = previous.split(oldText).length - 1;
      if (occurrences !== 1) throw new Error(`old_str must match exactly once; found ${occurrences} matches`);
      next = previous.replace(oldText, args.new_str ?? '');
    } else {
      if (previous === undefined) throw new Error(`File does not exist: ${args.path}`);
      if (!Number.isInteger(args.insert_line) || args.insert_line! < 0) throw new Error('insert_line must be a non-negative integer');
      const lines = previous.split('\n');
      if (args.insert_line! > lines.length) throw new Error(`insert_line exceeds file length (${lines.length})`);
      lines.splice(args.insert_line!, 0, requiredString(args.new_str, 'new_str'));
      next = lines.join('\n');
    }

    this.remember(path, previous);
    await writeFile(path, next, 'utf8');
    return `Updated ${relative(this.root, path)}`;
  }

  private async view(path: string, range?: [number, number]): Promise<string> {
    const content = await readFile(path, 'utf8');
    const lines = content.split('\n');
    const start = range?.[0] ?? 1;
    const end = range?.[1] === -1 || range?.[1] === undefined ? lines.length : range[1];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error('view_range must be [start, end] with one-based line numbers');
    return lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join('\n');
  }

  private async undo(path: string): Promise<string> {
    const history = this.history.get(path);
    if (!history?.length) throw new Error(`No edit to undo for ${relative(this.root, path)}`);
    const previous = history.pop();
    if (previous === undefined) {
      const { unlink } = await import('node:fs/promises');
      await unlink(path);
    } else {
      await writeFile(path, previous, 'utf8');
    }
    return `Undid last edit to ${relative(this.root, path)}`;
  }

  private remember(path: string, content: string | undefined): void {
    const history = this.history.get(path) ?? [];
    history.push(content);
    this.history.set(path, history);
  }

  private async readIfPresent(path: string): Promise<string | undefined> {
    try { return await readFile(path, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private async workspacePath(input: string, allowMissing: boolean): Promise<string> {
    if (!input) throw new Error('path must be non-empty');
    const candidate = resolve(this.root, isAbsolute(input) ? relative(this.root, input) : input);
    assertContained(this.root, candidate);
    try {
      const resolved = await realpath(candidate);
      assertContained(await realpath(this.root), resolved);
      const info = await stat(resolved);
      if (!info.isFile()) throw new Error(`Path is not a file: ${input}`);
      return resolved;
    } catch (error) {
      if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const resolvedParent = await realpath(dirname(candidate));
      assertContained(await realpath(this.root), resolvedParent);
      return candidate;
    }
  }
}

function assertContained(root: string, path: string): void {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error('Text editor path must stay within the active workspace');
  }
}

function requiredString(value: string | undefined, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} is required`);
  return value;
}
