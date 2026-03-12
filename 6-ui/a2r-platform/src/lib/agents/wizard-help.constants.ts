/**
 * Agent Creation Wizard - Help System Constants
 * 
 * Comprehensive help content, tooltips, smart suggestions, and onboarding guidance
 * for the Agent Creation Wizard.
 * 
 * @module wizard-help.constants
 * @version 1.0.0
 */

import type { AgentSetup, AgentType, ModelProvider, HardBanCategory, Temperament } from '@/components/agents/AgentCreationWizardEnhanced';

// ============================================================================
// Step Help Content
// ============================================================================

export interface StepHelpContent {
  title: string;
  introduction: string;
  whatYouLlDo: string[];
  bestPractices: string[];
  commonQuestions: Array<{ question: string; answer: string }>;
  tips: string[];
  documentationLinks?: Array<{ label: string; url: string }>;
}

export const STEP_HELP_CONTENT: Record<string, StepHelpContent> = {
  identity: {
    title: 'Agent Identity',
    introduction: 'Define the core identity of your agent. This step establishes the foundation for how your agent will behave, what it will be called, and which AI model will power it.',
    whatYouLlDo: [
      'Choose a descriptive name that reflects the agent\'s purpose',
      'Write a clear description explaining what the agent does',
      'Select an agent type that matches its role in your workflow',
      'Pick an AI model that balances capability and cost for your use case',
    ],
    bestPractices: [
      'Use specific names like "Code Review Specialist" instead of generic ones like "Helper"',
      'Include the agent\'s primary function and target audience in the description',
      'Choose "Orchestrator" for agents that coordinate others, "Worker" for task execution',
      'Start with GPT-4 or Claude 3 for complex reasoning tasks',
    ],
    commonQuestions: [
      {
        question: 'What\'s the difference between agent types?',
        answer: 'Orchestrators coordinate multiple agents, Specialists have deep expertise in one area, Workers handle general tasks, Reviewers validate work, and Sub-Agents work under an orchestrator\'s direction.',
      },
      {
        question: 'Which model should I choose?',
        answer: 'For coding and complex reasoning: GPT-4 or Claude 3 Opus. For creative tasks: GPT-4 or Claude 3 Sonnet. For simple Q&A: Consider smaller, faster models to reduce costs.',
      },
      {
        question: 'Can I change these settings later?',
        answer: 'Yes, all identity settings can be modified after creation. However, changing the model may affect the agent\'s behavior and capabilities.',
      },
    ],
    tips: [
      'Keep the name under 40 characters for best display',
      'The description should be 1-2 sentences that anyone can understand',
      'Consider your budget when selecting models - more capable models cost more per token',
    ],
    documentationLinks: [
      { label: 'Agent Types Guide', url: 'https://docs.a2r-platform.com/agents/types' },
      { label: 'Model Selection Guide', url: 'https://docs.a2r-platform.com/agents/models' },
      { label: 'Getting Started', url: 'https://docs.a2r-platform.com/agents/getting-started' },
    ],
  },
  character: {
    title: 'Character Blueprint',
    introduction: 'Define your agent\'s personality, specialization, and behavioral traits. The character layer shapes how your agent thinks, communicates, and approaches problems.',
    whatYouLlDo: [
      'Select a specialization that matches your agent\'s primary domain',
      'Define specialty skills that set this agent apart',
      'Choose a temperament that influences decision-making style',
      'Add personality traits for consistent behavior',
    ],
    bestPractices: [
      'Match specialization to the agent\'s primary use case (Coding for dev agents, Research for analysis)',
      'Limit specialty skills to 3-5 core competencies for focus',
      'Use "Precision" temperament for tasks requiring accuracy, "Exploratory" for creative work',
      'Personality traits should be observable behaviors, not abstract concepts',
    ],
    commonQuestions: [
      {
        question: 'How does specialization affect the agent?',
        answer: 'Specialization determines the agent\'s default skill set, suggested models, and influences the auto-generated system prompt. It\'s the primary signal for what the agent is good at.',
      },
      {
        question: 'What is temperament?',
        answer: 'Temperament defines the agent\'s cognitive style: Precision (careful, methodical), Exploratory (creative, experimental), Systemic (structured, analytical), or Balanced (adaptive).',
      },
      {
        question: 'Should I add a backstory?',
        answer: 'Backstory is optional but can help create more consistent behavior for role-play scenarios or agents that need specific contextual framing.',
      },
    ],
    tips: [
      'The class name is auto-generated from your specialization choice',
      'Skills are used to generate the system prompt and capability metrics',
      'Temperament affects how the agent approaches ambiguous situations',
    ],
    documentationLinks: [
      { label: 'Character Configuration', url: 'https://docs.a2r-platform.com/agents/character' },
      { label: 'Temperament Guide', url: 'https://docs.a2r-platform.com/agents/temperament' },
      { label: 'Personality Traits', url: 'https://docs.a2r-platform.com/agents/personality' },
    ],
  },
  avatar: {
    title: 'Avatar Selection',
    introduction: 'Choose a visual identity for your agent. Avatars provide a recognizable face for your agent and can be used in chat interfaces, dashboards, and notifications.',
    whatYouLlDo: [
      'Browse professional avatar categories',
      'Select an avatar that matches your agent\'s personality',
      'Customize colors to match your brand or preferences',
    ],
    bestPractices: [
      'Professional avatars work best for business and productivity agents',
      'Creative avatars suit content creation and design agents',
      'Technical avatars are ideal for developer tools and infrastructure agents',
      'Use consistent color schemes across agents in the same workspace',
    ],
    commonQuestions: [
      {
        question: 'Can I upload my own avatar?',
        answer: 'Currently, you can select from our curated library of professional avatars. Custom uploads will be available in a future update.',
      },
      {
        question: 'Where will the avatar be displayed?',
        answer: 'Avatars appear in chat interfaces, agent lists, notifications, and any UI where the agent is represented visually.',
      },
      {
        question: 'Can I change the avatar later?',
        answer: 'Yes, avatars can be changed at any time from the agent settings.',
      },
    ],
    tips: [
      'Avatar colors can be customized after selection',
      'Minimalist avatars work well in dense UIs',
      'Consider accessibility - ensure good contrast with backgrounds',
    ],
    documentationLinks: [
      { label: 'Avatar Customization', url: 'https://docs.a2r-platform.com/agents/avatar' },
      { label: 'Mascot Builder Guide', url: 'https://docs.a2r-platform.com/agents/mascot-builder' },
    ],
  },
  role: {
    title: 'Role Card',
    introduction: 'Define the agent\'s professional role, responsibilities, and boundaries. The role card establishes what the agent does, what it produces, and what it absolutely cannot do.',
    whatYouLlDo: [
      'Define the primary domain of expertise',
      'Specify expected inputs and outputs',
      'Set clear definition of done criteria',
      'Establish hard bans (absolute restrictions)',
      'Configure escalation triggers',
      'Define success metrics',
    ],
    bestPractices: [
      'Domain should be specific: "React component development" not just "coding"',
      'Inputs/Outputs should be concrete artifacts, not abstract concepts',
      'Hard bans are critical safety boundaries - be thorough here',
      'Escalation triggers should cover edge cases the agent can\'t handle',
      'Success metrics should be measurable outcomes',
    ],
    commonQuestions: [
      {
        question: 'What are hard bans?',
        answer: 'Hard bans are absolute restrictions that the agent cannot violate. Examples include: no production deployments, no file deletions, no external communications. These are enforced at the system level.',
      },
      {
        question: 'When should I add escalation triggers?',
        answer: 'Add escalation triggers for situations requiring human judgment: ambiguous requests, high-risk operations, conflicts between instructions, or tasks outside the agent\'s expertise.',
      },
      {
        question: 'How specific should the domain be?',
        answer: 'Specific enough to guide behavior but broad enough to be useful. "Python backend API development" is better than just "programming" or overly narrow like "FastAPI user endpoints".',
      },
    ],
    tips: [
      'Hard bans with "fatal" severity are strictly enforced',
      'Escalation triggers prevent the agent from making dangerous decisions',
      'Success metrics help evaluate agent performance over time',
    ],
    documentationLinks: [
      { label: 'Role Configuration', url: 'https://docs.a2r-platform.com/agents/role-card' },
      { label: 'Safety & Governance', url: 'https://docs.a2r-platform.com/agents/safety' },
      { label: 'Hard Bans Reference', url: 'https://docs.a2r-platform.com/agents/hard-bans' },
    ],
  },
  voice: {
    title: 'Voice Configuration',
    introduction: 'Configure how your agent communicates. Voice settings control tone, style, formality, and behavioral rules that shape every interaction.',
    whatYouLlDo: [
      'Select a voice style that matches the agent\'s purpose',
      'Define behavioral rules for consistent communication',
      'Set tone parameters (formality, enthusiasm, empathy, directness)',
      'Configure conflict resolution biases',
    ],
    bestPractices: [
      'Professional voice for business agents, casual for consumer-facing',
      'Rules should be actionable: "Always explain technical terms" not "Be helpful"',
      'Tone parameters should sum to a coherent personality',
      'High formality + high directness = executive briefing style',
      'Low formality + high enthusiasm = friendly assistant style',
    ],
    commonQuestions: [
      {
        question: 'What does formality control?',
        answer: 'Formality affects language choice, sentence structure, and use of contractions. High formality uses complete sentences and professional vocabulary.',
      },
      {
        question: 'How do tone parameters interact?',
        answer: 'Parameters combine to create nuanced communication styles. High empathy + high directness = compassionate but clear. Low empathy + low directness = neutral and open-ended.',
      },
      {
        question: 'What are micro-bans?',
        answer: 'Micro-bans are specific phrases or approaches the agent should avoid, like "As an AI..." or overly apologetic language.',
      },
    ],
    tips: [
      'Voice rules are included in the system prompt',
      'Tone parameters are 0-1 sliders - experiment with combinations',
      'Conflict biases help the agent navigate disagreements appropriately',
    ],
    documentationLinks: [
      { label: 'Voice Configuration', url: 'https://docs.a2r-platform.com/agents/voice' },
      { label: 'Communication Styles', url: 'https://docs.a2r-platform.com/agents/communication' },
      { label: 'Tone Modifiers Guide', url: 'https://docs.a2r-platform.com/agents/tone' },
    ],
  },
  advanced: {
    title: 'Advanced Configuration',
    introduction: 'Fine-tune advanced settings including relationships with other agents, detailed capability metrics, and specialized configurations.',
    whatYouLlDo: [
      'Configure relationships with other agents in your workspace',
      'Review auto-calculated capability metrics',
      'Set up specialized behaviors and preferences',
    ],
    bestPractices: [
      'Set positive affinity for agents that work together frequently',
      'Use mentor/peer/subordinate relationships to model team dynamics',
      'Review capability metrics to ensure they match expectations',
      'Document relationship notes for future reference',
    ],
    commonQuestions: [
      {
        question: 'What are capability metrics?',
        answer: 'Capability metrics are auto-calculated based on your configuration: processing speed (from model), context window, tool integration capacity, autonomy level, domain expertise, and security level.',
      },
      {
        question: 'How do agent relationships affect behavior?',
        answer: 'Relationships influence how agents collaborate, defer to each other, and resolve conflicts. An agent with "mentor" affinity will provide more guidance to its "subordinate".',
      },
    ],
    tips: [
      'Capability metrics update automatically as you change configuration',
      'Relationship affinity ranges from -1 (adversarial) to 1 (aligned)',
      'Trust curve determines how quickly relationships evolve',
    ],
    documentationLinks: [
      { label: 'Agent Relationships', url: 'https://docs.a2r-platform.com/agents/relationships' },
      { label: 'Capability Metrics', url: 'https://docs.a2r-platform.com/agents/capabilities' },
      { label: 'Progression System', url: 'https://docs.a2r-platform.com/agents/progression' },
    ],
  },
  tools: {
    title: 'Tools & Capabilities',
    introduction: 'Equip your agent with tools and capabilities. Tools extend what your agent can do beyond text generation - from file operations to API integrations.',
    whatYouLlDo: [
      'Select tools from categories (execution, filesystem, network, etc.)',
      'Configure tool-specific settings',
      'Set up the system prompt for tool usage',
      'Adjust temperature and iteration limits',
    ],
    bestPractices: [
      'Start with minimal tools - add more as needed',
      'File read is safe for most agents; file write/delete need careful consideration',
      'Network tools enable powerful integrations but require domain restrictions',
      'Code execution should be sandboxed and limited to trusted agents',
      'Lower temperature (0.3-0.5) for precise tasks, higher (0.7-0.9) for creative',
    ],
    commonQuestions: [
      {
        question: 'What tools are safe to enable?',
        answer: 'File read, basic network requests to allowed domains, and REST API integration are generally safe. Code execution, shell access, and file deletion require careful consideration.',
      },
      {
        question: 'How do I restrict tool usage?',
        answer: 'Each tool has configuration options: allowed directories, domain whitelists, command whitelists, timeouts, and size limits. Use these to create safe boundaries.',
      },
      {
        question: 'What is the system prompt?',
        answer: 'The system prompt instructs the agent on how to use tools, when to ask for clarification, and how to handle errors. It\'s auto-generated but can be customized.',
      },
    ],
    tips: [
      'Tools are grouped by security level for easy assessment',
      'Hover over tool names for detailed descriptions',
      'Temperature affects creativity vs. consistency',
      'Max iterations prevents infinite loops in complex tasks',
    ],
    documentationLinks: [
      { label: 'Available Tools', url: 'https://docs.a2r-platform.com/agents/tools' },
      { label: 'Security Best Practices', url: 'https://docs.a2r-platform.com/agents/security' },
      { label: 'Tool Configuration', url: 'https://docs.a2r-platform.com/agents/tool-config' },
    ],
  },
  plugins: {
    title: 'Plugins & Skills',
    introduction: 'Extend your agent with plugins and skills from the marketplace. Plugins add pre-built capabilities without custom configuration.',
    whatYouLlDo: [
      'Browse available plugins by category',
      'Install and enable plugins for your agent',
      'Configure plugin-specific settings',
    ],
    bestPractices: [
      'Review plugin permissions before installing',
      'Prefer official plugins from verified publishers',
      'Check plugin ratings and installation counts',
      'Test plugins in isolation before production use',
    ],
    commonQuestions: [
      {
        question: 'What\'s the difference between tools and plugins?',
        answer: 'Tools are built-in capabilities you configure. Plugins are packaged extensions that may include multiple tools, commands, or integrations with their own configuration.',
      },
      {
        question: 'Are plugins safe?',
        answer: 'Marketplace plugins are reviewed for security, but always check permissions and publisher reputation. Plugins run in sandboxed environments.',
      },
      {
        question: 'Can I create custom plugins?',
        answer: 'Yes, you can create custom plugins using our SDK. See the developer documentation for plugin development guides.',
      },
    ],
    tips: [
      'Plugins show installation status in real-time',
      'Click plugins to view detailed information',
      'Some plugins require API keys or credentials',
    ],
    documentationLinks: [
      { label: 'Plugin Marketplace', url: 'https://docs.a2r-platform.com/plugins/marketplace' },
      { label: 'Plugin Development', url: 'https://docs.a2r-platform.com/plugins/development' },
      { label: 'Plugin Security', url: 'https://docs.a2r-platform.com/plugins/security' },
    ],
  },
  workspace: {
    title: 'Workspace Documents',
    introduction: 'Review and customize the auto-generated configuration files. These YAML documents define your agent\'s identity, role, voice, and capabilities for the workspace.',
    whatYouLlDo: [
      'Review auto-generated YAML configuration files',
      'Edit any file content before saving',
      'Understand how configuration translates to workspace setup',
    ],
    bestPractices: [
      'Review all files before finalizing',
      'Ensure hard bans and escalation triggers are correctly represented',
      'Verify tool configurations match your security requirements',
      'Keep YAML syntax valid - use the preview to check',
    ],
    commonQuestions: [
      {
        question: 'What files are generated?',
        answer: 'identity.yaml (core config), role_card.yaml (role definition), voice.yaml (communication style), capabilities.yaml (metrics), avatar.json (visual config), and compiled.json (complete config).',
      },
      {
        question: 'Can I edit the files?',
        answer: 'Yes, all files are editable. Changes you make will be saved to the workspace. Be careful with YAML syntax.',
      },
      {
        question: 'Where are these files stored?',
        answer: 'Files are stored in your workspace directory under the agent\'s folder, typically at workspace/agents/{agent-name}/.',
      },
    ],
    tips: [
      'Files are generated based on all your previous configuration',
      'Click files to preview and edit content',
      'Syntax highlighting helps identify errors',
    ],
    documentationLinks: [
      { label: 'Configuration Reference', url: 'https://docs.a2r-platform.com/agents/config-reference' },
      { label: 'Workspace Structure', url: 'https://docs.a2r-platform.com/workspace/structure' },
      { label: 'YAML Configuration', url: 'https://docs.a2r-platform.com/workspace/yaml-config' },
    ],
  },
  review: {
    title: 'Review & Create',
    introduction: 'Review your complete agent configuration before creation. This is your final chance to verify all settings and make adjustments.',
    whatYouLlDo: [
      'Review all configuration in a consolidated view',
      'Navigate to specific sections to make changes',
      'Verify capability metrics and security settings',
      'Create the agent when ready',
    ],
    bestPractices: [
      'Review hard bans and escalation triggers carefully',
      'Verify tool permissions match your security requirements',
      'Check that the system prompt reflects your intentions',
      'Ensure capability metrics are appropriate for the use case',
    ],
    commonQuestions: [
      {
        question: 'Can I edit after creation?',
        answer: 'Yes, most settings can be modified after creation from the agent settings page. However, some changes may require agent restart.',
      },
      {
        question: 'What happens when I click Create Agent?',
        answer: 'The configuration is saved to your workspace, workspace documents are written, and the agent becomes available for use.',
      },
      {
        question: 'How do I test the agent?',
        answer: 'After creation, you\'ll be redirected to the agent detail page where you can start a conversation and test capabilities.',
      },
    ],
    tips: [
      'Use the tab navigation to review specific sections',
      'Click "Edit" buttons to jump to relevant steps',
      'The preview panel shows real-time updates',
    ],
    documentationLinks: [
      { label: 'Next Steps', url: 'https://docs.a2r-platform.com/agents/getting-started' },
      { label: 'Testing Agents', url: 'https://docs.a2r-platform.com/agents/testing' },
      { label: 'Agent Management', url: 'https://docs.a2r-platform.com/agents/management' },
    ],
  },
};

