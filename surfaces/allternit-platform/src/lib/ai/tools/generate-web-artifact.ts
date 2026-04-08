import { generateText, tool } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import type { CostAccumulator } from '@/lib/credits/cost-accumulator';
import { createModuleLogger } from '@/lib/logger';
import { getBestTemplate } from './templates/template-matcher';

const log = createModuleLogger('ai.tools.generate-web-artifact');

const KIND_SYSTEM: Record<string, string> = {
  html: `You generate a single self-contained HTML file.
Rules:
- All CSS inside a <style> tag in <head>
- All JavaScript inside a <script> tag before </body>
- No external dependencies unless a CDN link is truly necessary
- Must be fully interactive and functional when loaded in an iframe
- Use modern, clean styling — dark background unless the content calls for light
- Output ONLY the raw HTML. No explanation, no markdown, no code fences.`,

  svg: `You generate a single standalone SVG file.
Rules:
- Use viewBox for proper scaling (e.g. viewBox="0 0 400 300")
- Include any animation as CSS inside a <style> tag or SMIL attributes
- Self-contained — no external references
- Output ONLY the raw SVG. No explanation, no markdown, no code fences.`,

  mermaid: `You generate a single Mermaid diagram definition.
Rules:
- Output ONLY the diagram code — no code fences, no explanation
- Choose the most appropriate diagram type (flowchart, sequenceDiagram, gantt, classDiagram, etc.)
- Use emoji and styling where appropriate to improve readability`,

  jsx: `You generate a self-contained React JSX component.
Rules:
- Single default export
- No external imports — React is available globally as window.React
- Use inline styles for all styling (no Tailwind, no CSS imports)
- Must render a complete, useful, interactive UI
- Output ONLY the raw JSX. No explanation, no markdown, no code fences.`,
};

export const generateWebArtifactTool = (_props: { costAccumulator?: CostAccumulator } = {}) =>
  tool({
    description: `Generate an interactive web artifact — an HTML app, SVG graphic, Mermaid diagram, \
or React component — that renders live in a preview panel. Use this when the user wants to see \
something rendered visually: games, charts, animations, calculators, clocks, data visualizations, \
interactive demos, UI mockups, or any HTML/CSS/JS creation. Do NOT use for data tables or forms \
that need backend actions — use generateA2UI for those instead.`,
    inputSchema: z.object({
      prompt: z.string().describe('What to build. Be specific about content, style, and interactions.'),
      kind: z.enum(['html', 'svg', 'mermaid', 'jsx'])
        .default('html')
        .describe('Artifact type. Use html for most things, svg for graphics, mermaid for diagrams.'),
      title: z.string().optional().describe('Short display title (e.g. "Snake Game", "Sales Chart")'),
    }),
    execute: async ({ prompt, kind, title }) => {
      const startMs = Date.now();
      log.info({ kind, promptLength: prompt.length }, 'generateWebArtifact: start');

      // --- Few-shot injection --------------------------------------------------
      // Find the most semantically similar template and prepend it as an example.
      // This is the single highest-impact quality lever: the LLM sees exactly
      // what format, complexity level, and style standard is expected.
      const match = getBestTemplate(prompt, kind as 'html' | 'svg' | 'mermaid' | 'jsx');

      const systemPrompt = match
        ? buildSystemWithExample(KIND_SYSTEM[kind] ?? KIND_SYSTEM.html, match.prompt, match.content, kind)
        : (KIND_SYSTEM[kind] ?? KIND_SYSTEM.html);

      if (match) {
        log.info({ templateId: match.id, kind }, 'generateWebArtifact: injecting few-shot template');
      }
      // -------------------------------------------------------------------------

      const result = await generateText({
        model: gateway('anthropic/claude-sonnet-4.6'),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      // Strip code fences — LLMs sometimes wrap output despite instructions
      let content = result.text.trim();
      const fenceMatch = content.match(FENCE_STRIP_RE);
      if (fenceMatch) content = fenceMatch[1].trim();

      log.info({ kind, ms: Date.now() - startMs, contentLength: content.length }, 'generateWebArtifact: done');

      return {
        content,
        kind,
        title: title ?? inferTitle(prompt, kind),
        templateUsed: match?.id ?? null,
      };
    },
  });

/** Strips a single outer code-fence from LLM output that ignored the "no fences" rule. */
export const FENCE_STRIP_RE = /^```(?:\w+)?\n([\s\S]*?)\n```$/s;

/**
 * Build a system prompt that includes a few-shot reference example.
 * The example is presented as a prior conversation turn (assistant output)
 * to give the LLM the clearest possible signal of the expected output format.
 */
export function buildSystemWithExample(
  baseSystem: string,
  examplePrompt: string,
  exampleContent: string,
  kind: string,
): string {
  const kindLabel = kind === 'html' ? 'HTML' : kind === 'svg' ? 'SVG' : kind === 'mermaid' ? 'Mermaid' : 'JSX';
  return `${baseSystem}

## Reference Example
Here is a high-quality ${kindLabel} artifact for reference — use it to calibrate your output's \
style, completeness, and structure. Generate something similarly polished for the user's request.

User requested: "${examplePrompt}"
${kindLabel} output:
${exampleContent}

---
Now generate for the user's actual request below. Produce output of equal or higher quality.`;
}

export function inferTitle(prompt: string, kind: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(' ');
  const kindLabel = kind === 'html' ? 'App' : kind === 'mermaid' ? 'Diagram' : kind.toUpperCase();
  return `${words} (${kindLabel})`;
}
