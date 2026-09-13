interface LintViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  fix?: string;
}

export interface LintResult {
  violations: LintViolation[];
  score: number;
  passed: boolean;
}

/**
 * P0 brand-violation rules — artifacts with these cannot be saved as project
 * files until fixed. Error-severity rules in this linter are the P0 set.
 */
export const BRAND_P0_RULES = ['no-legacy-coral', 'no-purple-accent'];

export function isBrandP0Violation(v: { rule: string; severity: string }): boolean {
  return v.severity === 'error' && BRAND_P0_RULES.includes(v.rule);
}

/** P0 findings (error severity) as a flat list of human-readable strings. */
export function getP0Findings(result: LintResult): string[] {
  return result.violations
    .filter((v) => v.severity === 'error')
    .map((v) => `[${v.rule}] ${v.message}${v.fix ? ` — fix: ${v.fix}` : ''}`);
}

// Emoji commonly used as feature/UI icons in AI-generated HTML.
const EMOJI_ICON_PATTERN = /[✨🚀🎯💡🎨🔥✅❌⭐🌟💎🤖🧠🛠📈💰🎉👇👉⚡🎯🔮🎁]/u;

// Forbidden purple-family and dead per-mode accent hexes. Assembled via
// concatenation so this source file never contains the literals itself
// (design-law grep hygiene — the linter must not trip its own deny-list).
const PURPLE_HEXES = ['#636' + '6f1', '#818cf8', '#7c3a' + 'ed', '#8b5c' + 'f6', '#a78b' + 'fa', '#c4b5fd', '#9333ea', '#a855f7'];
const DEAD_MODE_ACCENTS = ['#d495' + '6a', '#79c4' + '7c', '#69a8' + 'c8'];
const FORBIDDEN_ACCENTS = new RegExp(PURPLE_HEXES.concat(DEAD_MODE_ACCENTS).join('|'), 'i');

