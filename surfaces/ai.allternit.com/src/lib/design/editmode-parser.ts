/**
 * EDITMODE parser — extracts the live-tweak token config block embedded
 * by the agent in generated HTML artifacts.
 *
 * Format the agent embeds inside a <script> or HTML comment:
 *
 *   /*EDITMODE-BEGIN*\/
 *   { "tokens": [...] }
 *   /*EDITMODE-END*\/
 *
 * Each token:
 *   { id, label, type: "color"|"range"|"select"|"text", value, min?, max?, options? }
 */

export type EditModeTokenType = 'color' | 'range' | 'select' | 'text';

export interface EditModeToken {
  id: string;
  label: string;
  type: EditModeTokenType;
  value: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface EditModeConfig {
  tokens: EditModeToken[];
}

const BEGIN_MARKER = '/*EDITMODE-BEGIN*/';
const END_MARKER = '/*EDITMODE-END*/';

export function parseEditModeConfig(html: string): EditModeConfig | null {
  const start = html.indexOf(BEGIN_MARKER);
  if (start === -1) return null;
  const end = html.indexOf(END_MARKER, start);
  if (end === -1) return null;

  const raw = html.slice(start + BEGIN_MARKER.length, end).trim();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tokens)) return null;
    return parsed as EditModeConfig;
  } catch {
    return null;
  }
}

/**
 * Build updated HTML by replacing the current token values in the EDITMODE block.
 * Used if you want to persist changes into the HTML itself.
 */
export function updateEditModeTokensInHtml(
  html: string,
  updatedTokens: EditModeToken[],
): string {
  const start = html.indexOf(BEGIN_MARKER);
  if (start === -1) return html;
  const end = html.indexOf(END_MARKER, start);
  if (end === -1) return html;

  const newBlock = `${BEGIN_MARKER}\n${JSON.stringify({ tokens: updatedTokens }, null, 2)}\n${END_MARKER}`;
  return html.slice(0, start) + newBlock + html.slice(end + END_MARKER.length);
}
