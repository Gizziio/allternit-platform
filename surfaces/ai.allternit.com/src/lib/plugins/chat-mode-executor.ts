/**
 * Chat Mode Executor
 * 
 * Connects mode selection in chat to plugin execution.
 * When a user sends a message with a mode selected, this executor
 * routes the message to the appropriate plugin.
 */

import { loadPlugin, type PluginId } from './index';
import type { PluginInput, PluginOutput } from './types';

export interface ModeExecutionRequest {
  mode: PluginId;
  prompt: string;
  files?: File[];
  context?: {
    messages: Array<{ role: string; content: string }>;
  };
  options?: Record<string, unknown>;
}

export interface ModeExecutionResult {
  success: boolean;
  content: string;
  artifacts?: Array<{
    type: 'image' | 'video' | 'file' | 'code' | 'chart' | 'slide';
    url: string;
    name: string;
  }>;
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
}

/**
 * Execute a mode-specific request
 */
export async function executeMode(
  request: ModeExecutionRequest,
  onProgress?: (step: string, message: string) => void
): Promise<ModeExecutionResult> {
  const { mode, prompt, files, context, options } = request;

  try {
    // Load the plugin for this mode
    const plugin = await loadPlugin(mode);

    // Set up progress listener
    if (onProgress) {
      plugin.on('progress', (event) => {
        if (event.payload && typeof event.payload === 'object') {
          const { step, message } = event.payload as { step: string; message: string };
          onProgress(step, message);
        }
      });
    }

    // Build plugin input
    const input: PluginInput = {
      prompt,
      context,
      files,
      options,
    };

    // Execute the plugin
    const output = await plugin.execute(input);

    // Transform to result format
    return {
      success: output.success,
      content: output.content || '',
      artifacts: output.artifacts?.map(a => ({
        type: a.type,
        url: a.url,
        name: a.name,
      })),
      error: output.error,
    };

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      content: '',
      error: {
        message: error.message,
        code: 'MODE_EXECUTION_ERROR',
        recoverable: false,
      },
    };
  }
}

/**
 * Check if a mode requires configuration (like BYOK)
 */
export function modeRequiresConfig(mode: PluginId): boolean {
  return mode === 'video'; // Only video requires API key currently
}

/**
 * Get configuration status for a mode
 */
export function getModeConfigStatus(mode: PluginId): {
  configured: boolean;
  message?: string;
} {
  if (mode === 'video') {
    const savedKeys = localStorage.getItem('allternit_video_api_keys');
    if (!savedKeys) {
      return {
        configured: false,
        message: 'Video generation requires a MiniMax or Kling API key. Add your key in settings.',
      };
    }
    const keys = JSON.parse(savedKeys);
    if (!keys.minimax && !keys.kling) {
      return {
        configured: false,
        message: 'Add a MiniMax or Kling API key to generate videos.',
      };
    }
    return { configured: true };
  }

  return { configured: true };
}

/**
 * Format mode execution result for chat display
 */
export function formatModeResultForChat(
  mode: PluginId,
  result: ModeExecutionResult
): string {
  if (!result.success) {
    return `**${capitalize(mode)} Mode Error:** ${result.error?.message || 'Unknown error'}`;
  }

  const modeNames: Record<string, string> = {
    research: 'Research',
    data: 'Data',
    slides: 'Slides',
    code: 'Code',
    assets: 'Assets',
    swarms: 'Swarms',
    flow: 'Flow',
    website: 'Website',
    image: 'Image',
    video: 'Video',
  };

  let formatted = `**${modeNames[mode] || mode} Mode**\n\n`;
  formatted += result.content;

  if (result.artifacts && result.artifacts.length > 0) {
    formatted += `\n\n**Generated ${result.artifacts.length} artifact(s):**\n`;
    result.artifacts.forEach((a, i) => {
      formatted += `${i + 1}. [${a.name}](${a.url})\n`;
    });
  }

  return formatted;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Re-export types
export type { PluginInput, PluginOutput };