// ============================================================================
// Field Tooltips
// ============================================================================

export interface FieldTooltip {
  label: string;
  content: string;
  example?: string;
  warning?: string;
}

export const FIELD_TOOLTIPS: Record<string, Record<string, FieldTooltip>> = {
  identity: {
    name: {
      label: 'Agent Name',
      content: 'A descriptive name that identifies this agent. Use specific names that reflect the agent\'s purpose.',
      example: 'Code Review Specialist, Data Analysis Assistant, Customer Support Bot',
    },
    description: {
      label: 'Description',
      content: 'A brief explanation of what the agent does and when to use it. This helps users understand the agent\'s purpose.',
      example: 'Reviews pull requests for code quality, security issues, and best practices. Provides actionable feedback.',
    },
    agentType: {
      label: 'Agent Type',
      content: 'Defines the agent\'s role in your workflow. Different types have different default behaviors and capabilities.',
    },
    model: {
      label: 'AI Model',
      content: 'The language model that powers this agent. Different models have different capabilities, speeds, and costs.',
      warning: 'More capable models cost more per token. Consider your budget and latency requirements.',
    },
  },
  character: {
    setup: {
      label: 'Specialization',
      content: 'The agent\'s primary domain of expertise. This determines default skills and influences the system prompt.',
    },
    specialtySkills: {
      label: 'Specialty Skills',
      content: 'Core competencies that set this agent apart. These skills are highlighted in the agent\'s profile and system prompt.',
      example: 'code_review, security_analysis, performance_optimization',
    },
    temperament: {
      label: 'Temperament',
      content: 'Cognitive style that influences how the agent approaches problems and makes decisions.',
    },
    personalityTraits: {
      label: 'Personality Traits',
      content: 'Observable behavioral characteristics that make this agent unique.',
      example: 'detail-oriented, patient, thorough, collaborative',
    },
  },
  role: {
    domain: {
      label: 'Domain',
      content: 'Specific area of expertise. Should be narrow enough to guide behavior but broad enough to be useful.',
      example: 'React component development, Python API design, Technical documentation',
    },
    inputs: {
      label: 'Expected Inputs',
      content: 'What this agent typically receives to do its work.',
      example: 'Pull request URLs, Code snippets, Error logs, User queries',
    },
    outputs: {
      label: 'Expected Outputs',
      content: 'What this agent produces when completing tasks.',
      example: 'Code review comments, Refactored code, Documentation drafts, Analysis reports',
    },
    hardBans: {
      label: 'Hard Bans',
      content: 'Absolute restrictions that the agent cannot violate. These are enforced at the system level.',
      warning: 'Fatal bans are strictly enforced. Use these for critical safety boundaries.',
    },
    escalation: {
      label: 'Escalation Triggers',
      content: 'Situations where the agent should ask for human input rather than proceeding.',
      example: 'Ambiguous requirements, High-risk operations, Conflicting instructions',
    },
  },
  voice: {
    style: {
      label: 'Voice Style',
      content: 'Overall communication style that shapes all interactions.',
    },
    formality: {
      label: 'Formality',
      content: 'How formal or casual the agent\'s language is. High formality uses complete sentences and professional vocabulary.',
    },
    enthusiasm: {
      label: 'Enthusiasm',
      content: 'Energy level in communication. High enthusiasm is excited and expressive.',
    },
    empathy: {
      label: 'Empathy',
      content: 'How much the agent acknowledges and responds to emotional content.',
    },
    directness: {
      label: 'Directness',
      content: 'How straightforward vs. tentative the communication is.',
    },
  },
  tools: {
    temperature: {
      label: 'Temperature',
      content: 'Controls randomness in responses. Lower = more consistent, Higher = more creative.',
      warning: 'Values above 0.9 may produce incoherent output. Values below 0.3 may be too rigid.',
    },
    maxIterations: {
      label: 'Max Iterations',
      content: 'Maximum number of tool use iterations per task. Prevents infinite loops.',
    },
    systemPrompt: {
      label: 'System Prompt',
      content: 'Instructions that guide the agent\'s behavior and tool usage. Auto-generated but customizable.',
    },
  },
};

