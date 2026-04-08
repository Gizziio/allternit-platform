/**
 * Plugin Loader — loads the correct plugin configuration based on the current Office host.
 *
 * Each plugin is a directory at plugins/{excel,powerpoint,word}/ containing:
 *   .claude-plugin/plugin.json — commands, skills, tool definitions, execution config
 *   system-prompt.md           — host-specific AI system prompt
 *   skills/                    — skill reference files
 *   commands/                  — command definition files
 *   cookbooks/                 — step-by-step usage guides
 *   tools/tool-definitions.ts  — tool schema definitions
 */

import { getOfficeHost, type OfficeHostType } from './host-detector'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PluginCommand {
  name: string
  trigger: string
  description: string
  skill?: string
}

export interface PluginSkill {
  name: string
  file: string
  description: string
}

export interface PluginCookbook {
  name: string
  file: string
  description: string
}

export interface PluginExecutionConfig {
  pattern: 'code-generation' | 'direct-text' | 'hybrid'
  errorRecovery: {
    maxRetries: number
    retryWithContext: boolean
    redlinePreferred?: boolean
  }
  forbiddenOps?: string[]
}

export interface PluginConfig {
  id: string
  name: string
  version: string
  host: string
  description: string
  commands: PluginCommand[]
  skills: PluginSkill[]
  cookbooks: PluginCookbook[]
  executionConfig: PluginExecutionConfig
  systemPromptPath: string
}

// ── Plugin Manifests (embedded — avoids runtime file reads in add-in sandbox) ─

const EXCEL_PLUGIN: PluginConfig = {
  id: 'allternit-excel',
  name: 'Allternit for Excel',
  version: '1.0.0',
  host: 'excel',
  description: 'Excel-native plugin: data analysis, financial modeling, chart generation, formula assistance, and data validation.',
  executionConfig: {
    pattern: 'code-generation',
    errorRecovery: {
      maxRetries: 3,
      retryWithContext: true,
    },
    forbiddenOps: [],
  },
  systemPromptPath: 'src/plugins/vendor/office-excel/system-prompt.md',
  commands: [
    { name: 'excel:analyze', trigger: 'analyze, what\'s in this, summarize this data', description: 'Analyze active sheet or selection' },
    { name: 'excel:formula', trigger: 'write a formula, calculate, XLOOKUP', description: 'Insert or fix formulas' },
    { name: 'excel:chart',   trigger: 'create a chart, visualize, plot', description: 'Create charts from data' },
    { name: 'excel:table',   trigger: 'make this a table, sort by, filter to', description: 'Create or modify Excel tables' },
    { name: 'excel:format',  trigger: 'format as currency, highlight, color code', description: 'Format cells and ranges' },
    { name: 'excel:model',   trigger: 'build a DCF, create a P&L, financial model', description: 'Build financial models' },
    { name: 'excel:clean',   trigger: 'clean this data, remove duplicates, trim', description: 'Clean and normalize data' },
  ],
  skills: [
    { name: 'range-operations',   file: 'src/plugins/vendor/office-excel/skills/range-operations.md',   description: 'Reading and writing cell ranges' },
    { name: 'formula-generation', file: 'src/plugins/vendor/office-excel/skills/formula-generation.md', description: 'Generating error-free formulas' },
    { name: 'table-operations',   file: 'src/plugins/vendor/office-excel/skills/table-operations.md',   description: 'ListObject table API' },
    { name: 'chart-creation',     file: 'src/plugins/vendor/office-excel/skills/chart-creation.md',     description: 'Chart type enums and creation patterns' },
    { name: 'cell-formatting',    file: 'src/plugins/vendor/office-excel/skills/cell-formatting.md',    description: 'Number formats, fonts, conditional formatting' },
    { name: 'worksheet-management', file: 'src/plugins/vendor/office-excel/skills/worksheet-management.md', description: 'Sheet navigation and management' },
    { name: 'financial-modeling', file: 'src/plugins/vendor/office-excel/skills/financial-modeling.md', description: 'DCF, 3-statement, P&L model patterns' },
    { name: 'data-validation',    file: 'src/plugins/vendor/office-excel/skills/data-validation.md',    description: 'Dropdowns, number/date/custom validation' },
  ],
  cookbooks: [
    { name: 'dcf-model',         file: 'src/plugins/vendor/office-excel/cookbooks/dcf-model.md',         description: 'Build a DCF model from scratch' },
    { name: 'data-cleaning',     file: 'src/plugins/vendor/office-excel/cookbooks/data-cleaning.md',     description: 'Clean a messy dataset' },
    { name: 'dashboard-creation',file: 'src/plugins/vendor/office-excel/cookbooks/dashboard-creation.md',description: 'Build an Excel dashboard' },
    { name: 'pivot-analysis',    file: 'src/plugins/vendor/office-excel/cookbooks/pivot-analysis.md',    description: 'Pivot-style analysis with SUMIF' },
  ],
}