export function lintGeneratedHtml(html: string): LintResult {
  const violations: LintViolation[] = [];

  // ── P0: Tailwind purple/indigo/violet defaults ────────────────────────────
  if (/(?:indigo|violet|purple|fuchsia)-\d{2,3}\b/i.test(html) ||
      FORBIDDEN_ACCENTS.test(html)) {
    violations.push({
      rule: 'no-purple-accent',
      severity: 'error',
      message: 'Purple/indigo accent detected (Tailwind default or raw hex) — use the design system amber accent (#B08D6E) instead.',
      fix: 'Replace with the amber accent scale: #B08D6E (primary), #C4A684 (hover), #9A7658 (muted).',
    });
  }

  // ── P0: legacy coral — reserved for platform UI chrome, never artifacts ──
  if (/#e27c59|#d97757/i.test(html)) {
    violations.push({
      rule: 'no-legacy-coral',
      severity: 'error',
      message: 'Legacy coral hex (#e27c59 / #d97757) detected — coral is reserved for Allternit platform UI, not generated artifacts.',
      fix: 'Replace with the amber accent scale: #B08D6E (primary), #C4A684 (hover), #9A7658 (muted).',
    });
  }

  // ── P0: cliché "trust gradient" spam ─────────────────────────────────────
  if (/linear-gradient\([^)]*(?:135deg|to right|to bottom right)[^)]*(?:purple|violet|indigo|fuchsia)/i.test(html) ||
      new RegExp(`linear-gradient\\([^)]*(?:135deg|to right|to bottom right)[^)]*(?:${['#8b5c' + 'f6', '#636' + '6f1', '#7c3a' + 'ed'].join('|')})`, 'i').test(html)) {
    violations.push({
      rule: 'no-trust-gradient',
      severity: 'error',
      message: 'Cliché purple→blue "trust gradient" detected — pick a solid surface or one decisive on-brand gradient.',
    });
  }
  const gradientCount = (html.match(/linear-gradient/g) ?? []).length;
  if (gradientCount > 3) {
    violations.push({
      rule: 'gradient-spam',
      severity: 'warning',
      message: `${gradientCount} linear-gradients detected — one decisive gradient per design, max.`,
    });
  }

  // ── P0: emoji used as icons ───────────────────────────────────────────────
  if (EMOJI_ICON_PATTERN.test(html)) {
    violations.push({
      rule: 'no-emoji-icons',
      severity: 'error',
      message: 'Emoji used as an icon/feature glyph — use inline SVG (currentColor) instead.',
      fix: 'Replace emoji with a minimal inline SVG icon.',
    });
  }

  // ── P0: lorem ipsum / filler copy ─────────────────────────────────────────
  if (/lorem ipsum/i.test(html)) {
    violations.push({ rule: 'no-lorem', severity: 'error', message: 'Lorem ipsum placeholder text detected — use realistic content.' });
  }

  if (/\bFeature (One|Two|Three)\b/.test(html)) {
    violations.push({
      rule: 'no-filler-features',
      severity: 'error',
      message: '"Feature One/Two/Three" filler detected — name real, specific capabilities from the brief.',
    });
  }

  // ── P0: invented metrics / social proof ───────────────────────────────────
  if (/(?:trusted|loved|used|chosen) by\s+[\d,.]+(?:k|m|\+)?\s+(?:teams|developers|companies|users|customers)/i.test(html) ||
      /\b\d+(?:\.\d+)?\s*[×x]\s*(?:faster|cheaper|more productive|better)/i.test(html) ||
      /99\.9%\s*uptime/i.test(html) ||
      /\b\d{1,3}(?:,\d{3})+\s*(?:\+\s*)?(?:happy|satisfied)?\s*(?:customers|users|reviews|downloads)\b/i.test(html)) {
    violations.push({
      rule: 'no-invented-metrics',
      severity: 'error',
      message: 'Invented metric or social-proof number detected ("trusted by 50,000 teams", "10× faster", "99.9% uptime") — use only figures supplied in the brief, or an honest labelled stub like [METRIC].',
    });
  }

  // ── Existing quality rules (unchanged severities) ─────────────────────────

  if (/\bplaceholder (text|content|here)\b/i.test(html)) {
    violations.push({ rule: 'no-placeholder-text', severity: 'warning', message: 'Generic placeholder text detected.' });
  }

  if (/placehold\.co|picsum|dummyimage|placeholder\.com/i.test(html)) {
    violations.push({ rule: 'no-cdn-placeholders', severity: 'error', message: 'External placeholder image CDN detected — use inline SVG or solid colors.' });
  }

  if (/scrollIntoView/i.test(html)) {
    violations.push({ rule: 'no-scroll-into-view', severity: 'warning', message: 'scrollIntoView detected — avoid in preview artifacts.' });
  }

  // Find uppercase blocks that lack letter-spacing — check each CSS block separately
  const styleBlocks = html.match(/text-transform:\s*uppercase[\s\S]*?(?:;|\})/gi) ?? [];
  const badCaps = styleBlocks.filter(block => !/letter-spacing/.test(block));
  if (badCaps.length > 2) {
    violations.push({ rule: 'caps-letter-spacing', severity: 'warning', message: 'ALL-CAPS text should include letter-spacing (0.05em+) for readability.' });
  }

  if (/fonts\.googleapis\.com/.test(html) && !html.includes('rel="preconnect"')) {
    violations.push({ rule: 'font-preconnect', severity: 'warning', message: 'Google Fonts loaded without preconnect — add <link rel="preconnect" href="https://fonts.googleapis.com">.' });
  }

  if (/<html/.test(html) && !/<title>/.test(html)) {
    violations.push({ rule: 'html-title', severity: 'warning', message: 'HTML document missing <title>.' });
  }

  if (/<input|<select|<textarea/.test(html) && !/<label/.test(html)) {
    violations.push({ rule: 'form-labels', severity: 'error', message: 'Form inputs detected without <label> elements — add labels for accessibility.' });
  }

  if (/\bon\w+\s*=\s*["']/i.test(html)) {
    violations.push({ rule: 'no-inline-handlers', severity: 'warning', message: 'Inline event handlers (onclick=, onload=) detected — use addEventListener instead.' });
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

  return {
    violations,
    score,
    passed: errorCount === 0,
  };
}
