/**
 * Artifact Linter
 *
 * Runs P0/P1/P2 quality checks on agent-generated HTML artifacts.
 * P0 findings are blocking (agent must fix before output is shown).
 * P1/P2 are warnings surfaced to the user but not re-sent to the agent.
 */

export type Severity = 'P0' | 'P1' | 'P2';

export interface LintFinding {
  id: string;
  severity: Severity;
  message: string;
  fix: string;
}

type Check = (html: string) => LintFinding | null;

// ─── P0 checks (must fix) ────────────────────────────────────────────────────

const purpleGradient: Check = (html) => {
  if (/linear-gradient\([^)]*(?:#[89a-f][0-9a-f]|purple|violet|rebeccapurple)/i.test(html)) {
    return {
      id: 'purple-gradient',
      severity: 'P0',
      message: 'Generic purple/violet gradient detected. Use the brand accent color instead.',
      fix: 'Replace the gradient with the design system accent color from --accent or --design-color-primary.',
    };
  }
  return null;
};

const slopEmoji: Check = (html) => {
  // Common filler emoji used as design substitutes
  const SLOP = ['🚀', '⚡', '💡', '🎯', '✨', '🔥', '💎', '🌟', '🎉', '👇', '👆'];
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const count = SLOP.filter((e) => body.includes(e)).length;
  if (count >= 3) {
    return {
      id: 'slop-emoji',
      severity: 'P0',
      message: `${count} filler emoji detected (🚀⚡💡 etc). These signal generic AI output, not design intent.`,
      fix: 'Remove decorative emoji. Use SVG icons or CSS shapes for visual accents.',
    };
  }
  return null;
};

const fillerCopy: Check = (html) => {
  const PHRASES = [
    'lorem ipsum',
    'placeholder text',
    'coming soon',
    '[your',
    'insert text here',
    'sample text',
    'click here to',
  ];
  const lower = html.toLowerCase();
  const found = PHRASES.filter((p) => lower.includes(p));
  if (found.length > 0) {
    return {
      id: 'filler-copy',
      severity: 'P0',
      message: `Filler copy detected: ${found.slice(0, 3).join(', ')}. Artifacts must contain real, specific content.`,
      fix: 'Replace all placeholder text with realistic, brand-appropriate copy.',
    };
  }
  return null;
};

// ─── P1 checks (warn) ────────────────────────────────────────────────────────

const inventedMetric: Check = (html) => {
  // Numbers that look like invented KPIs without context
  const PATTERNS = [
    /\b99\.9%\s+(?:uptime|availability)/i,
    /\b10[xX]\s+(?:faster|better|more)/i,
    /\$\d+[MBK]\+?\s+(?:raised|ARR|revenue)/i,
    /\b\d+[,\d]*\+?\s+(?:happy\s+)?customers/i,
  ];
  const found = PATTERNS.some((re) => re.test(html));
  if (found) {
    return {
      id: 'invented-metric',
      severity: 'P1',
      message: 'Invented metrics detected (e.g. "10x faster", "$10M ARR"). Use real numbers or clearly fictional placeholders.',
      fix: 'Replace with contextually appropriate figures or mark as illustrative.',
    };
  }
  return null;
};

const accentOveruse: Check = (html) => {
  // Count how many elements use hard accent colors for background
  const re = /background(?:-color)?:\s*(?:var\(--accent|#6366f1|#818cf8|oklch\(0\.6[0-9])/gi;
  const matches = html.match(re);
  if (matches && matches.length > 8) {
    return {
      id: 'accent-overuse',
      severity: 'P1',
      message: `Accent color used ${matches.length} times as background. Reserve accent for 1-2 focal points per screen.`,
      fix: 'Use surface/muted backgrounds for secondary elements. Accent should draw the eye to one CTA.',
    };
  }
  return null;
};

// ─── P2 checks (info) ────────────────────────────────────────────────────────

const displaySansOnly: Check = (html) => {
  // If no body text font is set, the agent probably only thought about headings
  if (!/<(?:p|li|td|span|div)[^>]*style="[^"]*font-family/i.test(html) &&
      /font-family:[^;]*(?:Display|Black|Heavy|Ultra)/i.test(html)) {
    return {
      id: 'display-sans-only',
      severity: 'P2',
      message: 'Only display/black-weight fonts detected. Set a readable body font for paragraph text.',
      fix: 'Add a body font (e.g. Inter, DM Sans) for non-heading elements.',
    };
  }
  return null;
};

const missingViewport: Check = (html) => {
  if (!/viewport/.test(html)) {
    return {
      id: 'missing-viewport',
      severity: 'P2',
      message: 'No viewport meta tag. Artifacts may render poorly on mobile-preview.',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0" />.',
    };
  }
  return null;
};

// ─── Runner ──────────────────────────────────────────────────────────────────

const ALL_CHECKS: Check[] = [
  purpleGradient,
  slopEmoji,
  fillerCopy,
  inventedMetric,
  accentOveruse,
  displaySansOnly,
  missingViewport,
];

export function lintArtifact(html: string): LintFinding[] {
  return ALL_CHECKS.map((c) => c(html)).filter((f): f is LintFinding => f !== null);
}

export function hasBlockingFindings(findings: LintFinding[]): boolean {
  return findings.some((f) => f.severity === 'P0');
}

/**
 * Format findings as a follow-up message to send back to the agent when P0s exist.
 */
export function renderFindingsForAgent(findings: LintFinding[]): string {
  const blocking = findings.filter((f) => f.severity === 'P0');
  if (blocking.length === 0) return '';

  const lines: string[] = [
    '⚠️ The artifact has quality issues that must be fixed before it is shown to the user:',
    '',
  ];
  for (const f of blocking) {
    lines.push(`**[${f.id}]** ${f.message}`);
    lines.push(`Fix: ${f.fix}`);
    lines.push('');
  }
  lines.push('Please regenerate the artifact with all issues resolved.');
  return lines.join('\n');
}
