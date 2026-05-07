// ============================================================================
// Shared A2UI Generation Logic
// ============================================================================
// Used by both the API route (POST /api/v1/a2ui/generate) and the
// generateA2UI agent tool so the system prompt and schema live in one place.
// ============================================================================

import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { COMPONENT_WHITELIST } from '@/capsules/a2ui/a2ui.types';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

// ============================================================================
// Zod Schema
// ============================================================================

// ComponentNode is recursive (children arrays contain more ComponentNodes).
// props is kept open (z.record) so any nesting depth is accepted.
// The LLM is constrained to the whitelist via the system prompt.
export const ComponentNodeSchema = z.object({
  type: z.string().describe('One of the whitelisted component types'),
  props: z.record(z.unknown()).describe('Component-specific props; children is ComponentNode[]'),
});

export const A2UIPayloadSchema = z.object({
  version: z.literal('1.0.0'),
  surfaces: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      root: ComponentNodeSchema,
    })
  ).min(1),
  dataModel: z.record(z.unknown()).optional(),
  actions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['ui', 'api', 'navigate', 'emit']),
      handler: z.string().optional(),
      params: z.record(z.unknown()).optional(),
    })
  ).optional(),
});

// ============================================================================
// System Prompt
// ============================================================================

export const A2UI_SYSTEM_PROMPT = `You are an A2UI payload generator. A2UI is a declarative JSON \
format that describes interactive React UIs rendered by a whitelist-secured component system. \
Generate a valid A2UIPayload JSON object that directly and fully addresses the user request.

## Allowed Components (ONLY these can be used)
${COMPONENT_WHITELIST.join(', ')}

## Payload Structure
{
  "version": "1.0.0",
  "surfaces": [{ "id": "main", "name": "string?", "root": ComponentNode }],
  "dataModel": { ...initial reactive state },
  "actions": [{ "id": "string", "type": "ui|api|navigate|emit", "handler": "string?" }]
}

## ComponentNode
{ "type": "ComponentType", "props": { ...props } }
Children are always in props.children: ComponentNode[]

## Key Props Reference
Container  — direction:"row|column", gap:number, padding:number, border?:bool, children:ComponentNode[]
Stack      — direction:"horizontal|vertical", gap:number, align:"start|center|end|stretch", children:ComponentNode[]
Grid       — columns:number, gap:number, children:ComponentNode[]
Card       — title?:string, subtitle?:string, padding?:bool|number, hoverable?:bool, children:ComponentNode[]
Text       — content:string, contentPath?:string, variant:"heading|body|caption|code|label", size:"xs|sm|md|lg|xl|2xl", weight:"normal|medium|semibold|bold"
Button     — label:string, variant:"primary|secondary|ghost|danger", size:"sm|md|lg", action:string
TextField  — label?:string, valuePath:string, placeholder?:string, type:"text|password|email|number", required?:bool, submitAction?:string
Select     — label?:string, valuePath:string, options:[{label,value}], placeholder?:string, searchable?:bool
Switch     — label:string, valuePath:string
Checkbox   — label:string, valuePath:string
RadioGroup — label?:string, valuePath:string, options:[{label,value}], direction:"horizontal|vertical"
Slider     — label?:string, valuePath:string, min:number, max:number, step?:number, showValue?:bool
List       — items:"dataPath"|[], itemTemplate:ComponentNode, emptyText?:string
DataTable  — columns:[{key,header,sortable?}], rows:"dataPath"|[], emptyText?:string
Badge      — content:string, contentPath?:string, variant:"default|primary|success|warning|danger"
Progress   — value:number, valuePath?:string, showValue?:bool, variant:"linear|circular"
Alert      — title?:string, message:string, variant:"info|success|warning|error", dismissible?:bool
Tabs       — tabs:[{id,label,content:ComponentNode[]}], activeTabPath:string
Accordion  — items:[{id,title,content:ComponentNode[]}], allowMultiple?:bool
Divider    — {}
Spinner    — size:"sm|md|lg"
Code       — content:string, language?:string, showLineNumbers?:bool, copyable?:bool
Markdown   — content:string

## Data Binding
- valuePath: "user.name"    → two-way binding to dataModel.user.name
- contentPath: "stats.total" → read-only display from dataModel
- items: "products"          → list/table rows from dataModel.products
- Every path used must have a corresponding initial value in dataModel

## Actions
Reference by ID in button.action or field.submitAction.
Define each in the top-level actions array with type and optional handler.

## Rules
- Only use components from the whitelist — no others
- Every valuePath/contentPath/items path must have an initial value in dataModel
- Use realistic initial data that reflects the use case
- Produce fully functional, wired UIs — not placeholders`;

// ============================================================================
// Generator Function
// ============================================================================

export interface A2UIGenerateOptions {
  /** The user-facing prompt describing the UI to generate */
  prompt: string;
  /** If updating an existing UI, pass the current payload */
  currentPayload?: A2UIPayload;
}

export interface A2UIGenerateResult {
  payload: A2UIPayload;
  sessionId: string;
}

export async function generateA2UIPayload({
  prompt,
  currentPayload,
}: A2UIGenerateOptions): Promise<A2UIGenerateResult> {
  const userMessage = currentPayload
    ? `${prompt}\n\nUpdate this existing UI:\n${JSON.stringify(currentPayload, null, 2)}`
    : prompt;

  const result = await generateText({
    model: gateway('anthropic/claude-sonnet-4.6'),
    output: Output.object({ schema: A2UIPayloadSchema }),
    system: A2UI_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const sessionId = `a2ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    payload: result.output as A2UIPayload,
    sessionId,
  };
}
