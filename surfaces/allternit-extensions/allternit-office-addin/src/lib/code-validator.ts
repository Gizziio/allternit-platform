/**
 * Code Security Validator
 *
 * Scans AI-generated Office.js code for dangerous patterns before execution.
 * Since the code runs via `new Function()` with access to the Office namespace,
 * we must prevent exfiltration, frame escape, and arbitrary network access.
 *
 * This is a defense-in-depth layer — the primary defense is that `buildToolCallCode`
 * only generates code from trusted templates with escaped arguments.
 */

export interface ValidationResult {
  safe: boolean
  violations: string[]
}

const DANGEROUS_PATTERNS = [
  {
    pattern: /\bfetch\s*\(/gi,
    message: 'fetch() is not allowed in Office.js tool code (network exfiltration risk)',
  },
  {
    pattern: /\bXMLHttpRequest\b/gi,
    message: 'XMLHttpRequest is not allowed in Office.js tool code',
  },
  {
    pattern: /\bWebSocket\b/gi,
    message: 'WebSocket is not allowed in Office.js tool code',
  },
  {
    pattern: /\beval\s*\(/gi,
    message: 'eval() is not allowed in Office.js tool code',
  },
  {
    pattern: /\bnew\s+Function\s*\(/gi,
    message: 'new Function() is not allowed in Office.js tool code',
  },
  {
    pattern: /\blocalStorage\b/gi,
    message: 'localStorage access is not allowed in Office.js tool code',
  },
  {
    pattern: /\bsessionStorage\b/gi,
    message: 'sessionStorage access is not allowed in Office.js tool code',
  },
  {
    pattern: /\bindexedDB\b/gi,
    message: 'indexedDB access is not allowed in Office.js tool code',
  },
  {
    pattern: /\bdocument\.cookie\b/gi,
    message: 'document.cookie access is not allowed',
  },
  {
    pattern: /\bwindow\.(parent|top|opener|location|postMessage)\b/gi,
    message: 'window.parent/top/opener/location/postMessage access is not allowed (frame escape risk)',
  },
  {
    pattern: /\bimport\s*\(/gi,
    message: 'dynamic imports are not allowed',
  },
  {
    pattern: /\brequire\s*\(/gi,
    message: 'require() is not allowed',
  },
  {
    pattern: /\bsetTimeout\s*\(\s*["'`]/gi,
    message: 'setTimeout with string argument is not allowed',
  },
  {
    pattern: /\bsetInterval\s*\(\s*["'`]/gi,
    message: 'setInterval with string argument is not allowed',
  },
  {
    pattern: /\bnavigator\.(sendBeacon|clipboard|permissions|mediaDevices)\b/gi,
    message: 'navigator APIs that could exfiltrate data are not allowed',
  },
]

/**
 * Validates generated Office.js code for dangerous patterns.
 * Returns safe=true if no violations found.
 */
export function validateCode(code: string): ValidationResult {
  const violations: string[] = []

  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(code)) {
      violations.push(message)
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  }
}

/**
 * Convenience wrapper that throws if the code is unsafe.
 */
export function assertCodeSafe(code: string): void {
  const result = validateCode(code)
  if (!result.safe) {
    throw new Error(
      `Code security validation failed:\n${result.violations.map((v) => '  - ' + v).join('\n')}`
    )
  }
}