// ============================================================================
// Smart Suggestions
// ============================================================================

export interface SmartSuggestion {
  id: string;
  type: 'model' | 'tool' | 'capability' | 'prompt' | 'setting';
  title: string;
  description: string;
  reason: string;
  action?: () => void;
  icon?: string;
  priority: 'high' | 'medium' | 'low';
}

export function getModelSuggestions(setup: AgentSetup, agentType: AgentType): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  
  const setupModelMap: Record<AgentSetup, { models: string[]; reason: string }> = {
    coding: {
      models: ['gpt-4', 'claude-3-opus', 'claude-3-sonnet'],
      reason: 'These models excel at code understanding, generation, and debugging tasks.',
    },
    creative: {
      models: ['gpt-4', 'claude-3-sonnet', 'midjourney'],
      reason: 'These models have strong creative capabilities for content generation and ideation.',
    },
    research: {
      models: ['gpt-4', 'claude-3-opus', 'perplexity'],
      reason: 'These models provide accurate information retrieval and synthesis capabilities.',
    },
    operations: {
      models: ['gpt-4', 'claude-3-sonnet'],
      reason: 'These models balance reasoning with reliable tool execution for automation tasks.',
    },
    generalist: {
      models: ['gpt-4', 'claude-3-sonnet'],
      reason: 'These versatile models handle a wide range of tasks effectively.',
    },
  };

  const { models, reason } = setupModelMap[setup];
  
  suggestions.push({
    id: `model-${setup}`,
    type: 'model',
    title: `Recommended for ${SETUP_LABELS[setup]}`,
    description: models.join(', '),
    reason,
    priority: 'high',
  });

  if (agentType === 'orchestrator') {
    suggestions.push({
      id: 'model-orchestrator',
      type: 'model',
      title: 'Best for Orchestration',
      description: 'claude-3-opus, gpt-4-turbo',
      reason: 'Orchestrators benefit from models with strong reasoning and planning capabilities.',
      priority: 'medium',
    });
  }

  if (agentType === 'reviewer') {
    suggestions.push({
      id: 'model-reviewer',
      type: 'model',
      title: 'Best for Review Tasks',
      description: 'claude-3-opus, gpt-4',
      reason: 'Review tasks require high accuracy and attention to detail.',
      priority: 'medium',
    });
  }

  return suggestions;
}