const POWERPOINT_PLUGIN: PluginConfig = {
  id: 'allternit-powerpoint',
  name: 'Allternit for PowerPoint',
  version: '1.0.0',
  host: 'powerpoint',
  description: 'PowerPoint-native plugin: slide generation, content rewriting, design application, speaker notes, and presentation summarization.',
  executionConfig: {
    pattern: 'code-generation',
    errorRecovery: {
      maxRetries: 2,
      retryWithContext: true,
    },
  },
  systemPromptPath: 'src/plugins/vendor/office-powerpoint/system-prompt.md',
  commands: [
    { name: 'ppt:slide',      trigger: 'add a slide, create a slide, insert a slide', description: 'Add and populate a slide' },
    { name: 'ppt:rewrite',    trigger: 'rewrite slide, improve wording, make more concise', description: 'Rewrite slide content' },
    { name: 'ppt:outline',    trigger: 'create a presentation about, generate an outline', description: 'Generate full presentation from outline' },
    { name: 'ppt:design',     trigger: 'apply branding, design this, color scheme', description: 'Apply visual design to slides' },
    { name: 'ppt:notes',      trigger: 'add speaker notes, generate notes, summarize notes', description: 'Generate or edit speaker notes' },
    { name: 'ppt:summarize',  trigger: 'summarize this presentation, what is this deck about', description: 'Summarize presentation content' },
  ],
  skills: [
    { name: 'slide-operations',     file: 'src/plugins/vendor/office-powerpoint/skills/slide-operations.md',     description: 'Add, delete, navigate slides' },
    { name: 'shape-text',           file: 'src/plugins/vendor/office-powerpoint/skills/shape-text.md',           description: 'Read and write shape text' },
    { name: 'presentation-context', file: 'src/plugins/vendor/office-powerpoint/skills/presentation-context.md', description: 'Presentation metadata and structure' },
    { name: 'slide-design',         file: 'src/plugins/vendor/office-powerpoint/skills/slide-design.md',         description: 'Background, palette, layout, typography' },
    { name: 'speaker-notes',        file: 'src/plugins/vendor/office-powerpoint/skills/speaker-notes.md',        description: 'Read and write speaker notes' },
    { name: 'export-save',          file: 'src/plugins/vendor/office-powerpoint/skills/export-save.md',          description: 'Export as .pptx and save operations' },
  ],
  cookbooks: [
    { name: 'pitch-deck',           file: 'src/plugins/vendor/office-powerpoint/cookbooks/pitch-deck.md',           description: 'Build a 10-slide investor pitch deck' },
    { name: 'presentation-redesign',file: 'src/plugins/vendor/office-powerpoint/cookbooks/presentation-redesign.md',description: 'Redesign an existing presentation' },
    { name: 'slide-from-data',      file: 'src/plugins/vendor/office-powerpoint/cookbooks/slide-from-data.md',      description: 'Create data-driven slides' },
    { name: 'executive-briefing',   file: 'src/plugins/vendor/office-powerpoint/cookbooks/executive-briefing.md',   description: 'Build an executive briefing deck' },
  ],
}

