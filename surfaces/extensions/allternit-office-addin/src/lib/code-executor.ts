/**
 * Code Executor — pattern from DocuPilotAI/DocuPilot (MIT)
 *
 * Extracts Office.js code blocks from AI responses and executes them
 * within the correct Office context. Provides error categorization
 * and structured retry metadata.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean
  output?: unknown
  error?: CodeExecutionError
  durationMs: number
  codeExecuted: string
}

export type ErrorCategory =
  | 'api_not_found'       // method/property doesn't exist (GeneralException, InvalidArgument)
  | 'permission_denied'   // protected range, sheet protection, read-only doc
  | 'invalid_argument'    // wrong enum value, out-of-range index
  | 'network'             // fetch failure inside code block
  | 'syntax'              // JavaScript syntax error in generated code
  | 'runtime'             // unexpected JS runtime error
  | 'unknown'

export interface CodeExecutionError {
  category: ErrorCategory
  message: string
  raw: string
  retryable: boolean
  suggestion: string
}

// ── Code Extraction ──────────────────────────────────────────────────────────

const CODE_BLOCK_PATTERNS = [
  /```(?:javascript|js|typescript|ts)\n([\s\S]*?)```/g,
  /```\n([\s\S]*?)```/g,
]

/**
 * Extracts the first code block from an AI response string.
 * Prefers language-tagged blocks (```javascript) over plain blocks (```).
 */
export function extractCode(responseText: string): string | null {
  for (const pattern of CODE_BLOCK_PATTERNS) {
    pattern.lastIndex = 0
    const match = pattern.exec(responseText)
    if (match?.[1]?.trim()) {
      return match[1].trim()
    }
  }
  return null
}

/**
 * Extracts all code blocks from a response.
 * Some AI responses contain multiple code blocks (e.g. setup + main logic).
 */
export function extractAllCode(responseText: string): string[] {
  const blocks: string[] = []
  for (const pattern of CODE_BLOCK_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(responseText)) !== null) {
      const code = match[1]?.trim()
      if (code) blocks.push(code)
    }
  }
  // Deduplicate while preserving order
  return [...new Set(blocks)]
}

// ── Error Categorization ─────────────────────────────────────────────────────

function categorizeError(err: unknown): CodeExecutionError {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  // Office.js OfficeExtension.Error codes
  if (lower.includes('generalexception') || lower.includes('api is not supported')) {
    return {
      category: 'api_not_found',
      message: 'The Office API method or property used is not available in this host/version.',
      raw,
      retryable: true,
      suggestion: 'Use getItemOrNullObject() and check isNullObject before accessing, or try an alternative API.',
    }
  }

  if (lower.includes('invalidargument') || lower.includes('invalid argument')) {
    return {
      category: 'invalid_argument',
      message: 'An invalid argument was passed to an Office API.',
      raw,
      retryable: true,
      suggestion: 'Check enum values (use Excel.ChartType.X not "X"), range addresses, and index bounds.',
    }
  }

  if (lower.includes('accessdenied') || lower.includes('protected') || lower.includes('read-only') || lower.includes('readonly')) {
    return {
      category: 'permission_denied',
      message: 'The document or range is protected and cannot be modified.',
      raw,
      retryable: false,
      suggestion: 'Unprotect the sheet or document, or target a different range.',
    }
  }

  if (lower.includes('syntaxerror') || lower.includes('unexpected token') || lower.includes('unexpected end')) {
    return {
      category: 'syntax',
      message: 'The generated code has a JavaScript syntax error.',
      raw,
      retryable: true,
      suggestion: 'Fix the syntax error in the code block and retry.',
    }
  }

  if (lower.includes('fetch') || lower.includes('networkerror') || lower.includes('failed to fetch')) {
    return {
      category: 'network',
      message: 'A network request inside the code block failed.',
      raw,
      retryable: true,
      suggestion: 'Check network connectivity and API endpoint URL.',
    }
  }

  return {
    category: 'unknown',
    message: 'An unexpected error occurred during code execution.',
    raw,
    retryable: true,
    suggestion: 'Review the code logic and error message for clues.',
  }
}

// ── Execution ────────────────────────────────────────────────────────────────

/**
 * Executes an Office.js code string within the correct host context.
 *
 * The code is wrapped in an async IIFE and executed with `new Function()`.
 * The Office namespace (Excel, Word, PowerPoint) is passed as a parameter
 * to ensure the correct context is available.
 *
 * SECURITY: Only call this with AI-generated code in a controlled environment.
 * The add-in sandbox limits what the code can access, but be aware that
 * arbitrary JS is being evaluated.
 */
export async function executeCode(code: string): Promise<ExecutionResult> {
  const start = performance.now()

  try {
    // Wrap code in async IIFE to support top-level await
    const wrappedCode = `
      return (async () => {
        ${code}
      })();
    `

    // Execute with Office namespace available as local
    // eslint-disable-next-line no-new-func
    const fn = new Function('Excel', 'Word', 'PowerPoint', 'Office', wrappedCode)
    const result = await fn(
      typeof Excel !== 'undefined' ? Excel : undefined,
      typeof Word !== 'undefined' ? Word : undefined,
      typeof PowerPoint !== 'undefined' ? PowerPoint : undefined,
      typeof Office !== 'undefined' ? Office : undefined,
    )

    return {
      success: true,
      output: result,
      durationMs: performance.now() - start,
      codeExecuted: code,
    }
  } catch (err) {
    return {
      success: false,
      error: categorizeError(err),
      durationMs: performance.now() - start,
      codeExecuted: code,
    }
  }
}

// ── Retry Logic ──────────────────────────────────────────────────────────────

export interface RetryContext {
  originalCode: string
  error: CodeExecutionError
  attemptNumber: number
}

/**
 * Builds a prompt for the AI to fix a failed code execution.
 * Pass this to the agent to get corrected code.
 */
export function buildRetryPrompt(ctx: RetryContext): string {
  return `The following Office.js code failed to execute (attempt ${ctx.attemptNumber}):

\`\`\`javascript
${ctx.originalCode}
\`\`\`

Error category: ${ctx.error.category}
Error message: ${ctx.error.raw}
Suggestion: ${ctx.error.suggestion}

Please fix the code and provide a corrected version. Return ONLY the corrected code block.`
}

/**
 * Executes code with automatic retry on retryable errors.
 * On failure, builds a retry prompt and calls the provided AI function.
 */
export async function executeWithRetry(
  code: string,
  options: {
    maxRetries: number
    onRetry?: (ctx: RetryContext, retryPrompt: string) => Promise<string>
  },
): Promise<ExecutionResult> {
  let currentCode = code
  let attempt = 0

  while (attempt <= options.maxRetries) {
    const result = await executeCode(currentCode)

    if (result.success) return result
    if (!result.error?.retryable) return result
    if (attempt >= options.maxRetries) return result

    attempt++

    if (!options.onRetry) return result

    const retryCtx: RetryContext = {
      originalCode: currentCode,
      error: result.error,
      attemptNumber: attempt,
    }
    const retryPrompt = buildRetryPrompt(retryCtx)
    const correctedResponse = await options.onRetry(retryCtx, retryPrompt)
    const correctedCode = extractCode(correctedResponse) ?? correctedResponse
    currentCode = correctedCode
  }

  // Should not reach here, but satisfy TypeScript
  return await executeCode(currentCode)
}
