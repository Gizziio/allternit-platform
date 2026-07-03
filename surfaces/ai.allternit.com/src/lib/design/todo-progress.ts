/**
 * Todo progress parser — ported from nexu-io/open-design.
 *
 * Agents emit numbered plans and mark items completed as they work. This
 * parser extracts the latest todo list from streaming message text and
 * surfaces completion status for the live progress card.
 *
 * Supported marker styles:
 *   1. [ ] Unchecked item
 *   2. [x] Checked item
 *   3. Step 2 — completed
 *   4. ✅ Step 2
 *   5. - [x] Completed item
 */

export interface TodoItem {
  id: string;
  label: string;
  completed: boolean;
  index: number;
}

export interface TodoProgress {
  items: TodoItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

function generateId(label: string, index: number): string {
  return `${index}-${label.slice(0, 32).replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '')}`;
}

export function parseTodoProgress(text: string): TodoProgress {
  const items: TodoItem[] = [];
  const seen = new Set<string>();

  const checkboxPattern = /^(?:\s*[-*]?\s*)?(?:\d+\.\s*)?\[([ xX])\]\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = checkboxPattern.exec(text)) !== null) {
    const label = match[2].trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: generateId(label, items.length),
      label,
      completed: match[1].toLowerCase() === 'x',
      index: items.length,
    });
  }

  const stepPattern = /^(?:\s*[-*]?\s*)?(?:step\s*)?(\d+)[:.\-]\s*(.+?)(?:\s*[-–]\s*(completed|done|finished))?\s*$/gim;
  // eslint-disable-next-line no-cond-assign
  while ((match = stepPattern.exec(text)) !== null) {
    const label = match[2].trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const completedSuffix = match[3]?.toLowerCase();
    items.push({
      id: generateId(label, items.length),
      label,
      completed: ['completed', 'done', 'finished'].includes(completedSuffix ?? ''),
      index: items.length,
    });
  }

  const emojiPattern = /^\s*([✅✔☑])\s*(.+)$/gm;
  // eslint-disable-next-line no-cond-assign
  while ((match = emojiPattern.exec(text)) !== null) {
    const label = match[2].trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: generateId(label, items.length),
      label,
      completed: true,
      index: items.length,
    });
  }

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.completed).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { items, completedCount, totalCount, percent };
}

export function mergeTodoProgress(previous: TodoProgress, next: TodoProgress): TodoProgress {
  if (next.totalCount === 0) return previous;
  if (previous.totalCount === 0) return next;
  // Prefer the list with more items; if equal, prefer the one with more completed.
  if (next.totalCount > previous.totalCount) return next;
  if (next.totalCount < previous.totalCount) return previous;
  return next.completedCount >= previous.completedCount ? next : previous;
}
