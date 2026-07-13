import React, { useCallback, useMemo, useState } from "react";
import { Calendar, CaretLeft, CaretRight, Check, CircleNotch, Clock, Code, FileText, FloppyDisk, GearSix, Globe, Pencil, Robot, Sparkle, Terminal, Warning, X, Record } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
// ============================================================================
// Types
// ============================================================================

type TaskType =
  | "code-review"
  | "generate-docs"
  | "dependency-check"
  | "summarize-activity"
  | "monitor-alerts"
  | "organize-files"
  | "content-curation"
  | "pr-prep"
  | "smart-backup"
  | "agent-task"
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

interface TaskParameter {
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
    icon: <GearSix size={20} />,
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
    icon: <FloppyDisk size={20} />,
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
    icon: <Robot size={20} />,
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
        placeholder: "Any files, URLs, or background info the AI should know…",
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
    <div role="button" tabIndex={0}
      className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] backdrop-blur-md z-[180] flex items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="w-full max-w-[640px] max-h-[90vh] overflow-auto rounded-[20px] border border-solid border-[var(--accent-glow)] bg-[linear-gradient(180deg,#2B2520_0%,#1a1714_100%)] shadow-[0_28px_100px_var(--shell-overlay-backdrop),0_0_0_1px_var(--accent-glow-subtle)]"
        style={{
          '--accent-glow': `${accentColor}30`,
          '--accent-glow-subtle': `${accentColor}20`,
        } as React.CSSProperties}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-[16px_20px] border-b border-solid border-[var(--accent-glow-subtle)] bg-[linear-gradient(90deg,var(--accent-glow-tiny),transparent)]"
          style={{ '--accent-glow-tiny': `${accentColor}10` } as React.CSSProperties}
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={20} style={{ color: accentColor }} />
            <span className="text-[16px] font-bold text-[#f6eee7]">
              Schedule a Job
            </span>
          </div>
          <button type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg border-none bg-transparent text-[#a8998c] cursor-pointer hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        {step !== "success" && (
          <div className="p-[12px_20px] border-b border-solid border-[var(--ui-border-muted)]">
            <div className="flex gap-2">
              {["template", "configure", "schedule", "review"].map((s, i) => (
                <div
                  key={s}
                  className="flex-1 h-1 rounded-full transition-colors duration-300"
                  style={{
                    background:
                      i <= ["template", "configure", "schedule", "review"].indexOf(step)
                        ? accentColor
                        : "var(--ui-border-default)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
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
              className="mt-4 p-3 rounded-[10px] bg-[var(--status-error-bg)] border border-solid border-[var(--status-error)]/20 flex items-center gap-2 text-[#ef4444] text-[13px]"
            >
              <Warning size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "success" && step !== "template" && (
          <div
            className="flex justify-between p-[16px_20px] border-t border-solid border-[var(--ui-border-muted)]"
          >
            <button type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 p-[8px_14px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[#d1c3b4] text-[13px] font-semibold cursor-pointer transition-colors hover:bg-white/5"
            >
              <CaretLeft size={16} />
              Back
            </button>

            {step === "review" ? (
              <button type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "flex items-center gap-1.5 p-[8px_16px] rounded-lg border border-solid text-[#1a1714] text-[13px] font-bold transition-all",
                  isSubmitting ? "cursor-wait opacity-70" : "cursor-pointer hover:opacity-90"
                )}
                style={{ borderColor: accentColor, background: accentColor }}
              >
                {isSubmitting ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FloppyDisk size={16} />
                    Create Job
                  </>
                )}
              </button>
            ) : (
              <button type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 p-[8px_16px] rounded-lg border border-solid text-[#1a1714] text-[13px] font-bold cursor-pointer hover:opacity-90 transition-all"
                style={{ borderColor: accentColor, background: accentColor }}
              >
                Next
                <CaretRight size={16} />
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
    <div className="flex flex-col gap-4">
      <div className="text-[14px] text-[#b3a395] leading-relaxed">
        Select a task type for your scheduled job. Each template provides a starting point that you can customize.
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button type="button"
            key={cat.id || "all"}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full border-none text-[12px] font-semibold cursor-pointer transition-all",
              selectedCategory === cat.id ? "text-[#1a1714]" : "bg-[var(--surface-hover)] text-[#a8998c] hover:bg-[var(--surface-active)]"
            )}
            style={selectedCategory === cat.id ? { background: accentColor } : {}}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {filteredTemplates.map((template) => (
          <button type="button"
            key={template.id}
            onClick={() => onSelect(template)}
            className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] cursor-pointer text-left transition-all hover:bg-white/5"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor;
              e.currentTarget.style.background = `${accentColor}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ui-border-muted)";
              e.currentTarget.style.background = "var(--surface-hover)";
            }}
          >
            <div style={{ color: accentColor }}>{template.icon}</div>
            <div>
              <div className="text-[13px] font-semibold text-[#f6eee7]">
                {template.name}
              </div>
              <div className="text-[12px] text-[#7a6b5d] mt-0.5 leading-tight">
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
    <div className="flex flex-col gap-4">
      {/* Template Header */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg border border-solid border-[var(--accent-glow)] bg-[var(--accent-glow-subtle)]"
        style={{
          '--accent-glow': `${accentColor}30`,
          '--accent-glow-subtle': `${accentColor}10`,
        } as React.CSSProperties}
      >
        <div style={{ color: accentColor }}>{template.icon}</div>
        <div>
          <div className="text-[14px] font-semibold text-[#f6eee7]">
            {template.name}
          </div>
          <div className="text-[12px] text-[#a8998c]">{template.description}</div>
        </div>
      </div>

      {/* Job Name */}
      <div>
        <div className="block text-[12px] font-extrabold uppercase tracking-[0.08em] mb-1.5" style={{ color: accentColor }}>
          Job Name *
        </div>
        <input aria-label="Input" type="text"
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={`e.g., ${template.examples[0]}`}
          className="w-full p-[10px_12px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[#f6eee7] text-[14px] outline-none transition-colors focus:border-[var(--ui-border-active)]"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-solid border-[var(--accent-glow)] pb-2"
        style={{ '--accent-glow': `${accentColor}30` } as React.CSSProperties}
      >
        <button type="button"
          onClick={() => setActiveTab("params")}
          className={cn(
            "px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-all",
            activeTab === "params" ? "text-[#1a1714]" : "bg-transparent text-[#a8998c] hover:bg-white/5"
          )}
          style={activeTab === "params" ? { background: accentColor } : {}}
        >
          Parameters
        </button>
        <button type="button"
          onClick={() => setActiveTab("prompt")}
          className={cn(
            "px-3 py-1.5 rounded-lg border-none text-[12px] font-semibold cursor-pointer transition-all",
            activeTab === "prompt" ? "text-[#1a1714]" : "bg-transparent text-[#a8998c] hover:bg-white/5"
          )}
          style={activeTab === "prompt" ? { background: accentColor } : {}}
        >
          AI Prompt
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "params" ? (
        <div className="flex flex-col gap-3">
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
          <button type="button"
            onClick={onGeneratePrompt}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[var(--accent-glow)] bg-transparent text-[12px] font-semibold cursor-pointer mt-2 transition-all hover:bg-white/5"
            style={{ '--accent-glow': accentColor, color: accentColor } as React.CSSProperties}
          >
            {isGenerating ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <Sparkle size={14} />
            )}
            {isGenerating ? "Generating…" : "Generate AI Prompt from Parameters"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[12px] text-[#a8998c] leading-relaxed">
            This is the prompt that will be sent to the AI agent when the job runs.
            You can edit it directly or regenerate it from the parameters tab.
          </div>
          <textarea aria-label="Text Area" value={config.prompt}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            rows={10}
            className="w-full p-[10px_12px] rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[#f6eee7] text-[13px] outline-none resize-none font-inherit leading-relaxed"
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
  const inputClassName = "w-full p-2 px-2.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[#f6eee7] text-[13px] outline-none transition-colors focus:border-[var(--ui-border-active)]";

  return (
    <div>
      <div className={cn(
        "block text-[12px] font-bold uppercase tracking-[0.08em] mb-1",
        param.required ? "text-[var(--accent-color)]" : "text-[#9f8a78]"
      )} style={{ '--accent-color': accentColor } as React.CSSProperties}>
        {param.name}
        {param.required && <span className="text-[#ef4444]"> *</span>}
      </div>
      
      {param.type === "select" && param.options ? (
        <select aria-label="Selection" value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
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
        <button type="button"
          onClick={() => onChange(!value)}
          className={cn(
            "flex items-center gap-2 p-2 px-3 rounded-lg border border-solid text-[13px] cursor-pointer transition-all",
            value ? "bg-[var(--accent-glow)] border-[var(--accent-color)] text-[var(--accent-color)]" : "bg-[var(--surface-panel)] border-[var(--ui-border-default)] text-[#a8998c]"
          )}
          style={{
            '--accent-glow': `${accentColor}20`,
            '--accent-color': accentColor,
          } as React.CSSProperties}
        >
          <div className={cn(
            "size-[18px] rounded flex items-center justify-center border-2 border-solid transition-colors",
            value ? "bg-[var(--accent-color)] border-[var(--accent-color)]" : "bg-transparent border-[#666]"
          )} style={{ '--accent-color': accentColor } as React.CSSProperties}>
            {value ? <Check size={12} className="text-[#1a1714]" /> : null}
          </div>
          {value ? "Enabled" : "Disabled"}
        </button>
      ) : param.type === "textarea" ? (
        <textarea aria-label="Text Area" value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          rows={3}
          className={cn(inputClassName, "resize-none font-inherit")}
        />
      ) : param.type === "json" ? (
        <textarea aria-label="Text Area" value={typeof value === "object" ? JSON.stringify(value, null, 2) : (value as string) || ""}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={param.placeholder}
          rows={4}
          className={cn(inputClassName, "font-mono text-[12px] resize-none")}
        />
      ) : param.type === "number" ? (
        <input aria-label="Input" type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={inputClassName}
        />
      ) : (
        <input aria-label="Input" type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className={inputClassName}
        />
      )}
      
      {param.description && (
        <div className="text-[12px] text-[#7a6b5d] mt-1">
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
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => {
        const isSelected = value.includes(opt.value);
        return (
          <button type="button"
            key={opt.value}
            onClick={() => toggleOption(opt.value)}
            className={cn(
              "flex items-center gap-2.5 p-2 rounded-lg border border-solid cursor-pointer text-left transition-all",
              isSelected ? "bg-[var(--accent-glow)] border-[var(--accent-color)]" : "bg-[var(--surface-hover)] border-[var(--ui-border-default)]"
            )}
            style={{
              '--accent-glow': `${accentColor}15`,
              '--accent-color': accentColor,
            } as React.CSSProperties}
          >
            <div
              className={cn(
                "size-4 rounded border-2 border-solid flex items-center justify-center transition-colors",
                isSelected ? "bg-[var(--accent-color)] border-[var(--accent-color)]" : "bg-transparent border-[#666]"
              )}
              style={{ '--accent-color': accentColor } as React.CSSProperties}
            >
              {isSelected ? <Check size={12} className="text-[#1a1714]" /> : null}
            </div>
            <span className={cn("text-[13px] font-medium", isSelected ? "text-[#f6eee7]" : "text-[#d1c3b4]")}>
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
    <div className="flex flex-col gap-4">
      <div className="text-[14px] text-[#b3a395] leading-relaxed">
        Choose when this job should run. You can use presets or create a custom schedule.
      </div>

      {!customCron ? (
        <div className="flex flex-col gap-2">
          {PRESET_SCHEDULES.map((preset) => (
            <button type="button"
              key={preset.value}
              onClick={() => {
                if (preset.value === "custom") {
                  setCustomCron(true);
                } else {
                  onUpdate({ schedule: preset.value });
                }
              }}
              className={cn(
                "flex items-center gap-3 p-3 px-3.5 rounded-xl border border-solid cursor-pointer text-left transition-all hover:bg-white/5",
                config.schedule === preset.value && preset.value !== "custom" ? "bg-[var(--accent-glow)] border-[var(--accent-color)]" : "border-[var(--ui-border-muted)]"
              )}
              style={{
                '--accent-glow': `${accentColor}15`,
                '--accent-color': accentColor,
              } as React.CSSProperties}
            >
              <Clock size={18} style={{ color: preset.value === "custom" ? "#a8998c" : accentColor }} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#f6eee7]">
                  {preset.label}
                </div>
                <div className="text-[12px] text-[#7a6b5d]">{preset.description}</div>
              </div>
              {config.schedule === preset.value && preset.value !== "custom" && (
                <Check size={16} style={{ color: accentColor }} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <div className="block text-[12px] font-extrabold uppercase tracking-[0.08em] mb-1.5" style={{ color: accentColor }}>
              Cron Expression
            </div>
            <input aria-label="Input" type="text"
              value={config.schedule}
              onChange={(e) => onUpdate({ schedule: e.target.value })}
              placeholder="* * * * *"
              className={cn(
                "w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[#f6eee7] text-[14px] font-mono outline-none transition-colors",
                isValid ? "focus:border-[var(--ui-border-active)]" : "border-[#ef4444]"
              )}
              style={isValid ? {} : { borderColor: '#ef4444' }}
            />
            {!isValid && config.schedule && (
              <div className="text-[12px] text-[#ef4444] mt-1.5">
                Invalid cron expression
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[var(--surface-hover)] text-[12px] text-[#7a6b5d] leading-relaxed">
            <strong className="text-[#9f8a78]">Format:</strong> minute hour day month weekday
            <br/>0 9 * * 1-5 = Weekdays at 9am
          </div>

          <button type="button"
            onClick={() => setCustomCron(false)}
            className="self-start p-2 px-3.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[#9f8a78] text-[12px] cursor-pointer hover:bg-white/5 transition-colors"
          >
            ← Back to presets
          </button>
        </div>
      )}

      {/* Additional Options */}
      <div className="mt-4 p-4 rounded-xl bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)]">
        <div className="text-[12px] font-semibold text-[#f6eee7] mb-3">
          Additional Options
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-[#9f8a78] block mb-1">Max Retries</div>
            <input aria-label="Input" type="number"
              min={0}
              max={5}
              value={config.maxRetries}
              onChange={(e) => onUpdate({ maxRetries: parseInt(e.target.value, 10) || 0 })}
              className="w-full p-[6px_10px] rounded-md border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[#f6eee7] text-[13px] outline-none"
            />
          </div>
          <div>
            <div className="text-[12px] text-[#9f8a78] block mb-1">Timeout (min)</div>
            <input aria-label="Input" type="number"
              min={1}
              max={120}
              value={config.timeout}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value, 10) || 30 })}
              className="w-full p-[6px_10px] rounded-md border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[#f6eee7] text-[13px] outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input aria-label="Checkbox" type="checkbox"
              checked={config.notifyOnSuccess}
              onChange={(e) => onUpdate({ notifyOnSuccess: e.target.checked })}
              className="cursor-pointer"
              style={{ accentColor }}
            />
            <span className="text-[12px] text-[#a8998c] group-hover:text-[#d1c3b4] transition-colors">Notify on success</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input aria-label="Checkbox" type="checkbox"
              checked={config.notifyOnFailure}
              onChange={(e) => onUpdate({ notifyOnFailure: e.target.checked })}
              className="cursor-pointer"
              style={{ accentColor }}
            />
            <span className="text-[12px] text-[#a8998c] group-hover:text-[#d1c3b4] transition-colors">Notify on failure</span>
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
    <div className="flex flex-col gap-4">
      <div className="text-[14px] text-[#b3a395]">
        Review your scheduled job before creating it.
      </div>

      <div
        className="rounded-xl border border-solid border-[var(--accent-glow)] bg-[var(--accent-glow-tiny)] p-4"
        style={{
          '--accent-glow': `${accentColor}30`,
          '--accent-glow-tiny': `${accentColor}08`,
        } as React.CSSProperties}
      >
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
        
        <div className="mt-3">
          <div className="text-[12px] font-extrabold text-[var(--accent-color)] uppercase tracking-[0.08em] mb-1.5" style={{ '--accent-color': accentColor } as React.CSSProperties}>
            AI Prompt Preview
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface-panel)] text-[12px] text-[#a8998c] max-h-[100px] overflow-auto font-mono leading-relaxed">
            {config.prompt.slice(0, 200)}{config.prompt.length > 200 ? "…" : ""}
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
    <div className="mb-2.5">
      <div className="text-[12px] font-extrabold text-[var(--accent-color)] uppercase tracking-[0.08em] mb-0.5" style={{ '--accent-color': accentColor } as React.CSSProperties}>
        {label}
      </div>
      <div className="text-[13px] text-[#f6eee7] font-medium">{value}</div>
      {subValue && <div className="text-[12px] text-[#7a6b5d]">{subValue}</div>}
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
    <div className="text-center py-5">
      <div className="size-[60px] rounded-full bg-[var(--status-success-bg)] flex items-center justify-center mx-auto mb-4 border border-solid border-[var(--status-success)]/20">
        <Check size={32} className="text-[var(--status-success)]" weight="bold" />
      </div>
      
      <h2 className="text-[20px] font-bold text-[#f6eee7] mb-2">Job Scheduled!</h2>
      <p className="text-[14px] text-[#b3a395] max-w-[320px] mx-auto mb-6 leading-relaxed">
        "<span className="text-[#f6eee7] font-semibold">{config.name}</span>" has been successfully created and scheduled to run.
      </p>

      <div className="flex flex-col gap-2 max-w-[240px] mx-auto">
        <button type="button"
          onClick={onClose}
          className="p-2.5 rounded-lg border border-solid text-[#1a1714] text-[13px] font-bold cursor-pointer transition-all hover:opacity-90"
          style={{ borderColor: accentColor, background: accentColor }}
        >
          View Scheduled Jobs
        </button>
      </div>
    </div>
  );
}