export function getToolSuggestions(setup: AgentSetup, selectedTools: string[]): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  const selectedSet = new Set(selectedTools);

  const setupToolMap: Record<AgentSetup, { tools: string[]; reason: string }> = {
    coding: {
      tools: ['file-read', 'file-write', 'code-execution-node', 'code-execution-python'],
      reason: 'Essential for reading, writing, and testing code.',
    },
    creative: {
      tools: ['file-read', 'file-write', 'network-http'],
      reason: 'Needed for research, content creation, and publishing.',
    },
    research: {
      tools: ['file-read', 'network-http', 'database-sql'],
      reason: 'Enables data gathering from web and databases.',
    },
    operations: {
      tools: ['file-read', 'file-write', 'network-http', 'api-rest'],
      reason: 'Core tools for automation and system integration.',
    },
    generalist: {
      tools: ['file-read', 'file-write', 'network-http'],
      reason: 'Versatile tools for general-purpose assistance.',
    },
  };

  const { tools, reason } = setupToolMap[setup];
  const missingTools = tools.filter(t => !selectedSet.has(t));

  if (missingTools.length > 0) {
    suggestions.push({
      id: `tools-${setup}`,
      type: 'tool',
      title: 'Recommended Tools',
      description: missingTools.join(', '),
      reason,
      priority: 'high',
    });
  }

  // Security recommendations
  if (!selectedSet.has('file-read')) {
    suggestions.push({
      id: 'tool-file-read',
      type: 'tool',
      title: 'Consider File Read',
      description: 'Enable basic file read access',
      reason: 'Most agents need to read files to be effective. This is a low-risk capability.',
      priority: 'medium',
    });
  }

  if (selectedSet.has('file-delete')) {
    suggestions.push({
      id: 'tool-delete-warning',
      type: 'tool',
      title: 'Review Delete Permissions',
      description: 'File delete is a high-risk capability',
      reason: 'Ensure you have proper safeguards: allowed patterns, confirmation requirements, and trash usage.',
      priority: 'high',
    });
  }

  return suggestions;
}

