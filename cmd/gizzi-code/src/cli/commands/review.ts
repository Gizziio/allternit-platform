/**
 * Review Command
 * Automated code review and quality analysis
 */

import { log } from './utils/log.js'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface ReviewOptions {
  staged?: boolean
  uncommitted?: boolean
  files?: string[]
  format?: 'text' | 'json'
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info'
  file: string
  line?: number
  column?: number
  message: string
  rule?: string
  suggestion?: string
}

export interface ReviewReport {
  summary: {
    filesAnalyzed: number
    issuesFound: number
    errors: number
    warnings: number
    infos: number
  }
  issues: ReviewIssue[]
  suggestions: string[]
}

/**
 * Get changed files from git
 */
function getChangedFiles(staged = false, uncommitted = false): string[] {
  try {
    let cmd = ''
    if (staged) {
      cmd = 'git diff --cached --name-only --diff-filter=ACM'
    } else if (uncommitted) {
      cmd = 'git diff --name-only --diff-filter=ACM'
    } else {
      cmd = 'git diff HEAD~1 --name-only --diff-filter=ACM'
    }
    
    const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() })
    return output.trim().split('\n').filter(f => f && existsSync(f))
  } catch {
    return []
  }
}

/**
 * Analyze a single file for issues
 */
function analyzeFile(filePath: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  
  if (!existsSync(filePath)) return issues
  
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const ext = filePath.split('.').pop()?.toLowerCase()
  
  // Check for common issues based on file type
  lines.forEach((line, index) => {
    const lineNum = index + 1
    
    // Check for TODO/FIXME in code (not in comments)
    if (!line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')) {
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          severity: 'warning',
          file: filePath,
          line: lineNum,
          message: 'TODO/FIXME found in code',
          rule: 'todo-in-code',
          suggestion: 'Resolve TODO before committing or move to issue tracker',
        })
      }
    }
    
    // Check for console.log (should use proper logging)
    if (line.includes('console.log') && !filePath.includes('test')) {
      issues.push({
        severity: 'info',
        file: filePath,
        line: lineNum,
        message: 'console.log found - consider using structured logging',
        rule: 'console-log',
      })
    }
    
    // Check for very long lines
    if (line.length > 120) {
      issues.push({
        severity: 'info',
        file: filePath,
        line: lineNum,
        message: `Line too long (${line.length} chars)`,
        rule: 'line-length',
        suggestion: 'Consider breaking into multiple lines',
      })
    }
    
    // TypeScript/JavaScript specific
    if (ext === 'ts' || ext === 'tsx' || ext === 'js') {
      // Check for any usage
      if (line.includes(': any') && !line.includes('@ts-ignore')) {
        issues.push({
          severity: 'warning',
          file: filePath,
          line: lineNum,
          message: '`any` type used - prefer specific types',
          rule: 'no-any',
        })
      }
      
      // Check for non-null assertions
      if (line.includes('!.')) {
        issues.push({
          severity: 'info',
          file: filePath,
          line: lineNum,
          message: 'Non-null assertion used',
          rule: 'non-null-assertion',
          suggestion: 'Add proper null checks',
        })
      }
    }
  })
  
  return issues
}

/**
 * Run type checking
 */
function runTypeCheck(): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  
  try {
    execSync('bun tsc --noEmit', { 
      encoding: 'utf-8', 
      cwd: process.cwd(),
      stdio: 'pipe',
    })
  } catch (error: any) {
    const output = error.stdout || error.message || ''
    const lines = output.split('\n')
    
    for (const line of lines) {
      const match = line.match(/(.+)\((\d+),(\d+)\): error (.+): (.+)/)
      if (match) {
        issues.push({
          severity: 'error',
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[5],
          rule: match[4],
        })
      }
    }
  }
  
  return issues
}

/**
 * Generate review suggestions
 */
function generateSuggestions(issues: ReviewIssue[]): string[] {
  const suggestions: string[] = []
  const errors = issues.filter(i => i.severity === 'error').length
  const warnings = issues.filter(i => i.severity === 'warning').length
  
  if (errors > 0) {
    suggestions.push(`Fix ${errors} error(s) before committing`)
  }
  
  if (warnings > 10) {
    suggestions.push('Consider addressing warnings to improve code quality')
  }
  
  if (issues.some(i => i.rule === 'todo-in-code')) {
    suggestions.push('Create tickets for TODO items to track technical debt')
  }
  
  if (issues.some(i => i.rule === 'no-any')) {
    suggestions.push('Add proper TypeScript types instead of using `any`')
  }
  
  return suggestions
}

