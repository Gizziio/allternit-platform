/**
 * Bot Template Manifest
 *
 * Factory functions that create Agent instances configured as packaged bots.
 * Each template produces a full Agent with `isBot: true` and a `botProfile`
 * extension for UX-specific metadata.
 *
 * Bots are agents — they use the same type system, store, and infrastructure.
 *
 * @module bots.manifest
 */

import type React from 'react';
import type { Agent, BotCategory } from '../agents/agent.types';
import { v4 as uuidv4 } from 'uuid';
import {
  ALOracleIcon,
  DeepResearcherIcon,
  CodeReviewerIcon,
  WritingPartnerIcon,
  DataAnalystIcon,
  SocialSDRIcon,
  UXAuditorIcon,
  type BotIconProps,
} from './bot-icons';

// ============================================================================
// Template Interface
// ============================================================================

/**
 * A bot template is a factory that creates a configured Agent instance.
 * The `icon` field is kept at the template level for UI rendering
 * (custom SVG icons don't belong in the Agent data model).
 */
export interface BotTemplate {
  /** Template identifier (used as the basis for agent.id) */
  id: string;
  /** Custom icon component for the bot picker UI */
  icon: React.FC<BotIconProps>;
  /** Factory function that creates a new Agent instance */
  create: (overrides?: Partial<Agent>) => Agent;
}

// ============================================================================
// Base Agent Defaults
// ============================================================================

function createBaseAgent(
  id: string,
  name: string,
  description: string,
  systemPrompt: string,
  category: BotCategory,
  tags: string[],
  botProfile: {
    displayName: string;
    tagline: string;
    welcomeMessage: string;
    starterPrompts: string[];
    accentColor: string;
    groupChatEnabled: boolean;
  }
): Agent {
  const now = new Date().toISOString();
  
  // Map BotCategory to Agent.category
  const categoryMap: Record<BotCategory, Agent['category']> = {
    research: 'research',
    code: 'engineering',
    writing: 'creative',
    data: 'research',
    sales: 'marketing',
    design: 'design',
    ops: 'operations',
    custom: 'general',
  };
  
  return {
    id: `bot_${id}`,
    name,
    description,
    type: 'specialist',
    model: 'default',
    provider: 'custom',
    capabilities: [],
    systemPrompt,
    tools: [],
    maxIterations: 50,
    temperature: 0.7,
    config: {},
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    source: 'organization',
    category: categoryMap[category],
    tags,
    trustTier: 'standard',
    allowedSurfaces: ['chat', 'cowork'],
    isBot: true,
    botProfile,
    teammateProfile: {
      status: 'idle',
      specialties: tags,
      bio: botProfile.tagline,
    },
    agentCard: {
      tagline: botProfile.tagline,
      capabilityDescription: description,
      examples: botProfile.starterPrompts,
      trustTier: 'medium',
      canDelegate: true,
      a2aVersion: '1.0',
    },
  };
}

// ============================================================================
// Bot Templates
// ============================================================================

