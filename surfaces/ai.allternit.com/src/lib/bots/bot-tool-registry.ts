/**
 * Bot tool registry — the real allowlist options offered on the Create Bot
 * path. These are the platform's native tool-belt primitives (see
 * docs/public/tools/tool-belt.md); a bot's `allowedTools` is chosen from this
 * list, not free-typed theater.
 */

export interface BotToolOption {
  id: string;
  label: string;
  description: string;
}

export const BOT_NATIVE_TOOLS: BotToolOption[] = [
  {
    id: 'web_search',
    label: 'Web search',
    description: 'Search the web for current information.',
  },
  {
    id: 'web_fetch',
    label: 'Web fetch',
    description: 'Fetch and read a page by URL.',
  },
  {
    id: 'file_read',
    label: 'File read',
    description: 'Read files from the workspace.',
  },
  {
    id: 'file_write',
    label: 'File write',
    description: 'Create and edit files in the workspace.',
  },
  {
    id: 'code_execution',
    label: 'Code execution',
    description: 'Run code against workspace data.',
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'Read and write long-term memory.',
  },
  {
    id: 'str_replace_editor',
    label: 'Editor',
    description: 'Precise string-replacement file edits.',
  },
  {
    id: 'computer',
    label: 'Computer',
    description: 'Drive the bot\'s persistent Computer Cloud desktop.',
  },
];

/** Sensible default allowlist per bot category, applied by start templates. */
export const BOT_CATEGORY_DEFAULT_TOOLS: Record<string, string[]> = {
  research: ['web_search', 'web_fetch', 'memory'],
  code: ['file_read', 'file_write', 'code_execution', 'str_replace_editor'],
  writing: ['file_read', 'file_write', 'web_search'],
  data: ['file_read', 'file_write', 'code_execution'],
  sales: ['web_search', 'web_fetch', 'memory'],
  design: ['file_read', 'file_write', 'web_search'],
  ops: ['web_search', 'memory', 'computer'],
  custom: ['web_search', 'file_read', 'file_write'],
};

export function toggleBotTool(allowedTools: string[], toolId: string): string[] {
  return allowedTools.includes(toolId)
    ? allowedTools.filter((t) => t !== toolId)
    : [...allowedTools, toolId];
}
