export interface LintViolation {
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

export function lintGeneratedHtml(html: string): LintResult {
  const violations: LintViolation[] = [];

  if (/blue-\d00|#6366f1|#818cf8/i.test(html)) {
    violations.push({ rule: 'no-tailwind-indigo', severity: 'warning', message: 'Tailwind indigo detected — use design system accent color instead.' });
  }

  if (/lorem ipsum/i.test(html)) {
    violations.push({ rule: 'no-lorem', severity: 'error', message: 'Lorem ipsum placeholder text detected — use realistic content.' });
  }

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
