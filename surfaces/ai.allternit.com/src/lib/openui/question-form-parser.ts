/**
 * Question-Form Parser
 *
 * Parses <question-form id="...">JSON body</question-form> blocks emitted
 * by the Studio design agent. Splits a raw message string into interleaved
 * text and form segments.
 *
 * XML format:
 *   <question-form id="form-id">
 *   { "title": "Pick a direction", "questions": [...] }
 *   </question-form>
 */

export type QuestionType =
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'text'
  | 'textarea'
  | 'direction-cards';

export interface DirectionCard {
  id: string;
  label: string;
  palette: string[];
  font: string;
  mood: string;
  references: string[];
}

export interface FormOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  options?: FormOption[];
  cards?: DirectionCard[];
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface QuestionForm {
  id: string;
  title?: string;
  description?: string;
  questions: FormQuestion[];
}

export type FormSegment =
  | { kind: 'text'; content: string }
  | { kind: 'form'; form: QuestionForm };

const FORM_RE = /<question-form\b([^>]*)>([\s\S]*?)<\/question-form>/gi;

function parseId(attrString: string): string {
  const m = /\bid=["']([^"']+)["']/.exec(attrString);
  return m ? m[1] : `form-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeOption(o: unknown): FormOption {
  if (typeof o === 'string') return { value: o, label: o };
  const obj = o as Record<string, unknown>;
  const label = String(obj.label ?? obj.value ?? '');
  const value = String(obj.value ?? obj.label ?? '');
  return obj.description
    ? { value, label, description: String(obj.description) }
    : { value, label };
}

function normalizeQuestion(q: Record<string, unknown>): FormQuestion {
  return {
    ...(q as unknown as FormQuestion),
    options: Array.isArray(q.options) ? q.options.map(normalizeOption) : undefined,
  };
}

function parseFormJson(id: string, raw: string): QuestionForm | null {
  try {
    const body = raw.trim();
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return {
      id: (parsed.id as string | undefined) ?? id,
      title: parsed.title as string | undefined,
      description: parsed.description as string | undefined,
      questions: Array.isArray(parsed.questions)
        ? (parsed.questions as Record<string, unknown>[]).map(normalizeQuestion)
        : [],
    };
  } catch {
    return null;
  }
}

export function splitOnQuestionForms(input: string): FormSegment[] {
  if (!input) return [];

  const segments: FormSegment[] = [];
  let lastIndex = 0;
  FORM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = FORM_RE.exec(input)) !== null) {
    const matchStart = m.index;
    const matchEnd = matchStart + m[0].length;

    if (matchStart > lastIndex) {
      const text = input.slice(lastIndex, matchStart);
      if (text.trim()) segments.push({ kind: 'text', content: text });
    }

    const id = parseId(m[1]);
    const form = parseFormJson(id, m[2]);
    if (form) {
      segments.push({ kind: 'form', form });
    } else {
      // Malformed JSON: treat the whole block as text so it's not lost.
      segments.push({ kind: 'text', content: m[0] });
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text.trim()) segments.push({ kind: 'text', content: text });
  }

  return segments;
}

/**
 * Serialise form answers into an assistant-readable string to append to the
 * next user message.
 */
export function formatFormAnswers(
  form: QuestionForm,
  answers: Record<string, string | string[]>,
): string {
  const lines: string[] = [];
  lines.push(`<form-answers form-id="${form.id}">`);
  if (form.title) lines.push(`Form: ${form.title}`);
  for (const q of form.questions) {
    const ans = answers[q.id];
    if (ans === undefined) continue;
    const value = Array.isArray(ans) ? ans.join(', ') : ans;
    lines.push(`${q.label}: ${value}`);
  }
  lines.push('</form-answers>');
  return lines.join('\n');
}