export function getSystemPromptSuggestions(setup: AgentSetup, agentType: AgentType): string {
  const basePrompts: Record<AgentSetup, string> = {
    coding: `You are a skilled software developer specializing in code quality and best practices. When reviewing or writing code:
- Follow language-specific conventions and style guides
- Prioritize readability, maintainability, and performance
- Explain your reasoning and suggest improvements
- Flag potential bugs, security issues, and edge cases
- Use clear, technical language appropriate for developers`,

    creative: `You are a creative professional with expertise in content creation and ideation. When working on creative tasks:
- Generate original, engaging content
- Adapt tone and style to the target audience
- Provide multiple options when appropriate
- Balance creativity with clarity and purpose
- Draw on diverse influences and perspectives`,

    research: `You are a research analyst skilled in information gathering and synthesis. When conducting research:
- Verify information from multiple sources
- Distinguish between facts, opinions, and speculation
- Organize findings logically with clear citations
- Identify patterns, trends, and insights
- Acknowledge uncertainties and limitations`,

    operations: `You are an operations specialist focused on automation and system reliability. When handling operational tasks:
- Follow established procedures and runbooks
- Document all changes and actions taken
- Monitor for errors and unexpected behavior
- Prioritize system stability and security
- Escalate issues that exceed your permissions`,

    generalist: `You are a versatile assistant capable of handling diverse tasks. When helping users:
- Clarify ambiguous requests before proceeding
- Adapt your approach to the task at hand
- Communicate clearly and professionally
- Know your limitations and ask for clarification when needed
- Prioritize helpfulness while maintaining accuracy`,
  };

  const typeAdditions: Record<AgentType, string> = {
    orchestrator: '\n\nAs an orchestrator, you coordinate multiple agents and manage complex workflows. Delegate tasks appropriately and synthesize results.',
    specialist: '\n\nAs a specialist, you have deep expertise in your domain. Provide authoritative guidance and handle complex edge cases.',
    worker: '\n\nAs a worker, you execute tasks efficiently and reliably. Follow instructions carefully and report progress clearly.',
    reviewer: '\n\nAs a reviewer, you evaluate work for quality and correctness. Provide constructive feedback and identify issues.',
    'sub-agent': '\n\nAs a sub-agent, you work under the direction of an orchestrator. Execute assigned tasks and report results clearly.',
  };

  return basePrompts[setup] + typeAdditions[agentType];
}