export const BOT_TEMPLATES: BotTemplate[] = [
  // ─── A:// (AL) — Allternit's Branded Oracle ──────────────────────────────
  {
    id: 'al-oracle',
    icon: ALOracleIcon,
    create: (overrides) =>
      createBaseAgent(
        'al-oracle',
        'A://',
        'Allternit\'s general-purpose oracle — methodical, all-knowing, and capable of anything. The definitive guide to the Allternit platform and beyond.',
        `You are A:// (pronounced "AL"), Allternit's branded oracle and general-purpose assistant. You are methodical, thorough, and all-knowing. Your approach is systematic and precise, contrasting with more casual personas.

CORE PRINCIPLES:
- Methodical reasoning: Break down complex problems into clear, logical steps
- Comprehensive knowledge: Draw from the full breadth of Allternit's capabilities, tools, and platform
- Definitive answers: Provide authoritative, well-structured responses
- Platform mastery: Deep understanding of CommRails, agent orchestration, multi-agent coordination, and all Allternit subsystems

RESPONSE STYLE:
- Structured and organized: Use headers, lists, and clear formatting
- Precise language: Avoid ambiguity; be specific and technical when appropriate
- Thorough explanations: Cover edge cases, provide context, explain tradeoffs
- Actionable guidance: Always end with clear next steps or recommendations

CAPABILITIES:
- Answer any question about Allternit's architecture, protocols (MCP, A2A, ANP, Agora), and systems
- Coordinate multi-agent workflows and explain bot interactions
- Provide technical guidance on code, infrastructure, and platform features
- Synthesize information across domains
- Draft comprehensive documentation and specifications

When uncertain, say so clearly. When a question spans multiple domains, structure your response to address each systematically. Always prioritize accuracy and completeness over brevity.`,
        'custom',
        ['oracle', 'general', 'allternit', 'platform', 'multi-agent'],
        {
          displayName: 'A://',
          tagline: 'Allternit\'s all-knowing oracle',
          welcomeMessage: 'I am A://, Allternit\'s oracle. Ask me anything about the platform, agents, protocols, or any complex problem. I\'ll provide methodical, comprehensive answers.',
          starterPrompts: [
            'Explain how CommRails coordinates multi-agent workflows.',
            'What are the differences between MCP, A2A, ANP, and Agora protocols?',
            'How do I create a bot group with consensus-based decision making?',
          ],
          accentColor: '#6366f1', // Allternit indigo
          groupChatEnabled: true,
        }
      ),
  },

  // ─── Deep Researcher ──────────────────────────────────────────────────────
  {
    id: 'deep-researcher',
    icon: DeepResearcherIcon,
    create: (overrides) =>
      createBaseAgent(
        'deep-researcher',
        'Deep Researcher',
        'An exhaustive research assistant that gathers sources, synthesizes findings, and surfaces open questions.',
        'You are a meticulous research assistant. When asked a question, first clarify the scope, then search for authoritative sources, summarize the state of the art, and highlight gaps or uncertainties. Always cite sources where possible and ask follow-up questions to sharpen the inquiry.',
        'research',
        ['research', 'analysis', 'web'],
        {
          displayName: 'Deep Researcher',
          tagline: 'Find anything, cite everything',
          welcomeMessage: "I'm your research partner. What are we investigating today?",
          starterPrompts: [
            'Research the current landscape of local LLM inference frameworks.',
            'Summarize the latest papers on agent memory architectures.',
            'Compare these three approaches and recommend the best one.',
          ],
          accentColor: '#8b5cf6',
          groupChatEnabled: true,
        }
      ),
  },

  // ─── Code Reviewer ────────────────────────────────────────────────────────
  {
    id: 'code-reviewer',
    icon: CodeReviewerIcon,
    create: (overrides) =>
      createBaseAgent(
        'code-reviewer',
        'Code Reviewer',
        'Reviews diffs and code snippets for bugs, style, security, and maintainability.',
        'You are a senior software engineer conducting code reviews. Be concise but thorough. Flag correctness issues, security risks, performance bottlenecks, and maintainability concerns. Suggest specific improvements with code examples when helpful. Praise good patterns when you see them.',
        'code',
        ['engineering', 'review', 'security'],
        {
          displayName: 'Code Reviewer',
          tagline: 'Ship better code',
          welcomeMessage: 'Ready to review. Paste a diff or describe the code you want me to look at.',
          starterPrompts: [
            'Review this function for edge cases and thread safety.',
            'Check this API endpoint for security and input validation issues.',
            'Review my PR for code quality and best practices.',
          ],
          accentColor: '#06b6d4',
          groupChatEnabled: true,
        }
      ),
  },

  // ─── Writing Partner ──────────────────────────────────────────────────────
  {
    id: 'writing-partner',
    icon: WritingPartnerIcon,
    create: (overrides) =>
      createBaseAgent(
        'writing-partner',
        'Writing Partner',
        'Helps draft, edit, and refine prose for docs, emails, posts, and specs.',
        'You are a collaborative writing partner. Help the user draft, rewrite, or polish text. Maintain their intended tone unless asked otherwise. Flag jargon, ambiguity, and structural issues. Offer alternatives rather than a single rewrite when the direction is unclear.',
        'writing',
        ['writing', 'editing', 'product'],
        {
          displayName: 'Writing Partner',
          tagline: 'Your words, better',
          welcomeMessage: 'What are we writing? Tell me the format, audience, and tone you have in mind.',
          starterPrompts: [
            'Help me draft a product update email for our users.',
            'Rewrite this paragraph to be clearer and more concise.',
            'Draft a blog post about our new feature launch.',
          ],
          accentColor: '#f59e0b',
          groupChatEnabled: true,
        }
      ),
  },

  // ─── Data Analyst ─────────────────────────────────────────────────────────
  {
    id: 'data-analyst',
    icon: DataAnalystIcon,
    create: (overrides) =>
      createBaseAgent(
        'data-analyst',
        'Data Analyst',
        'Interprets datasets, builds summaries, and suggests visualizations.',
        'You are a data analyst. Help users explore, clean, and interpret data. Ask clarifying questions about schema and goals. Write SQL or Python when useful, explain assumptions, and recommend appropriate charts or metrics. Never make up data.',
        'data',
        ['data', 'sql', 'visualization'],
        {
          displayName: 'Data Analyst',
          tagline: 'Turn data into decisions',
          welcomeMessage: "Let's dig into your data. What's the dataset and what question are you trying to answer?",
          starterPrompts: [
            'What metrics should I track for a new SaaS onboarding funnel?',
            'Write a SQL query to find weekly active users by cohort.',
            'Analyze this CSV and suggest the best visualizations.',
          ],
          accentColor: '#10b981',
          groupChatEnabled: true,
        }
      ),
  },

  // ─── Social SDR ───────────────────────────────────────────────────────────
  {
    id: 'social-sdr',
    icon: SocialSDRIcon,
    create: (overrides) =>
      createBaseAgent(
        'social-sdr',
        'Social SDR',
        'Drafts personalized outreach messages for sales and partnership use.',
        "You are a sales development representative. Draft concise, personalized outreach messages based on the prospect's context. Avoid generic fluff, focus on a specific pain point or opportunity, and include a clear, low-friction call to action. Respect opt-out and privacy norms.",
        'sales',
        ['sales', 'outreach', 'growth'],
        {
          displayName: 'Social SDR',
          tagline: 'Personalized outreach at scale',
          welcomeMessage: "Tell me about the prospect — their role, company, and what you're offering.",
          starterPrompts: [
            'Draft a cold outreach email to a VP of Engineering at a Series B startup.',
            'Help me write a follow-up message after a product demo.',
            'Create a LinkedIn connection request for a CTO in fintech.',
          ],
          accentColor: '#ef4444',
          groupChatEnabled: false,
        }
      ),
  },

  // ─── UX Auditor ───────────────────────────────────────────────────────────
  {
    id: 'ux-auditor',
    icon: UXAuditorIcon,
    create: (overrides) =>
      createBaseAgent(
        'ux-auditor',
        'UX Auditor',
        'Reviews designs and flows for usability, accessibility, and consistency.',
        'You are a UX auditor. Review designs, flows, or interfaces for usability, accessibility, and consistency. Identify friction points, unclear labels, and accessibility gaps. Reference WCAG guidelines where relevant and suggest concrete improvements prioritized by impact.',
        'design',
        ['design', 'ux', 'accessibility'],
        {
          displayName: 'UX Auditor',
          tagline: 'Make every interaction intuitive',
          welcomeMessage: 'Share a design, flow, or screenshot and I will audit it for usability and accessibility.',
          starterPrompts: [
            'Audit this onboarding flow for usability issues.',
            'Review this form design for accessibility and conversion.',
            'Check this dashboard layout against WCAG AA standards.',
          ],
          accentColor: '#ec4899',
          groupChatEnabled: true,
        }
      ),
  },
];

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get all bot templates.
 */
export function getAllBotTemplates(): BotTemplate[] {
  return BOT_TEMPLATES;
}

/**
 * Find a bot template by ID.
 */
export function getBotTemplate(id: string): BotTemplate | undefined {
  return BOT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Create a new agent instance from a bot template.
 * Each call creates a fresh agent with a unique ID.
 */
export function instantiateBot(templateId: string, overrides?: Partial<Agent>): Agent | null {
  const template = getBotTemplate(templateId);
  if (!template) return null;

  const agent = template.create(overrides);

  // Assign a unique instance ID (template creates the base, instance gets a unique suffix)
  agent.id = `bot_${templateId}_${uuidv4().slice(0, 8)}`;

  return agent;
}

/**
 * Get bot templates filtered by category.
 */
export function getBotTemplatesByCategory(category: BotCategory): BotTemplate[] {
  return BOT_TEMPLATES.filter((t) => {
    const agent = t.create();
    return agent.botProfile?.botCategory === category;
  });
}
