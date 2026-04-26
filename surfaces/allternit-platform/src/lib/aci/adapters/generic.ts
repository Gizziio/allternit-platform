/**
 * ACI Adapter — Generic Vision Loop
 *
 * Model-agnostic: works with any vision + tool-calling model accessible
 * via the Vercel AI Gateway.  Pass any model string:
 *   'anthropic/claude-sonnet-4.6'
 *   'openai/gpt-5.4'
 *   'google/gemini-2.5-pro'
 *   'xai/grok-2-vision'
 *   ... anything the gateway supports
 *
 * Pattern per step:
 *   screenshot → model sees screen → calls browser_action tool → executor runs it
 */

import { generateText, tool } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import type { AciAction, ModelAdapter, AdapterStepParams } from '../types';

export interface GenericAdapterOptions {
  /** AI SDK model string, e.g. 'anthropic/claude-sonnet-4.6' or 'openai/gpt-5.4' */
  modelId: string;
  maxTokens?: number;
  /** System prompt prefix */
  systemPrompt?: string;
}

// Zod schema for the browser_action tool
const BrowserActionSchema = z.object({
  action: z.enum([
    'click', 'double_click', 'right_click', 'hover',
    'type', 'key', 'hotkey',
    'navigate', 'scroll', 'drag',
    'screenshot', 'extract',
    'done',
  ]).describe('The browser action to perform'),
  x: z.number().optional().describe('X pixel coordinate (for click/hover/scroll/drag)'),
  y: z.number().optional().describe('Y pixel coordinate (for click/hover/scroll/drag)'),
  end_x: z.number().optional().describe('End X coordinate (for drag)'),
  end_y: z.number().optional().describe('End Y coordinate (for drag)'),
  text: z.string().optional().describe('Text to type, or key name for key action'),
  keys: z.array(z.string()).optional().describe('Key combination for hotkey, e.g. ["Control","c"]'),
  url: z.string().optional().describe('URL for navigate action'),
  selector: z.string().optional().describe('CSS selector for targeting element by selector'),
  scroll_direction: z.enum(['up','down','left','right']).optional(),
  scroll_amount: z.number().optional().describe('Number of scroll units (default 3)'),
  label: z.string().optional().describe('Human-readable description of what this action does'),
  done_reason: z.string().optional().describe('Reason why the task is complete (for done action)'),
});

const DEFAULT_SYSTEM = `You are a browser automation agent. You control a browser by taking actions.
After each action you will receive a screenshot of the current browser state.
Use the browser_action tool to perform one action at a time.
When the task is complete, call browser_action with action="done".
Be methodical — observe the page before clicking. Use exact pixel coordinates from the screenshot.`;

export function createGenericAdapter(opts: GenericAdapterOptions): ModelAdapter {
  const { modelId, maxTokens = 2048, systemPrompt = DEFAULT_SYSTEM } = opts;

  return {
    adapterId: `generic.${modelId.replace('/', '.')}`,

    async step({ goal, screenshotB64, history }: AdapterStepParams): Promise<AciAction[] | null> {
      const historyText = history.length > 0
        ? `\n\nActions taken so far:\n${history.map((a, i) => `${i + 1}. ${a.label ?? a.type}`).join('\n')}`
        : '';

      const { toolCalls } = await (generateText as any)({
        model: gateway(modelId),
        maxTokens,
        system: systemPrompt,
        tools: {
          browser_action: tool({
            description: 'Perform a browser action (click, type, navigate, etc.)',
            parameters: BrowserActionSchema,
          } as any),
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: screenshotB64,
                mimeType: 'image/png',
              } as any,
              {
                type: 'text',
                text: `Task: ${goal}${historyText}\n\nLook at the screenshot and call browser_action with the next action.`,
              },
            ],
          },
        ],
      });

      if (!toolCalls || toolCalls.length === 0) return null;

      const actions: AciAction[] = [];

      for (const call of toolCalls) {
        if (call.toolName !== 'browser_action') continue;
        const input = (call as any).args as z.infer<typeof BrowserActionSchema>;

        if (input.action === 'done') return null; // task complete

        actions.push({
          type: input.action as AciAction['type'],
          x: input.x,
          y: input.y,
          endX: input.end_x,
          endY: input.end_y,
          text: input.text,
          keys: input.keys,
          url: input.url,
          selector: input.selector,
          scrollDirection: input.scroll_direction,
          scrollAmount: input.scroll_amount,
          label: input.label ?? `${input.action}${input.x != null ? ` (${input.x},${input.y})` : ''}${input.text ? ` "${input.text.slice(0, 24)}"` : ''}${input.url ? ` → ${input.url}` : ''}`,
          raw: call,
        });
      }

      return actions.length > 0 ? actions : null;
    },
  };
}
