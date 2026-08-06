import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Obsidian-style syntax colors (docs §19, "Variable editor/markdown"):
 * comment=faint, function=yellow, keyword=pink, string=green, operator/tag=red,
 * property=cyan, value/number=purple, important=orange. Colors are CSS variables
 * so the same style serves light & dark.
 *
 * Deliberately does NOT style markdown structure tags (emphasis, heading, link,
 * escape…) — Live Preview decorations own those. This is what fixes stray red
 * escapes/brackets that defaultHighlightStyle painted in body text.
 */
export const obsidianHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: 'var(--text-faint)' },
  { tag: t.lineComment, color: 'var(--text-faint)' },
  { tag: t.blockComment, color: 'var(--text-faint)' },
  { tag: t.docComment, color: 'var(--text-faint)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--color-yellow)' },
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: 'var(--color-pink)' },
  { tag: [t.string, t.special(t.string), t.character, t.regexp], color: 'var(--color-green)' },
  { tag: [t.operator, t.tagName, t.angleBracket, t.derefOperator], color: 'var(--color-red)' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.variableName)], color: 'var(--color-cyan)' },
  { tag: [t.number, t.bool, t.atom, t.null, t.unit, t.color, t.constant(t.variableName)], color: 'var(--color-purple)' },
  { tag: [t.annotation, t.self, t.changed], color: 'var(--color-orange)' },
  { tag: [t.className, t.namespace, t.typeName], color: 'var(--color-cyan)' },
  { tag: t.invalid, color: 'var(--text-error, var(--color-red))' },
]);
