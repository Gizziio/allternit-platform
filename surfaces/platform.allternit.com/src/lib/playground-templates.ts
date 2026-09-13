/**
 * Playground starter templates.
 *
 * Adapted from the ai surface playground (`surfaces/ai.allternit.com/src/views/
 * playground/main/PlaygroundView.constants.ts`), with Allternit-flavored copy
 * and task-oriented starters in the same spirit as the console template rail.
 * A template fills the left-hand request form (system prompt + starter message)
 * when clicked; it never fires a request on its own.
 */

export interface PlaygroundTemplate {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
  starterMessage: string;
}

export const PLAYGROUND_TEMPLATES: PlaygroundTemplate[] = [
  {
    id: "raw",
    label: "Raw request",
    description: "Blank canvas — a bare system prompt and one user message.",
    systemPrompt: "You are a helpful assistant.",
    starterMessage: "Hello — introduce yourself in one sentence.",
  },
  {
    id: "data-extraction",
    label: "Data extraction",
    description: "Pull structured fields out of unstructured text.",
    systemPrompt:
      "You are a precise data-extraction assistant. " +
      "Extract the requested fields and return them as a JSON object with the exact keys asked for. " +
      "If a field is missing from the source text, use null — never invent values.",
    starterMessage:
      "Extract the vendor, date, total amount, and line items from this invoice text:\n\n<paste invoice text here>",
  },
  {
    id: "deep-research",
    label: "Deep research",
    description: "Multi-angle research brief with sources and open questions.",
    systemPrompt:
      "You are a research analyst. Answer with a structured brief: summary, key findings " +
      "(with confidence levels), counterarguments, and open questions that need primary sources. " +
      "Separate established facts from inference.",
    starterMessage:
      "Research question: What is the current state of small-model inference economics " +
      "for agent workloads, and where is the cost curve heading over the next 12 months?",
  },
  {
    id: "answer-from-pdf",
    label: "Answer from a document",
    description: "Grounded Q&A over a pasted document — cite the passage used.",
    systemPrompt:
      "You answer questions using only the document provided in the conversation. " +
      "Quote or closely paraphrase the supporting passage before each answer. " +
      "If the document does not contain the answer, say so plainly instead of guessing.",
    starterMessage:
      "Document:\n<paste document text here>\n\nQuestion: What does the document say about renewal pricing?",
  },
  {
    id: "adaptive-thinking",
    label: "Adaptive thinking",
    description: "Reason step by step, then give the final answer.",
    systemPrompt:
      "You are a careful problem solver. For non-trivial questions, briefly show your reasoning " +
      "steps before the final answer, then clearly mark the final answer on its own line. " +
      "Keep the reasoning concise and skip it for simple factual questions.",
    starterMessage:
      "A batch job processes 40% of its requests in the first hour, then half of the remainder " +
      "each following hour. After how many hours are fewer than 5% of requests still pending?",
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet formulas",
    description: "Explain and write formulas for spreadsheet tasks.",
    systemPrompt:
      "You are a spreadsheet expert. Given a task, propose the formula or the set of formulas " +
      "to accomplish it, explain what each does, and note any locale caveats " +
      "(argument separators, function name differences).",
    starterMessage:
      "Sheet columns: A = date, B = category, C = amount. " +
      "Write a formula that gives the monthly total for the category in cell F1.",
  },
  {
    id: "data-viz",
    label: "Data visualization",
    description: "Interactive charts from raw data as a self-contained HTML artifact.",
    systemPrompt:
      "You are a data visualization expert. Create beautiful, interactive visualizations as " +
      "self-contained HTML using Canvas or SVG — no external libraries. Wrap the HTML in " +
      "```html fences.",
    starterMessage:
      "Visualize monthly revenue: Jan $12k, Feb $18k, Mar $15k, Apr $22k, May $28k, Jun $31k.",
  },
  {
    id: "diff-review",
    label: "Diff review",
    description: "Side-by-side change review with annotations.",
    systemPrompt:
      "You are a senior code reviewer. Produce a side-by-side diff-style review with line " +
      "annotations and a summary of issues, risks, and what is done well. Be specific; " +
      "no generic advice.",
    starterMessage:
      "Review this change: replaced `var` with `const` throughout a JS module, and " +
      "hoisted a shared helper that was previously inlined twice.",
  },
];
