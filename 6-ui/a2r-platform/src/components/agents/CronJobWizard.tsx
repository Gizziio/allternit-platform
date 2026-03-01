/**
 * Cron Job Wizard - Enhanced Version
 * 
 * Comprehensive job scheduling with:
 * - Task templates (run program, API call, file operations, etc.)
 * - LLM-assisted prompt generation
 * - Customizable task parameters
 * - Preview and validation
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Clock,
  Play,
  Save,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Terminal,
  Globe,
  FileText,
  Database,
  Mail,
  Code,
  Settings,
  Wand2,
  Bot,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type TaskType = 
  | "code-review"
  | "generate-docs"
  | "dependency-check"
  | "summarize-activity"
  | "monitor-alerts"
  | "organize-files"
  | "content-curation"
  | "pr-prep"
  | "smart-backup"
  | "custom-task";

export interface TaskTemplate {
  id: TaskType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "development" | "maintenance" | "operations" | "communication" | "research" | "custom";
  defaultPrompt: string;
  parameters: TaskParameter[];
  examples: string[];
}

export interface TaskParameter {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "select" | "multi-select" | "textarea" | "json";
  required: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  placeholder?: string;
  description?: string;
}

export interface CronJobConfig {
  name: string;
  description?: string;
  schedule: string;
  taskType: TaskType;
  parameters: Record<string, unknown>;
  prompt: string;
  enabled: boolean;
  maxRetries: number;
  timeout: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

interface CronJobWizardProps {
  isOpen?: boolean;
  onClose: () => void;
  onSubmit: (config: CronJobConfig) => Promise<void>;
  onComplete?: (config: CronJobConfig) => void | Promise<void>;
  onCancel?: () => void;
  onGeneratePrompt?: (taskType: TaskType, parameters: Record<string, unknown>) => Promise<string>;
  defaultPrompt?: string;
  accentColor?: string;
  initialConfig?: Partial<CronJobConfig>;
}

type WizardStep = "template" | "configure" | "schedule" | "review" | "success";

// ============================================================================
// Task Templates - Real-world tasks users actually want
// ============================================================================

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "code-review",
    name: "Review Recent Code",
    description: "Review recent commits and provide feedback",
    icon: <Code size={20} />,
    category: "development",
    defaultPrompt: "Review the recent code changes and provide constructive feedback:",
    parameters: [
      {
        id: "lookback",
        name: "Review Period",
        type: "select",
        required: true,
        defaultValue: "24h",
        options: [
          { label: "Last 24 hours", value: "24h" },
          { label: "Last 3 days", value: "3d" },
          { label: "Last week", value: "1w" },
          { label: "Since last review", value: "since_last" },
        ],
        description: "Time period to review",
      },
      {
        id: "focusAreas",
        name: "Focus Areas",
        type: "multi-select",
        required: false,
        options: [
          { label: "Security issues", value: "security" },
          { label: "Performance", value: "performance" },
          { label: "Code style", value: "style" },
          { label: "Architecture", value: "architecture" },
          { label: "Tests coverage", value: "tests" },
        ],
        description: "What to focus on in the review",
      },
      {
        id: "outputFormat",
        name: "Output Format",
        type: "select",
        required: true,
        defaultValue: "summary",
        options: [
          { label: "Brief summary", value: "summary" },
          { label: "Detailed report", value: "detailed" },
          { label: "Action items only", value: "actions" },
        ],
      },
    ],
    examples: [
      "Daily code review",
      "Weekly team review",
      "Pre-release review",
    ],
  },
  {
    id: "generate-docs",
    name: "Update Documentation",
    description: "Generate or update docs from code changes",
    icon: <FileText size={20} />,
    category: "development",
    defaultPrompt: "Review recent code changes and update the documentation accordingly:",
    parameters: [
      {
        id: "docType",
        name: "Documentation Type",
        type: "select",
        required: true,
        defaultValue: "api",
        options: [
          { label: "API documentation", value: "api" },
          { label: "README updates", value: "readme" },
          { label: "Changelog", value: "changelog" },
          { label: "Architecture decisions", value: "adr" },
          { label: "Inline code comments", value: "comments" },
        ],
      },
      {
        id: "sourcePaths",
        name: "Source Files/Directories",
        type: "string",
        required: true,
        placeholder: "src/api, src/components",
        description: "Comma-separated paths to scan for changes",
      },
      {
        id: "docLocation",
        name: "Documentation Location",
        type: "string",
        required: false,
        placeholder: "docs/api.md",
        description: "Where to write/update the docs",
      },
      {
        id: "style",
        name: "Documentation Style",
        type: "select",
        required: false,
        defaultValue: "concise",
        options: [
          { label: "Concise (bullet points)", value: "concise" },
          { label: "Detailed (full explanations)", value: "detailed" },
          { label: "Tutorial style", value: "tutorial" },
        ],
      },
    ],
    examples: [
      "Auto-update API docs",
      "Keep README in sync",
      "Generate changelogs",
    ],
  },
  {
    id: "dependency-check",
    name: "Check Dependencies",
    description: "Check for outdated or vulnerable dependencies",
    icon: <Settings size={20} />,
    category: "maintenance",
    defaultPrompt: "Check the project dependencies and report on status:",
    parameters: [
      {
        id: "checkType",
        name: "Check Type",
        type: "multi-select",
        required: true,
        options: [
          { label: "Outdated packages", value: "outdated" },
          { label: "Security vulnerabilities", value: "security" },
          { label: "Unused dependencies", value: "unused" },
          { label: "License compliance", value: "licenses" },
        ],
      },
      {
        id: "packageFile",
        name: "Package File",
        type: "string",
        required: false,
        placeholder: "package.json, Cargo.toml, requirements.txt",
        description: "Path to package manifest (auto-detect if empty)",
      },
      {
        id: "severity",
        name: "Minimum Severity",
        type: "select",
        required: false,
        defaultValue: "moderate",
        options: [
          { label: "Critical only", value: "critical" },
          { label: "High and above", value: "high" },
          { label: "Moderate and above", value: "moderate" },
          { label: "All", value: "all" },
        ],
        description: "For security vulnerabilities",
      },
      {
        id: "autoFix",
        name: "Suggest Fixes",
        type: "boolean",
        required: false,
        defaultValue: true,
        description: "Include suggested updates/fixes",
      },
    ],
    examples: [
      "Weekly security audit",
      "Dependency health check",
      "Pre-release verification",
    ],
  },
  {
    id: "summarize-activity",
    name: "Summarize Activity",
    description: "Summarize recent project activity for stakeholders",
    icon: <FileText size={20} />,
    category: "communication",
    defaultPrompt: "Summarize the recent project activity for stakeholders:",
    parameters: [
      {
        id: "period",
        name: "Time Period",
        type: "select",
        required: true,
        defaultValue: "1w",
        options: [
          { label: "Today", value: "1d" },
          { label: "This week", value: "1w" },
          { label: "This sprint (2 weeks)", value: "2w" },
          { label: "This month", value: "1m" },
        ],
      },
      {
        id: "sources",
        name: "Include Sources",
        type: "multi-select",
        required: true,
        options: [
          { label: "Git commits", value: "commits" },
          { label: "Pull requests", value: "prs" },
          { label: "Issues closed", value: "issues" },
          { label: "Code reviews", value: "reviews" },
          { label: "Documentation changes", value: "docs" },
        ],
      },
      {
        id: "audience",
        name: "Audience",
        type: "select",
        required: true,
        defaultValue: "team",
        options: [
          { label: "Development team", value: "team" },
          { label: "Product managers", value: "product" },
          { label: "Executives (high-level)", value: "exec" },
          { label: "External stakeholders", value: "external" },
        ],
        description: "Tailors tone and detail level",
      },
      {
        id: "outputFormat",
        name: "Output Format",
        type: "select",
        required: true,
        defaultValue: "slack",
        options: [
          { label: "Slack message", value: "slack" },
          { label: "Email", value: "email" },
          { label: "Markdown report", value: "markdown" },
          { label: "Bullet points", value: "bullets" },
        ],
      },
    ],
    examples: [
      "Daily standup summary",
      "Weekly team update",
      "Sprint retrospective prep",
    ],
  },
  {
    id: "monitor-alerts",
    name: "Monitor & Alert",
    description: "Monitor metrics/logs and alert on conditions",
    icon: <Terminal size={20} />,
    category: "operations",
    defaultPrompt: "Monitor the specified metrics and report any issues:",
    parameters: [
      {
        id: "whatToMonitor",
        name: "What to Monitor",
        type: "select",
        required: true,
        options: [
          { label: "Error logs", value: "errors" },
          { label: "Performance metrics", value: "performance" },
          { label: "Test results", value: "tests" },
          { label: "Build status", value: "builds" },
          { label: "Security events", value: "security" },
          { label: "Disk/Resource usage", value: "resources" },
        ],
      },
      {
        id: "sourcePath",
        name: "Log/Metrics Source",
        type: "string",
        required: true,
        placeholder: "/var/log/app.log, logs/*.log, or metrics endpoint",
        description: "Where to read data from",
      },
      {
        id: "alertCondition",
        name: "Alert Condition",
        type: "select",
        required: true,
        defaultValue: "any_error",
        options: [
          { label: "Any errors found", value: "any_error" },
          { label: "Error count > threshold", value: "error_count" },
          { label: "Specific pattern found", value: "pattern" },
          { label: "Performance degradation", value: "performance" },
        ],
      },
      {
        id: "threshold",
        name: "Threshold (if applicable)",
        type: "number",
        required: false,
        placeholder: "e.g., 5",
        description: "Number of occurrences to trigger alert",
      },
      {
        id: "notifyMethod",
        name: "Notification Method",
        type: "select",
        required: true,
        defaultValue: "log",
        options: [
          { label: "Log only (no alert)", value: "log" },
          { label: "Slack notification", value: "slack" },
          { label: "Email alert", value: "email" },
          { label: "Create issue", value: "issue" },
        ],
      },
    ],
    examples: [
      "Error log monitoring",
      "Performance tracking",
      "Failed test detection",
    ],
  },
  {
    id: "organize-files",
    name: "Organize Files",
    description: "Auto-organize files based on rules",
    icon: <FileText size={20} />,
    category: "maintenance",
    defaultPrompt: "Organize files according to the specified rules:",
    parameters: [
      {
        id: "sourceDir",
        name: "Source Directory",
        type: "string",
        required: true,
        placeholder: "~/Downloads or /workspace/uploads",
        description: "Directory to organize",
      },
      {
        id: "organizationType",
        name: "Organize By",
        type: "select",
        required: true,
        defaultValue: "date",
        options: [
          { label: "Date (year/month)", value: "date" },
          { label: "File type", value: "type" },
          { label: "Project/Topic", value: "project" },
          { label: "Custom rules", value: "custom" },
        ],
      },
      {
        id: "fileTypes",
        name: "File Types to Process",
        type: "multi-select",
        required: false,
        options: [
          { label: "Documents", value: "documents" },
          { label: "Images", value: "images" },
          { label: "Videos", value: "videos" },
          { label: "Archives", value: "archives" },
          { label: "Code files", value: "code" },
          { label: "All files", value: "all" },
        ],
      },
      {
        id: "actions",
        name: "Actions",
        type: "multi-select",
        required: true,
        options: [
          { label: "Move to folders", value: "move" },
          { label: "Rename consistently", value: "rename" },
          { label: "Delete duplicates", value: "dedup" },
          { label: "Archive old files", value: "archive" },
        ],
      },
      {
        id: "dryRun",
        name: "Dry Run First",
        type: "boolean",
        required: false,
        defaultValue: true,
        description: "Preview changes before applying",
      },
    ],
    examples: [
      "Organize downloads folder",
      "Archive old project files",
      "Clean up temp directories",
    ],
  },
  {
    id: "content-curation",
    name: "Content Curation",
    description: "Find and summarize relevant content",
    icon: <Globe size={20} />,
    category: "research",
    defaultPrompt: "Search for and summarize relevant content on the topic:",
    parameters: [
      {
        id: "topic",
        name: "Topic/Keywords",
        type: "string",
        required: true,
        placeholder: "AI agents, Rust web frameworks, etc.",
        description: "What to research",
      },
      {
        id: "sources",
        name: "Sources to Check",
        type: "multi-select",
        required: true,
        options: [
          { label: "RSS feeds", value: "rss" },
          { label: "Hacker News", value: "hackernews" },
          { label: "Reddit", value: "reddit" },
          { label: "Dev.to / Medium", value: "blogs" },
          { label: "GitHub trending", value: "github" },
          { label: "ArXiv papers", value: "arxiv" },
        ],
      },
      {
        id: "contentType",
        name: "Content Type",
        type: "multi-select",
        required: false,
        options: [
          { label: "News articles", value: "news" },
          { label: "Tutorials/Guides", value: "tutorials" },
          { label: "Research papers", value: "papers" },
          { label: "Tools/Libraries", value: "tools" },
          { label: "Discussions", value: "discussions" },
        ],
      },
      {
        id: "outputFormat",
        name: "Output Format",
        type: "select",
        required: true,
        defaultValue: "digest",
        options: [
          { label: "Brief digest (top 5)", value: "digest" },
          { label: "Full summary with links", value: "full" },
          { label: "TL;DR only", value: "tldr" },
        ],
      },
    ],
    examples: [
      "Weekly tech news digest",
      "Research on new tools",
      "Stay updated on frameworks",
    ],
  },
  {
    id: "pr-prep",
    name: "Prepare PR Summary",
    description: "Generate PR description from branch changes",
    icon: <Code size={20} />,
    category: "development",
    defaultPrompt: "Review the branch changes and prepare a comprehensive PR summary:",
    parameters: [
      {
        id: "branch",
        name: "Branch to Compare",
        type: "string",
        required: false,
        placeholder: "current branch (auto-detect)",
        description: "Branch with changes (defaults to current)",
      },
      {
        id: "baseBranch",
        name: "Base Branch",
        type: "string",
        required: false,
        defaultValue: "main",
        placeholder: "main, master, develop",
        description: "Branch to compare against",
      },
      {
        id: "include",
        name: "Include Sections",
        type: "multi-select",
        required: true,
        options: [
          { label: "Summary of changes", value: "summary" },
          { label: "Breaking changes", value: "breaking" },
          { label: "Testing instructions", value: "testing" },
          { label: "Screenshots/GIFs needed", value: "visuals" },
          { label: "Related issues", value: "issues" },
          { label: "Deployment notes", value: "deployment" },
        ],
      },
      {
        id: "template",
        name: "Template Style",
        type: "select",
        required: true,
        defaultValue: "conventional",
        options: [
          { label: "Conventional (standard)", value: "conventional" },
          { label: "Detailed (comprehensive)", value: "detailed" },
          { label: "Minimal (bullet points)", value: "minimal" },
        ],
      },
    ],
    examples: [
      "Auto-generate PR descriptions",
      "Standardize PR format",
      "Ensure nothing is missed",
    ],
  },
  {
    id: "smart-backup",
    name: "Smart Project Backup",
    description: "Intelligent backup of important project files",
    icon: <Save size={20} />,
    category: "maintenance",
    defaultPrompt: "Create a backup of the project, prioritizing important files:",
    parameters: [
      {
        id: "whatToBackup",
        name: "What to Backup",
        type: "multi-select",
        required: true,
        options: [
          { label: "Source code (exclude node_modules)", value: "source" },
          { label: "Configuration files", value: "config" },
          { label: "Database dumps", value: "database" },
          { label: "Documentation", value: "docs" },
          { label: "Environment files (.env)", value: "env" },
          { label: "Generated assets/builds", value: "assets" },
        ],
      },
      {
        id: "destination",
        name: "Backup Destination",
        type: "select",
        required: true,
        defaultValue: "local",
        options: [
          { label: "Local backup directory", value: "local" },
          { label: "Cloud storage (S3/Drive)", value: "cloud" },
          { label: "Git repository", value: "git" },
          { label: "External drive", value: "external" },
        ],
      },
      {
        id: "naming",
        name: "Backup Naming",
        type: "select",
        required: true,
        defaultValue: "dated",
        options: [
          { label: "Date-based (2024-01-15)", value: "dated" },
          { label: "Git commit hash", value: "commit" },
          { label: "Version tag", value: "version" },
          { label: "Incremental (backup-1, backup-2)", value: "incremental" },
        ],
      },
      {
        id: "retention",
        name: "Keep Last N Backups",
        type: "number",
        required: false,
        defaultValue: 7,
        description: "Automatically delete older backups",
      },
    ],
    examples: [
      "Daily incremental backup",
      "Pre-deployment snapshot",
      "Archive milestones",
    ],
  },
  {
    id: "custom-task",
    name: "Custom Task",
    description: "Create your own recurring AI task",
    icon: <Bot size={20} />,
    category: "custom",
    defaultPrompt: "",
    parameters: [
      {
        id: "instructions",
        name: "What should the AI do?",
        type: "textarea",
        required: true,
        placeholder: "Describe the task in detail. For example:\n\n1. Read the latest customer feedback from /data/feedback.json\n2. Categorize feedback by sentiment\n3. Summarize top 3 themes\n4. Suggest action items",
        description: "Detailed step-by-step instructions",
      },
      {
        id: "context",
        name: "Additional Context",
        type: "textarea",
        required: false,
        placeholder: "Any files, URLs, or background info the AI should know...",
        description: "Helps the AI understand the task better",
      },
      {
        id: "expectedOutput",
        name: "Expected Output",
        type: "select",
        required: false,
        defaultValue: "summary",
        options: [
          { label: "Summary/report", value: "summary" },
          { label: "Action items/tasks", value: "actions" },
          { label: "File changes", value: "files" },
          { label: "Notification/alert", value: "notification" },
          { label: "Data analysis", value: "analysis" },
        ],
      },
    ],
    examples: [
      "Any custom workflow you need",
      "Unique business process",
      "Creative recurring tasks",
    ],
  },
];

// ============================================================================
// Preset Schedules
// ============================================================================

const PRESET_SCHEDULES = [
  { label: "Every minute", value: "* * * * *", description: "Runs every minute" },
  { label: "Every 5 minutes", value: "*/5 * * * *", description: "Runs every 5 minutes" },
  { label: "Every 15 minutes", value: "*/15 * * * *", description: "Runs every 15 minutes" },
  { label: "Every 30 minutes", value: "*/30 * * * *", description: "Runs every 30 minutes" },
  { label: "Every hour", value: "0 * * * *", description: "Runs at the top of every hour" },
  { label: "Every 6 hours", value: "0 */6 * * *", description: "Runs every 6 hours" },
  { label: "Every day at 9am", value: "0 9 * * *", description: "Runs daily at 9:00 AM" },
  { label: "Every day at midnight", value: "0 0 * * *", description: "Runs daily at midnight" },
  { label: "Every weekday at 9am", value: "0 9 * * 1-5", description: "Runs Monday-Friday at 9:00 AM" },
  { label: "Weekly on Monday", value: "0 9 * * 1", description: "Runs every Monday at 9:00 AM" },
  { label: "Monthly 1st", value: "0 9 1 * *", description: "Runs on the 1st of every month at 9:00 AM" },
  { label: "Custom", value: "custom", description: "Enter your own cron expression" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function validateCronExpression(expression: string): boolean {
  if (expression === "custom") return true;
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  return parts.every((part) => {
    if (part === "*") return true;
    if (/^\d+$/.test(part)) return true;
    if (/^\*\/\d+$/.test(part)) return true;
    if (/^\d+-\d+$/.test(part)) return true;
    if (/^\d+,\d+$/.test(part)) return true;
    if (/^\d+-\d+\/\d+$/.test(part)) return true;
    return false;
  });
}

function generatePromptFromTemplate(template: TaskTemplate, params: Record<string, unknown>): string {
  let prompt = template.defaultPrompt + "\n\n";
  
  switch (template.id) {
    case "code-review":
      prompt += `Review Period: ${params.lookback}\n`;
      if (params.focusAreas && Array.isArray(params.focusAreas) && params.focusAreas.length > 0) {
        prompt += `Focus Areas: ${params.focusAreas.join(", ")}\n`;
      }
      prompt += `Output Format: ${params.outputFormat}\n`;
      prompt += "\nPlease review the code changes in the specified timeframe and provide feedback on the selected focus areas.";
      break;
      
    case "generate-docs":
      prompt += `Documentation Type: ${params.docType}\n`;
      prompt += `Source Paths: ${params.sourcePaths}\n`;
      if (params.docLocation) prompt += `Output Location: ${params.docLocation}\n`;
      prompt += `Style: ${params.style}\n`;
      prompt += "\nPlease analyze the source code and generate/update the specified documentation.";
      break;
      
    case "dependency-check":
      prompt += `Check Types: ${Array.isArray(params.checkType) ? params.checkType.join(", ") : params.checkType}\n`;
      if (params.packageFile) prompt += `Package File: ${params.packageFile}\n`;
      prompt += `Minimum Severity: ${params.severity}\n`;
      prompt += `Suggest Fixes: ${params.autoFix ? "Yes" : "No"}\n`;
      prompt += "\nPlease analyze the project dependencies and report any issues found.";
      break;
      
    case "summarize-activity":
      prompt += `Time Period: ${params.period}\n`;
      prompt += `Sources: ${Array.isArray(params.sources) ? params.sources.join(", ") : params.sources}\n`;
      prompt += `Audience: ${params.audience}\n`;
      prompt += `Output Format: ${params.outputFormat}\n`;
      prompt += "\nPlease gather activity from the specified sources and create a summary tailored for the target audience.";
      break;
      
    case "monitor-alerts":
      prompt += `Monitoring Target: ${params.whatToMonitor}\n`;
      prompt += `Source: ${params.sourcePath}\n`;
      prompt += `Alert Condition: ${params.alertCondition}\n`;
      if (params.threshold) prompt += `Threshold: ${params.threshold}\n`;
      prompt += `Notification: ${params.notifyMethod}\n`;
      prompt += "\nPlease check the specified source and report any issues matching the alert condition.";
      break;
      
    case "organize-files":
      prompt += `Source Directory: ${params.sourceDir}\n`;
      prompt += `Organize By: ${params.organizationType}\n`;
      if (params.fileTypes && Array.isArray(params.fileTypes)) {
        prompt += `File Types: ${params.fileTypes.join(", ")}\n`;
      }
      if (params.actions && Array.isArray(params.actions)) {
        prompt += `Actions: ${params.actions.join(", ")}\n`;
      }
      prompt += `Dry Run: ${params.dryRun ? "Yes (preview only)" : "No (apply changes)"}\n`;
      prompt += "\nPlease analyze and organize the files according to the specified rules.";
      break;
      
    case "content-curation":
      prompt += `Topic: ${params.topic}\n`;
      prompt += `Sources: ${Array.isArray(params.sources) ? params.sources.join(", ") : params.sources}\n`;
      if (params.contentType && Array.isArray(params.contentType)) {
        prompt += `Content Types: ${params.contentType.join(", ")}\n`;
      }
      prompt += `Output Format: ${params.outputFormat}\n`;
      prompt += "\nPlease search the specified sources for relevant content and provide a curated summary.";
      break;
      
    case "pr-prep":
      if (params.branch) prompt += `Branch: ${params.branch}\n`;
      prompt += `Base Branch: ${params.baseBranch}\n`;
      prompt += `Include: ${Array.isArray(params.include) ? params.include.join(", ") : params.include}\n`;
      prompt += `Template Style: ${params.template}\n`;
      prompt += "\nPlease analyze the branch changes and prepare a comprehensive PR description.";
      break;
      
    case "smart-backup":
      prompt += `Backup Items: ${Array.isArray(params.whatToBackup) ? params.whatToBackup.join(", ") : params.whatToBackup}\n`;
      prompt += `Destination: ${params.destination}\n`;
      prompt += `Naming: ${params.naming}\n`;
      prompt += `Keep Last: ${params.retention} backups\n`;
      prompt += "\nPlease create a backup of the specified items and manage retention.";
      break;
      
    case "custom-task":
      prompt = params.instructions as string;
      if (params.context) {
        prompt += "\n\nAdditional Context:\n" + params.context;
      }
      prompt += `\n\nExpected Output Type: ${params.expectedOutput}`;
      break;
  }
  
  return prompt;
}

// ============================================================================
// Main Component
// ============================================================================

export function CronJobWizard({
  isOpen = true,
  onClose,
  onSubmit,
  onComplete,
  onCancel,
  onGeneratePrompt,
  defaultPrompt = "",
  accentColor = "#D4956A",
  initialConfig,
}: CronJobWizardProps) {
  const [step, setStep] = useState<WizardStep>(initialConfig ? "configure" : "template");
  const [config, setConfig] = useState<CronJobConfig>({
    name: initialConfig?.name ?? "",
    description: initialConfig?.description ?? "",
    schedule: initialConfig?.schedule ?? "0 9 * * *",
    taskType: (initialConfig?.taskType as TaskType) ?? "custom-task",
    parameters: initialConfig?.parameters ?? {},
    prompt: initialConfig?.prompt ?? defaultPrompt,
    enabled: initialConfig?.enabled ?? true,
    maxRetries: initialConfig?.maxRetries ?? 3,
    timeout: initialConfig?.timeout ?? 30,
    notifyOnSuccess: initialConfig?.notifyOnSuccess ?? false,
    notifyOnFailure: initialConfig?.notifyOnFailure ?? true,
  });
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customCron, setCustomCron] = useState(false);

  const updateConfig = useCallback((updates: Partial<CronJobConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    updateConfig({ 
      taskType: template.id,
      parameters: template.parameters.reduce((acc, param) => {
        if (param.defaultValue !== undefined) {
          acc[param.id] = param.defaultValue;
        }
        return acc;
      }, {} as Record<string, unknown>),
    });
    setStep("configure");
  };

  const handleGeneratePrompt = async () => {
    if (!selectedTemplate) return;
    
    setIsGeneratingPrompt(true);
    
    try {
      let prompt: string;
      
      if (onGeneratePrompt) {
        prompt = await onGeneratePrompt(config.taskType, config.parameters);
      } else {
        prompt = generatePromptFromTemplate(selectedTemplate, config.parameters);
      }
      
      updateConfig({ prompt });
    } catch (err) {
      // Fall back to template generation
      const fallbackPrompt = generatePromptFromTemplate(selectedTemplate, config.parameters);
      updateConfig({ prompt: fallbackPrompt });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleNext = () => {
    setError(null);
    const steps: WizardStep[] = ["template", "configure", "schedule", "review", "success"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ["template", "configure", "schedule", "review", "success"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit(config);
      if (onComplete) {
        await onComplete(config);
      }
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("template");
    setConfig({
      name: "",
      description: "",
      schedule: "0 9 * * *",
      taskType: "custom-task",
      parameters: {},
      prompt: "",
      enabled: true,
      maxRetries: 3,
      timeout: 30,
      notifyOnSuccess: false,
      notifyOnFailure: true,
    });
    setSelectedTemplate(null);
    setError(null);
    setCustomCron(false);
    onClose();
    if (onCancel) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 20,
          border: `1px solid ${accentColor}30`,
          background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
          boxShadow: `0 28px 100px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}20`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${accentColor}20`,
            background: `linear-gradient(90deg, ${accentColor}10, transparent)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={20} style={{ color: accentColor }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#f6eee7" }}>
              Schedule a Job
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: 6,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#a8998c",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        {step !== "success" && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["template", "configure", "schedule", "review"].map((s, i) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background:
                      i <= ["template", "configure", "schedule", "review"].indexOf(step)
                        ? accentColor
                        : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: 20 }}>
          {step === "template" && (
            <TemplateSelectionStep
              onSelect={handleTemplateSelect}
              accentColor={accentColor}
            />
          )}
          
          {step === "configure" && selectedTemplate && (
            <ConfigureStep
              template={selectedTemplate}
              config={config}
              onUpdate={updateConfig}
              onGeneratePrompt={handleGeneratePrompt}
              isGenerating={isGeneratingPrompt}
              accentColor={accentColor}
            />
          )}
          
          {step === "schedule" && (
            <ScheduleStep
              config={config}
              onUpdate={updateConfig}
              customCron={customCron}
              setCustomCron={setCustomCron}
              accentColor={accentColor}
            />
          )}
          
          {step === "review" && (
            <ReviewStep config={config} template={selectedTemplate} accentColor={accentColor} />
          )}
          
          {step === "success" && (
            <SuccessStep config={config} accentColor={accentColor} onClose={handleClose} />
          )}

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "success" && step !== "template" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <button
              onClick={handleBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#d1c3b4",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>

            {step === "review" ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: `1px solid ${accentColor}`,
                  background: accentColor,
                  color: "#1a1714",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isSubmitting ? "wait" : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Create Job
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: `1px solid ${accentColor}`,
                  background: accentColor,
                  color: "#1a1714",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function TemplateSelectionStep({
  onSelect,
  accentColor,
}: {
  onSelect: (template: TaskTemplate) => void;
  accentColor: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const categories = [
    { id: null, label: "All" },
    { id: "development", label: "Development" },
    { id: "maintenance", label: "Maintenance" },
    { id: "operations", label: "Operations" },
    { id: "communication", label: "Communication" },
    { id: "research", label: "Research" },
    { id: "custom", label: "Custom" },
  ];
  
  const filteredTemplates = selectedCategory
    ? TASK_TEMPLATES.filter((t) => t.category === selectedCategory)
    : TASK_TEMPLATES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, color: "#b3a395", lineHeight: 1.5 }}>
        Select a task type for your scheduled job. Each template provides a starting point that you can customize.
      </div>

      {/* Categories */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {categories.map((cat) => (
          <button
            key={cat.id || "all"}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: selectedCategory === cat.id ? accentColor : "rgba(255,255,255,0.05)",
              color: selectedCategory === cat.id ? "#1a1714" : "#a8998c",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              padding: 14,
              borderRadius: 12,
              border: `1px solid rgba(255,255,255,0.08)`,
              background: "rgba(0,0,0,0.2)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor;
              e.currentTarget.style.background = `${accentColor}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.background = "rgba(0,0,0,0.2)";
            }}
          >
            <div style={{ color: accentColor }}>{template.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f6eee7" }}>
                {template.name}
              </div>
              <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 2 }}>
                {template.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfigureStep({
  template,
  config,
  onUpdate,
  onGeneratePrompt,
  isGenerating,
  accentColor,
}: {
  template: TaskTemplate;
  config: CronJobConfig;
  onUpdate: (u: Partial<CronJobConfig>) => void;
  onGeneratePrompt: () => void;
  isGenerating: boolean;
  accentColor: string;
}) {
  const [activeTab, setActiveTab] = useState<"params" | "prompt">("params");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Template Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 10,
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}30`,
        }}
      >
        <div style={{ color: accentColor }}>{template.icon}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f6eee7" }}>
            {template.name}
          </div>
          <div style={{ fontSize: 12, color: "#a8998c" }}>{template.description}</div>
        </div>
      </div>

      {/* Job Name */}
      <div>
        <label style={{
          display: "block",
          fontSize: 11,
          fontWeight: 800,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}>
          Job Name *
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={`e.g., ${template.examples[0]}`}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.3)",
            color: "#f6eee7",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${accentColor}30`, paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab("params")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "params" ? accentColor : "transparent",
            color: activeTab === "params" ? "#1a1714" : "#a8998c",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab("prompt")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "prompt" ? accentColor : "transparent",
            color: activeTab === "prompt" ? "#1a1714" : "#a8998c",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          AI Prompt
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "params" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {template.parameters.map((param) => (
            <ParameterField
              key={param.id}
              param={param}
              value={config.parameters[param.id]}
              onChange={(v) => onUpdate({
                parameters: { ...config.parameters, [param.id]: v }
              })}
              accentColor={accentColor}
            />
          ))}
          
          {/* Generate Prompt Button */}
          <button
            onClick={onGeneratePrompt}
            disabled={isGenerating}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px",
              borderRadius: 10,
              border: `1px dashed ${accentColor}`,
              background: "transparent",
              color: accentColor,
              fontSize: 12,
              fontWeight: 600,
              cursor: isGenerating ? "wait" : "pointer",
              marginTop: 8,
            }}
          >
            {isGenerating ? (
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Sparkles size={14} />
            )}
            {isGenerating ? "Generating..." : "Generate AI Prompt from Parameters"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#a8998c" }}>
            This is the prompt that will be sent to the AI agent when the job runs.
            You can edit it directly or regenerate it from the parameters tab.
          </div>
          <textarea
            value={config.prompt}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            rows={10}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.3)",
              color: "#f6eee7",
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
        </div>
      )}
    </div>
  );
}

function ParameterField({
  param,
  value,
  onChange,
  accentColor,
}: {
  param: TaskParameter;
  value: unknown;
  onChange: (v: unknown) => void;
  accentColor: string;
}) {
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.3)",
    color: "#f6eee7",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div>
      <label style={{
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        color: param.required ? accentColor : "#9f8a78",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 4,
      }}>
        {param.name}
        {param.required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      
      {param.type === "select" && param.options ? (
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          {param.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : param.type === "multi-select" && param.options ? (
        <MultiSelectField
          options={param.options}
          value={(value as string[]) || []}
          onChange={onChange}
          accentColor={accentColor}
        />
      ) : param.type === "boolean" ? (
        <button
          onClick={() => onChange(!value)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${value ? accentColor : "rgba(255,255,255,0.1)"}`,
            background: value ? `${accentColor}20` : "rgba(0,0,0,0.3)",
            color: value ? accentColor : "#a8998c",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <div style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: value ? accentColor : "transparent",
            border: `2px solid ${value ? accentColor : "#666"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {value ? <Check size={12} style={{ color: "#1a1714" }} /> : null}
          </div>
          {value ? "Enabled" : "Disabled"}
        </button>
      ) : param.type === "textarea" ? (
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      ) : param.type === "json" ? (
        <textarea
          value={typeof value === "object" ? JSON.stringify(value, null, 2) : (value as string) || ""}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={param.placeholder}
          rows={4}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
        />
      ) : param.type === "number" ? (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          style={inputStyle}
        />
      )}
      
      {param.description && (
        <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 4 }}>
          {param.description}
        </div>
      )}
    </div>
  );
}

function MultiSelectField({
  options,
  value,
  onChange,
  accentColor,
}: {
  options: { label: string; value: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  accentColor: string;
}) {
  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((opt) => {
        const isSelected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggleOption(opt.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${isSelected ? accentColor : "rgba(255,255,255,0.1)"}`,
              background: isSelected ? `${accentColor}15` : "rgba(0,0,0,0.2)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: `2px solid ${isSelected ? accentColor : "#666"}`,
                background: isSelected ? accentColor : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSelected ? <Check size={12} style={{ color: "#1a1714" }} /> : null}
            </div>
            <span style={{ fontSize: 13, color: isSelected ? "#f6eee7" : "#d1c3b4" }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ScheduleStep({
  config,
  onUpdate,
  customCron,
  setCustomCron,
  accentColor,
}: {
  config: CronJobConfig;
  onUpdate: (u: Partial<CronJobConfig>) => void;
  customCron: boolean;
  setCustomCron: (v: boolean) => void;
  accentColor: string;
}) {
  const isValid = validateCronExpression(config.schedule);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, color: "#b3a395", lineHeight: 1.5 }}>
        Choose when this job should run. You can use presets or create a custom schedule.
      </div>

      {!customCron ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PRESET_SCHEDULES.map((preset) => (
            <button
              key={preset.value}
              onClick={() => {
                if (preset.value === "custom") {
                  setCustomCron(true);
                } else {
                  onUpdate({ schedule: preset.value });
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${config.schedule === preset.value && preset.value !== "custom" ? accentColor : "rgba(255,255,255,0.08)"}`,
                background: config.schedule === preset.value && preset.value !== "custom" ? `${accentColor}15` : "rgba(0,0,0,0.2)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Clock size={18} style={{ color: preset.value === "custom" ? "#a8998c" : accentColor }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f6eee7" }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, color: "#7a6b5d" }}>{preset.description}</div>
              </div>
              {config.schedule === preset.value && preset.value !== "custom" && (
                <Check size={16} style={{ color: accentColor }} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}>
              Cron Expression
            </label>
            <input
              type="text"
              value={config.schedule}
              onChange={(e) => onUpdate({ schedule: e.target.value })}
              placeholder="* * * * *"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${isValid ? accentColor : "#ef4444"}`,
                background: "rgba(0,0,0,0.3)",
                color: "#f6eee7",
                fontSize: 14,
                fontFamily: "monospace",
                outline: "none",
              }}
            />
            {!isValid && config.schedule && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>
                Invalid cron expression
              </div>
            )}
          </div>

          <div style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.2)",
            fontSize: 12,
            color: "#7a6b5d",
          }}>
            <strong style={{ color: "#9f8a78" }}>Format:</strong> minute hour day month weekday
            <br/>0 9 * * 1-5 = Weekdays at 9am
          </div>

          <button
            onClick={() => setCustomCron(false)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#9f8a78",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ← Back to presets
          </button>
        </div>
      )}

      {/* Additional Options */}
      <div style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#f6eee7", marginBottom: 12 }}>
          Additional Options
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "#9f8a78" }}>Max Retries</label>
            <input
              type="number"
              min={0}
              max={5}
              value={config.maxRetries}
              onChange={(e) => onUpdate({ maxRetries: parseInt(e.target.value) || 0 })}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.3)",
                color: "#f6eee7",
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9f8a78" }}>Timeout (min)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={config.timeout}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) || 30 })}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.3)",
                color: "#f6eee7",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.notifyOnSuccess}
              onChange={(e) => onUpdate({ notifyOnSuccess: e.target.checked })}
              style={{ accentColor }}
            />
            <span style={{ fontSize: 12, color: "#a8998c" }}>Notify on success</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.notifyOnFailure}
              onChange={(e) => onUpdate({ notifyOnFailure: e.target.checked })}
              style={{ accentColor }}
            />
            <span style={{ fontSize: 12, color: "#a8998c" }}>Notify on failure</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  config,
  template,
  accentColor,
}: {
  config: CronJobConfig;
  template: TaskTemplate | null;
  accentColor: string;
}) {
  const preset = PRESET_SCHEDULES.find((p) => p.value === config.schedule);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, color: "#b3a395" }}>
        Review your scheduled job before creating it.
      </div>

      <div style={{
        borderRadius: 12,
        border: `1px solid ${accentColor}30`,
        background: `${accentColor}08`,
        padding: 16,
      }}>
        <ReviewItem label="Name" value={config.name} accentColor={accentColor} />
        <ReviewItem 
          label="Task Type" 
          value={template?.name || config.taskType} 
          accentColor={accentColor} 
        />
        <ReviewItem 
          label="Schedule" 
          value={preset?.label || config.schedule}
          subValue={preset?.description}
          accentColor={accentColor} 
        />
        <ReviewItem 
          label="Settings" 
          value={`${config.maxRetries} retries, ${config.timeout}min timeout`}
          accentColor={accentColor} 
        />
        
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}>
            AI Prompt Preview
          </div>
          <div style={{
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.3)",
            fontSize: 12,
            color: "#a8998c",
            maxHeight: 100,
            overflow: "auto",
            fontFamily: "monospace",
          }}>
            {config.prompt.slice(0, 200)}{config.prompt.length > 200 ? "..." : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  subValue,
  accentColor,
}: {
  label: string;
  value: string;
  subValue?: string;
  accentColor: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 800,
        color: accentColor,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#f6eee7" }}>{value}</div>
      {subValue && <div style={{ fontSize: 11, color: "#7a6b5d" }}>{subValue}</div>}
    </div>
  );
}

function SuccessStep({
  config,
  accentColor,
  onClose,
}: {
  config: CronJobConfig;
  accentColor: string;
  onClose: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: `${accentColor}20`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
      }}>
        <Check size={32} style={{ color: accentColor }} />
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, color: "#f6eee7", marginBottom: 8 }}>
        Job Created Successfully!
      </div>

      <div style={{ fontSize: 14, color: "#b3a395", marginBottom: 24 }}>
        "{config.name}" is now scheduled and will run {config.schedule === "0 9 * * *" ? "daily at 9am" : "according to schedule"}.
      </div>

      <button
        onClick={onClose}
        style={{
          padding: "10px 24px",
          borderRadius: 10,
          border: `1px solid ${accentColor}`,
          background: accentColor,
          color: "#1a1714",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  );
}

export default CronJobWizard;