/**
 * Format review report
 */
function formatReport(report: ReviewReport, format: 'text' | 'json'): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2)
  }
  
  const lines: string[] = []
  lines.push('═'.repeat(60))
  lines.push('Code Review Report')
  lines.push('═'.repeat(60))
  lines.push('')
  
  // Summary
  lines.push(`Files analyzed: ${report.summary.filesAnalyzed}`)
  lines.push(`Issues found: ${report.summary.issuesFound}`)
  lines.push(`  Errors: ${report.summary.errors}`)
  lines.push(`  Warnings: ${report.summary.warnings}`)
  lines.push(`  Info: ${report.summary.infos}`)
  lines.push('')
  
  // Issues by severity
  const errors = report.issues.filter(i => i.severity === 'error')
  const warnings = report.issues.filter(i => i.severity === 'warning')
  const infos = report.issues.filter(i => i.severity === 'info')
  
  if (errors.length > 0) {
    lines.push('Errors:')
    for (const issue of errors.slice(0, 10)) {
      const location = issue.line ? `:${issue.line}` : ''
      lines.push(`  ❌ ${issue.file}${location}`)
      lines.push(`     ${issue.message}`)
      if (issue.suggestion) {
        lines.push(`     → ${issue.suggestion}`)
      }
    }
    if (errors.length > 10) {
      lines.push(`  ... and ${errors.length - 10} more errors`)
    }
    lines.push('')
  }
  
  if (warnings.length > 0) {
    lines.push('Warnings:')
    for (const issue of warnings.slice(0, 5)) {
      const location = issue.line ? `:${issue.line}` : ''
      lines.push(`  ⚠️  ${issue.file}${location} - ${issue.message}`)
    }
    if (warnings.length > 5) {
      lines.push(`  ... and ${warnings.length - 5} more warnings`)
    }
    lines.push('')
  }
  
  // Suggestions
  if (report.suggestions.length > 0) {
    lines.push('Suggestions:')
    for (const suggestion of report.suggestions) {
      lines.push(`  💡 ${suggestion}`)
    }
    lines.push('')
  }
  
  return lines.join('\n')
}

/**
 * Execute review command
 */
export default async function reviewCommand(
  args: string[] = [],
  options: ReviewOptions = {}
): Promise<void> {
  const staged = args.includes('--staged') || options.staged || false
  const uncommitted = args.includes('--uncommitted') || options.uncommitted || false
  const format = (args.find(a => a.startsWith('--format='))?.split('=')[1] as 'text' | 'json') || options.format || 'text'
  
  log('info', 'Running code review...')
  
  // Get files to review
  let files: string[]
  if (options.files && options.files.length > 0) {
    files = options.files.filter(f => existsSync(f))
  } else {
    files = getChangedFiles(staged, uncommitted)
  }
  
  if (files.length === 0) {
    log('info', 'No files to review')
    log('info', 'Use --staged to review staged files, --uncommitted for uncommitted changes')
    return
  }
  
  log('info', `Analyzing ${files.length} file(s)...`)
  
  // Analyze each file
  const allIssues: ReviewIssue[] = []
  for (const file of files) {
    const issues = analyzeFile(file)
    allIssues.push(...issues)
  }
  
  // Run type check
  const typeIssues = runTypeCheck()
  allIssues.push(...typeIssues)
  
  // Generate report
  const report: ReviewReport = {
    summary: {
      filesAnalyzed: files.length,
      issuesFound: allIssues.length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      infos: allIssues.filter(i => i.severity === 'info').length,
    },
    issues: allIssues,
    suggestions: generateSuggestions(allIssues),
  }
  
  // Output report
  console.log(formatReport(report, format))
  
  // Exit with error code if there are errors
  if (report.summary.errors > 0) {
    process.exit(1)
  }
}

export { getChangedFiles, analyzeFile, runTypeCheck, formatReport }
