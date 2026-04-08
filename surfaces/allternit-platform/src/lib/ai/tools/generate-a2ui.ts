import { tool } from 'ai';
import { z } from 'zod';
import { generateA2UIPayload } from '@/lib/ai/a2ui-generator';
import type { CostAccumulator } from '@/lib/credits/cost-accumulator';

export const generateA2UITool = (_props: { costAccumulator?: CostAccumulator } = {}) =>
  tool({
    description: `Generate an interactive UI application for the user. \
Use this when the response is better expressed as an interactive form, dashboard, data display, \
or application rather than as text. \
Examples: task managers, settings panels, data tables, configuration forms, dashboards, \
calculators, surveys, data editors, contact forms.`,
    inputSchema: z.object({
      prompt: z.string().describe(
        'Description of the UI to generate. Be specific about what fields, data, and interactions it should have.'
      ),
      title: z.string().optional().describe(
        'Short display title for the UI panel (e.g. "Task Manager", "Settings Form")'
      ),
    }),
    execute: async ({ prompt, title }) => {
      const result = await generateA2UIPayload({ prompt });
      return {
        payload: result.payload,
        sessionId: result.sessionId,
        title: title ?? 'Interactive UI',
      };
    },
  });