const WORD_PLUGIN: PluginConfig = {
  id: 'allternit-word',
  name: 'Allternit for Word',
  version: '1.0.0',
  host: 'word',
  description: 'Word-native plugin: document rewriting, grammar improvement, summarization, table creation, tracked-change redlining, template filling, and structure analysis.',
  executionConfig: {
    pattern: 'hybrid',
    errorRecovery: {
      maxRetries: 2,
      retryWithContext: true,
      redlinePreferred: true,
    },
    forbiddenOps: ['body.clear()'],
  },
  systemPromptPath: 'src/plugins/vendor/office-word/system-prompt.md',
  commands: [
    { name: 'word:rewrite',   trigger: 'rewrite this, improve this, make more professional', description: 'Rewrite selected text with tracked changes' },
    { name: 'word:improve',   trigger: 'improve this document, fix grammar, polish this draft', description: 'Grammar and style improvement' },
    { name: 'word:summarize', trigger: 'summarize this document, key points, TL;DR', description: 'Summarize document content' },
    { name: 'word:table',     trigger: 'create a table, insert a table, make this a table', description: 'Insert Word tables' },
    { name: 'word:redline',   trigger: 'redline this, tracked changes, mark up, suggest edits', description: 'Redline with tracked changes' },
    { name: 'word:template',  trigger: 'fill in this template, populate template, fill out', description: 'Fill content controls and placeholders' },
    { name: 'word:structure', trigger: 'show structure, headings, add table of contents, reorganize', description: 'Analyze and improve document structure' },
  ],
  skills: [
    { name: 'body-text',           file: 'src/plugins/vendor/office-word/skills/body-text.md',           description: 'Document body read/write operations' },
    { name: 'paragraph-operations',file: 'src/plugins/vendor/office-word/skills/paragraph-operations.md',description: 'Paragraph iteration, styles, headings' },
    { name: 'selection-range',     file: 'src/plugins/vendor/office-word/skills/selection-range.md',     description: 'Selection read/replace/search' },
    { name: 'table-operations',    file: 'src/plugins/vendor/office-word/skills/table-operations.md',    description: 'Word table creation and editing' },
    { name: 'tracked-changes',     file: 'src/plugins/vendor/office-word/skills/tracked-changes.md',     description: 'Track changes and redline patterns' },
    { name: 'content-controls',    file: 'src/plugins/vendor/office-word/skills/content-controls.md',    description: 'Content controls and bookmarks' },
    { name: 'document-properties', file: 'src/plugins/vendor/office-word/skills/document-properties.md', description: 'Document metadata and context' },
    { name: 'formatting',          file: 'src/plugins/vendor/office-word/skills/formatting.md',           description: 'Font, paragraph spacing, alignment' },
  ],
  cookbooks: [
    { name: 'contract-review',  file: 'src/plugins/vendor/office-word/cookbooks/contract-review.md',  description: 'Contract review and redline workflow' },
    { name: 'report-writing',   file: 'src/plugins/vendor/office-word/cookbooks/report-writing.md',   description: 'Write a professional report' },
    { name: 'document-cleanup', file: 'src/plugins/vendor/office-word/cookbooks/document-cleanup.md', description: 'Clean up a messy document' },
    { name: 'template-filling', file: 'src/plugins/vendor/office-word/cookbooks/template-filling.md', description: 'Fill a document template' },
  ],
}

// ── Loader ───────────────────────────────────────────────────────────────────

const PLUGIN_MAP: Record<OfficeHostType, PluginConfig | null> = {
  excel:       EXCEL_PLUGIN,
  powerpoint:  POWERPOINT_PLUGIN,
  word:        WORD_PLUGIN,
  unknown:     null,
}

/**
 * Returns the plugin configuration for the current Office host.
 * Returns null if the host is unknown or not supported.
 */
export function loadPlugin(): PluginConfig | null {
  return PLUGIN_MAP[getOfficeHost()]
}

/**
 * Returns the plugin for a specific host type.
 */
export function loadPluginForHost(host: OfficeHostType): PluginConfig | null {
  return PLUGIN_MAP[host]
}

/**
 * Returns the system prompt prefix for the active plugin.
 * Includes: plugin name, execution rules, forbidden ops, and command list.
 */
export function buildPluginSystemPromptPrefix(plugin: PluginConfig): string {
  const lines: string[] = [
    `You are the ${plugin.name} assistant, part of the Allternit AI platform.`,
    `Host: ${plugin.host} | Execution pattern: ${plugin.executionConfig.pattern}`,
    '',
    '## Execution Rules',
    `- Max retries on error: ${plugin.executionConfig.errorRecovery.maxRetries}`,
  ]

  if (plugin.executionConfig.forbiddenOps?.length) {
    lines.push(`- FORBIDDEN operations: ${plugin.executionConfig.forbiddenOps.join(', ')}`)
  }

  if (plugin.executionConfig.errorRecovery.redlinePreferred) {
    lines.push('- Always use tracked changes for text edits (Word.ChangeTrackingMode.trackAll)')
  }

  lines.push('', '## Available Commands')
  for (const cmd of plugin.commands) {
    lines.push(`- \`${cmd.name}\`: ${cmd.description} (triggers: "${cmd.trigger}")`)
  }

  return lines.join('\n')
}