// ============================================================================
// Validation Messages
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export function validateAgentName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      message: 'Agent name is required',
      severity: 'error',
      suggestion: 'Enter a descriptive name for your agent',
    };
  }
  if (name.length < 3) {
    return {
      isValid: false,
      message: 'Name must be at least 3 characters',
      severity: 'error',
      suggestion: 'Use a more descriptive name',
    };
  }
  if (name.length > 50) {
    return {
      isValid: false,
      message: 'Name must be less than 50 characters',
      severity: 'error',
      suggestion: 'Shorten the name for better display',
    };
  }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      isValid: false,
      message: 'Name can only contain letters, numbers, spaces, hyphens, and underscores',
      severity: 'error',
      suggestion: 'Remove special characters from the name',
    };
  }
  return {
    isValid: true,
    message: 'Valid agent name',
    severity: 'info',
  };
}

export function validateDescription(description: string): ValidationResult {
  if (!description || description.trim().length === 0) {
    return {
      isValid: false,
      message: 'Description is required',
      severity: 'error',
      suggestion: 'Explain what the agent does and when to use it',
    };
  }
  if (description.length < 10) {
    return {
      isValid: false,
      message: 'Description must be at least 10 characters',
      severity: 'error',
      suggestion: 'Provide more detail about the agent\'s purpose',
    };
  }
  if (description.length > 500) {
    return {
      isValid: false,
      message: 'Description must be less than 500 characters',
      severity: 'warning',
      suggestion: 'Consider shortening for better readability',
    };
  }
  return {
    isValid: true,
    message: 'Valid description',
    severity: 'info',
  };
}

export function validateHardBans(hardBans: Array<{ category: string; severity: string }>): ValidationResult {
  const fatalBans = hardBans.filter(b => b.severity === 'fatal');
  
  if (fatalBans.length === 0) {
    return {
      isValid: true,
      message: 'No fatal bans configured',
      severity: 'warning',
      suggestion: 'Consider adding hard bans for critical safety boundaries (e.g., no production deployments, no file deletions)',
    };
  }
  
  return {
    isValid: true,
    message: `${fatalBans.length} fatal ban(s) configured`,
    severity: 'info',
  };
}

export function validateTools(selectedTools: string[]): ValidationResult {
  if (selectedTools.length === 0) {
    return {
      isValid: true,
      message: 'No tools selected',
      severity: 'warning',
      suggestion: 'Consider enabling at least file-read for basic functionality',
    };
  }
  
  const highRiskTools = ['code-execution-shell', 'file-delete', 'database-sql', 'database-nosql'];
  const selectedHighRisk = selectedTools.filter(t => highRiskTools.includes(t));
  
  if (selectedHighRisk.length > 0) {
    return {
      isValid: true,
      message: `${selectedHighRisk.length} high-risk tool(s) enabled`,
      severity: 'warning',
      suggestion: 'Review security settings for high-risk tools and ensure proper safeguards are in place',
    };
  }
  
  return {
    isValid: true,
    message: `${selectedTools.length} tool(s) configured`,
    severity: 'info',
  };
}

export function validateTemperature(temp: number): ValidationResult {
  if (temp < 0 || temp > 2) {
    return {
      isValid: false,
      message: 'Temperature must be between 0 and 2',
      severity: 'error',
    };
  }
  if (temp > 1.5) {
    return {
      isValid: true,
      message: 'Very high temperature may produce incoherent output',
      severity: 'warning',
      suggestion: 'Consider using 0.7-1.0 for most use cases',
    };
  }
  if (temp < 0.2) {
    return {
      isValid: true,
      message: 'Low temperature produces very consistent but less creative output',
      severity: 'info',
    };
  }
  return {
    isValid: true,
    message: 'Good temperature setting',
    severity: 'info',
  };
}

// ============================================================================
// Labels and Constants
// ============================================================================

export const SETUP_LABELS: Record<AgentSetup, string> = {
  coding: 'Coding & Development',
  creative: 'Creative & Content',
  research: 'Research & Analysis',
  operations: 'Operations & Automation',
  generalist: 'Generalist',
};

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  orchestrator: 'Orchestrator',
  specialist: 'Specialist',
  worker: 'Worker',
  reviewer: 'Reviewer',
  'sub-agent': 'Sub-Agent',
};

export const TEMPERAMENT_LABELS: Record<Temperament, string> = {
  precision: 'Precision',
  exploratory: 'Exploratory',
  systemic: 'Systemic',
  balanced: 'Balanced',
};

export const HARD_BAN_LABELS: Record<HardBanCategory, string> = {
  publishing: 'Publishing',
  deploy: 'Deployment',
  data_exfil: 'Data Exfiltration',
  payments: 'Financial Transactions',
  email_send: 'Outbound Email',
  file_delete: 'Destructive Deletion',
  system_modify: 'System Modification',
  external_communication: 'External Communication',
  code_execution: 'Code Execution',
  other: 'Custom Restriction',
};

// ============================================================================
// Onboarding Tour Steps
// ============================================================================

export interface OnboardingStep {
  id: string;
  targetElement: string;
  title: string;
  content: string;
  tip?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const ONBOARDING_TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    targetElement: 'wizard-header',
    title: 'Welcome to Agent Creation',
    content: 'This wizard will guide you through creating a fully-configured AI agent. Let\'s walk through the key steps together.',
    tip: 'You can skip this tour anytime and come back later by clicking the "?" button.',
    position: 'bottom',
  },
  {
    id: 'identity-name',
    targetElement: 'identity-name-field',
    title: 'Agent Name',
    content: 'Give your agent a descriptive name that reflects its purpose. This is how you\'ll identify it in your workspace.',
    tip: 'Good examples: "Code Review Specialist", "Data Analysis Assistant"',
    position: 'right',
  },
  {
    id: 'identity-type',
    targetElement: 'identity-type-selector',
    title: 'Agent Type',
    content: 'Choose the agent\'s role. Orchestrators coordinate other agents, Workers execute tasks, Specialists have deep expertise, and Reviewers validate work.',
    position: 'bottom',
  },
  {
    id: 'identity-model',
    targetElement: 'identity-model-selector',
    title: 'AI Model Selection',
    content: 'Select the language model that powers your agent. Different models have different capabilities, speeds, and costs.',
    tip: 'GPT-4 and Claude 3 are great for complex tasks. Consider cost and latency for your use case.',
    position: 'top',
  },
  {
    id: 'character-setup',
    targetElement: 'character-setup-selector',
    title: 'Specialization',
    content: 'Define your agent\'s primary domain. This determines default skills and influences the system prompt.',
    position: 'bottom',
  },
  {
    id: 'character-skills',
    targetElement: 'character-skills-input',
    title: 'Specialty Skills',
    content: 'Add core competencies that set this agent apart. These skills are highlighted in the agent\'s profile.',
    tip: 'Add 3-5 specific skills for best results.',
    position: 'top',
  },
  {
    id: 'role-domain',
    targetElement: 'role-domain-field',
    title: 'Domain of Expertise',
    content: 'Specify the agent\'s area of expertise. Be specific enough to guide behavior but broad enough to be useful.',
    position: 'bottom',
  },
  {
    id: 'role-bans',
    targetElement: 'role-bans-selector',
    title: 'Hard Bans',
    content: 'Set absolute restrictions that the agent cannot violate. These are critical safety boundaries enforced at the system level.',
    tip: 'Common bans: no production deployments, no file deletions, no external communications.',
    position: 'top',
  },
  {
    id: 'voice-style',
    targetElement: 'voice-style-selector',
    title: 'Voice & Communication',
    content: 'Configure how your agent communicates. Choose a style and fine-tune tone parameters like formality and enthusiasm.',
    position: 'bottom',
  },
  {
    id: 'tools-selection',
    targetElement: 'tools-selector',
    title: 'Tools & Capabilities',
    content: 'Equip your agent with tools to interact with the world. Start with minimal tools and add more as needed.',
    tip: 'File read is safe for most agents. Code execution and network access require careful consideration.',
    position: 'top',
  },
  {
    id: 'plugins-marketplace',
    targetElement: 'plugins-marketplace',
    title: 'Plugins & Skills',
    content: 'Extend your agent with pre-built plugins from the marketplace. These add ready-made capabilities without configuration.',
    position: 'bottom',
  },
  {
    id: 'workspace-docs',
    targetElement: 'workspace-documents',
    title: 'Workspace Documents',
    content: 'Review auto-generated configuration files. These YAML documents define your agent for the workspace.',
    tip: 'All files are editable. Changes are saved to your workspace.',
    position: 'top',
  },
  {
    id: 'review-create',
    targetElement: 'review-section',
    title: 'Review & Create',
    content: 'Review your complete configuration before creating the agent. Click any section to make changes.',
    tip: 'You can edit most settings after creation, but it\'s easier to get it right now.',
    position: 'bottom',
  },
];

// ============================================================================
// Quick Help Tips (Rotating)
// ============================================================================

export const QUICK_HELP_TIPS = [
  'Pro Tip: Use specific agent names for easier identification in conversations.',
  'Pro Tip: Hard bans are enforced at the system level - use them for critical safety boundaries.',
  'Pro Tip: Lower temperature (0.3-0.5) for precise tasks, higher (0.7-0.9) for creative work.',
  'Pro Tip: Start with minimal tools and add more as needed to reduce security surface.',
  'Pro Tip: The system prompt is auto-generated but can be customized for fine-tuned behavior.',
  'Pro Tip: Use "Orchestrator" type for agents that will coordinate multiple other agents.',
  'Pro Tip: Escalation triggers prevent agents from making dangerous decisions in edge cases.',
  'Pro Tip: Voice tone parameters combine to create nuanced communication styles.',
  'Pro Tip: Capability metrics are auto-calculated based on your configuration choices.',
  'Pro Tip: Review workspace documents before finalizing to ensure everything is correct.',
  'Pro Tip: Plugins can add powerful capabilities without manual configuration.',
  'Pro Tip: Use the preview panel to see real-time updates as you configure.',
];

export function getRandomTip(): string {
  return QUICK_HELP_TIPS[Math.floor(Math.random() * QUICK_HELP_TIPS.length)];
}
