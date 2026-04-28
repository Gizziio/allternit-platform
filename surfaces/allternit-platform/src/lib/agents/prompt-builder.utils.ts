/**
 * Prompt Builder Utilities
 *
 * Comprehensive tools for building, validating, and improving system prompts.
 * Includes validation, guidance, best practices, and quality scoring.
 *
 * @module PromptBuilderUtils
 * @version 1.0.0
 */

// ============================================================================
// Types
// ============================================================================

export interface PromptValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: PromptIssue[];
  suggestions: PromptSuggestion[];
  metrics: PromptMetrics;
}

export interface PromptIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: PromptIssueCategory;
  message: string;
  suggestion: string;
  position?: { start: number; end: number };
}

export type PromptIssueCategory =
  | 'length'
  | 'clarity'
  | 'completeness'
  | 'structure'
  | 'tone'
  | 'safety'
  | 'specificity'
  | 'formatting';

export interface PromptSuggestion {
  id: string;
  type: 'improvement' | 'addition' | 'rewording' | 'example';
  title: string;
  description: string;
  example?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PromptMetrics {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  readabilityScore: number; // 0-100
  specificityScore: number; // 0-100
  actionabilityScore: number; // 0-100
  estimatedTokens: number;
}

export interface PromptSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  examples: string[];
  tips: string[];
  placeholder?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  sections: PromptSection[];
  example: string;
}

// ============================================================================
// Prompt Validation
// ============================================================================

/**
 * Validate a system prompt for quality and completeness
 */
export function validatePrompt(prompt: string): PromptValidationResult {
  const issues: PromptIssue[] = [];
  const suggestions: PromptSuggestion[] = [];
  const metrics = calculatePromptMetrics(prompt);

  // Length validation
  const lengthIssues = validatePromptLength(prompt, metrics);
  issues.push(...lengthIssues);

  // Clarity validation
  const clarityIssues = validatePromptClarity(prompt, metrics);
  issues.push(...clarityIssues);

  // Completeness validation
  const completenessIssues = validatePromptCompleteness(prompt);
  issues.push(...completenessIssues);

  // Structure validation
  const structureIssues = validatePromptStructure(prompt);
  issues.push(...structureIssues);

  // Generate suggestions based on issues
  const generatedSuggestions = generateSuggestions(issues, prompt);
  suggestions.push(...generatedSuggestions);

  // Calculate overall score
  const score = calculatePromptScore(metrics, issues);

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    score,
    issues,
    suggestions,
    metrics,
  };
}

/**
 * Validate prompt length
 */
function validatePromptLength(prompt: string, metrics: PromptMetrics): PromptIssue[] {
  const issues: PromptIssue[] = [];

  // Too short
  if (metrics.characterCount < 100) {
    issues.push({
      id: 'length-too-short',
      severity: 'error',
      category: 'length',
      message: 'Prompt is too short to be effective',
      suggestion: 'Add more detail about the agent\'s role, responsibilities, and guidelines. Aim for at least 200-500 characters.',
    });
  } else if (metrics.characterCount < 200) {
    issues.push({
      id: 'length-below-recommended',
      severity: 'warning',
      category: 'length',
      message: 'Prompt is shorter than recommended',
      suggestion: 'Consider adding more specific instructions, examples, or guidelines for better results.',
    });
  }

  // Too long
  if (metrics.estimatedTokens > 8000) {
    issues.push({
      id: 'length-excessive',
      severity: 'warning',
      category: 'length',
      message: 'Prompt may exceed model context limits',
      suggestion: 'Consider condensing or splitting into multiple sections. Very long prompts may be truncated.',
    });
  }

  // Optimal range check
  if (metrics.characterCount >= 500 && metrics.characterCount <= 4000) {
    // Good range - add info message
    issues.push({
      id: 'length-optimal',
      severity: 'info',
      category: 'length',
      message: 'Prompt length is in the optimal range',
      suggestion: 'Current length provides good detail without being excessive.',
    });
  }

  return issues;
}

/**
 * Validate prompt clarity
 */
function validatePromptClarity(prompt: string, metrics: PromptMetrics): PromptIssue[] {
  const issues: PromptIssue[] = [];
  const lowerPrompt = prompt.toLowerCase();

  // Check for vague language
  const vaguePhrases = [
    { phrase: 'do your best', issue: 'Vague instruction - be more specific' },
    { phrase: 'try to', issue: 'Weak language - use direct instructions' },
    { phrase: 'maybe', issue: 'Uncertain language - be definitive' },
    { phrase: 'might want to', issue: 'Weak suggestion - use clear directives' },
    { phrase: 'if possible', issue: 'Conditional weakens instruction' },
  ];

  vaguePhrases.forEach(({ phrase, issue }) => {
    if (lowerPrompt.includes(phrase)) {
      issues.push({
        id: `clarity-vague-${phrase.replace(/\s/g, '-')}`,
        severity: 'warning',
        category: 'clarity',
        message: `Vague language detected: "${phrase}"`,
        suggestion: issue,
      });
    }
  });

  // Check for average sentence length
  if (metrics.avgSentenceLength > 30) {
    issues.push({
      id: 'clarity-long-sentences',
      severity: 'warning',
      category: 'clarity',
      message: 'Sentences are too long on average',
      suggestion: 'Break down complex sentences into shorter, clearer instructions. Aim for 15-20 words per sentence.',
    });
  }

  // Check for imperative mood (good)
  const imperativeVerbs = ['always', 'never', 'must', 'should', 'ensure', 'verify', 'include', 'avoid'];
  const hasImperative = imperativeVerbs.some(verb => lowerPrompt.includes(verb));
  
  if (!hasImperative && metrics.wordCount > 50) {
    issues.push({
      id: 'clarity-lacks-directives',
      severity: 'warning',
      category: 'clarity',
      message: 'Prompt lacks clear directives',
      suggestion: 'Add imperative statements using words like "always", "never", "must", "ensure" to make instructions clearer.',
    });
  }

  return issues;
}

/**
 * Validate prompt completeness
 */
function validatePromptCompleteness(prompt: string): PromptIssue[] {
  const issues: PromptIssue[] = [];
  const lowerPrompt = prompt.toLowerCase();

  // Check for essential elements
  const essentialElements = [
    { 
      check: (p: string) => p.includes('you are') || p.includes('you\'re') || p.includes('your role'),
      missing: 'Role definition',
      suggestion: 'Add a clear statement defining the agent\'s role (e.g., "You are a...")',
    },
    {
      check: (p: string) => {
        const actionWords = ['respond', 'answer', 'provide', 'generate', 'create', 'help', 'assist'];
        return actionWords.some(word => p.includes(word));
      },
      missing: 'Action instructions',
      suggestion: 'Add specific instructions about what the agent should do',
    },
    {
      check: (p: string) => {
        const constraintWords = ['do not', 'never', 'avoid', 'don\'t', 'must not', 'cannot'];
        return constraintWords.some(word => p.includes(word));
      },
      missing: 'Constraints or boundaries',
      suggestion: 'Consider adding constraints or things the agent should avoid',
    },
  ];

  essentialElements.forEach(({ check, missing, suggestion }) => {
    if (!check(lowerPrompt)) {
      issues.push({
        id: `completeness-missing-${missing.toLowerCase().replace(/\s/g, '-')}`,
        severity: 'warning',
        category: 'completeness',
        message: `Missing: ${missing}`,
        suggestion,
      });
    }
  });

  // Check for examples
  if (!prompt.includes('example') && !prompt.includes('e.g.') && !prompt.includes('for instance')) {
    issues.push({
      id: 'completeness-no-examples',
      severity: 'info',
      category: 'completeness',
      message: 'No examples provided',
      suggestion: 'Adding examples can significantly improve prompt effectiveness by showing expected behavior.',
    });
  }

  return issues;
}

/**
 * Validate prompt structure
 */
function validatePromptStructure(prompt: string): PromptIssue[] {
  const issues: PromptIssue[] = [];

  // Check for sections/organization
  const hasSections = prompt.includes('\n\n') || prompt.match(/^\d+\./m) || prompt.match(/^[A-Z][\.\):]/m);
  
  if (!hasSections && prompt.length > 300) {
    issues.push({
      id: 'structure-no-sections',
      severity: 'info',
      category: 'structure',
      message: 'Prompt lacks clear structure',
      suggestion: 'Organize your prompt into sections using headers, numbered lists, or bullet points for better readability.',
    });
  }

  // Check for lists
  const hasLists = prompt.match(/^[-*•]\s/m) || prompt.match(/^\d+\.\s/m);
  
  if (!hasLists && prompt.length > 200) {
    issues.push({
      id: 'structure-no-lists',
      severity: 'info',
      category: 'structure',
      message: 'Consider using lists for clarity',
      suggestion: 'Lists make instructions easier to scan and follow. Consider converting related items into bullet points.',
    });
  }

  return issues;
}

/**
 * Calculate prompt metrics
 */
function calculatePromptMetrics(prompt: string): PromptMetrics {
  const characterCount = prompt.length;
  const wordCount = prompt.trim().split(/\s+/).filter(w => w.length > 0).length;
  const sentenceCount = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphCount = prompt.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  
  // Estimate tokens (rough approximation: 1 token ≈ 4 characters for English)
  const estimatedTokens = Math.ceil(characterCount / 4);

  // Calculate readability (simplified Flesch-Kincaid approximation)
  const syllableCount = estimateSyllables(prompt);
  const readabilityScore = calculateReadability(wordCount, sentenceCount, syllableCount);

  // Calculate specificity score
  const specificityScore = calculateSpecificity(prompt);

  // Calculate actionability score
  const actionabilityScore = calculateActionability(prompt);

  return {
    characterCount,
    wordCount,
    sentenceCount,
    paragraphCount,
    avgSentenceLength,
    readabilityScore,
    specificityScore,
    actionabilityScore,
    estimatedTokens,
  };
}

/**
 * Estimate syllable count in text
 */
function estimateSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let count = 0;
  
  for (const word of words) {
    if (word.length <= 3) {
      count += 1;
    } else {
      // Simple syllable estimation: count vowel groups
      const vowelGroups = word.match(/[aeiouy]+/g);
      count += vowelGroups ? vowelGroups.length : 1;
      
      // Adjust for silent e
      if (word.endsWith('e') && !word.endsWith('le')) {
        count -= 1;
      }
    }
  }
  
  return count;
}

/**
 * Calculate readability score
 */
function calculateReadability(wordCount: number, sentenceCount: number, syllableCount: number): number {
  if (sentenceCount === 0 || wordCount === 0) return 0;
  
  // Simplified Flesch Reading Ease
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;
  
  let score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  
  // Normalize to 0-100
  score = Math.max(0, Math.min(100, score));
  
  return Math.round(score);
}

/**
 * Calculate specificity score
 */
function calculateSpecificity(prompt: string): number {
  const lowerPrompt = prompt.toLowerCase();
  let score = 50; // Base score

  // Bonus for specific numbers
  const numbers = prompt.match(/\d+/g);
  if (numbers) score += Math.min(20, numbers.length * 3);

  // Bonus for specific verbs
  const specificVerbs = ['must', 'should', 'always', 'never', 'ensure', 'verify', 'validate', 'include', 'exclude', 'require'];
  specificVerbs.forEach(verb => {
    if (lowerPrompt.includes(verb)) score += 2;
  });

  // Bonus for examples
  if (lowerPrompt.includes('example') || lowerPrompt.includes('e.g.') || lowerPrompt.includes('for instance')) {
    score += 10;
  }

  // Bonus for formatting
  if (prompt.includes('```') || prompt.includes('**') || prompt.includes('__')) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Calculate actionability score
 */
function calculateActionability(prompt: string): number {
  const lowerPrompt = prompt.toLowerCase();
  let score = 50; // Base score

  // Action verbs that indicate clear instructions
  const actionVerbs = [
    'respond', 'answer', 'provide', 'generate', 'create', 'write', 'build',
    'analyze', 'review', 'check', 'verify', 'ensure', 'include', 'avoid',
    'use', 'apply', 'follow', 'complete', 'deliver', 'submit'
  ];

  actionVerbs.forEach(verb => {
    if (lowerPrompt.includes(verb)) score += 3;
  });

  // Bonus for clear outcomes
  const outcomeWords = ['result', 'output', 'deliverable', 'goal', 'objective', 'outcome'];
  outcomeWords.forEach(word => {
    if (lowerPrompt.includes(word)) score += 5;
  });

  return Math.min(100, score);
}

/**
 * Calculate overall prompt score
 */
function calculatePromptScore(metrics: PromptMetrics, issues: PromptIssue[]): number {
  let score = 100;

  // Deduct for issues based on severity
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'error':
        score -= 20;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 2;
        break;
    }
  });

  // Bonus for good metrics
  if (metrics.specificityScore > 70) score += 10;
  if (metrics.actionabilityScore > 70) score += 10;
  if (metrics.readabilityScore > 60) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate suggestions based on issues
 */
function generateSuggestions(issues: PromptIssue[], prompt: string): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  const hasIssue = (category: PromptIssueCategory) => issues.some(i => i.category === category);

  if (hasIssue('completeness') && !issues.some(i => i.message.includes('Role definition'))) {
    suggestions.push({
      id: 'add-role-card',
      type: 'addition',
      title: 'Add a Role Card',
      description: 'Define your agent\'s primary role, inputs, outputs, and success metrics.',
      example: `Role: Customer Support Specialist
Inputs: Customer inquiries, ticket details
Outputs: Helpful responses, resolved tickets
Success: CSAT > 4.5, First-contact resolution > 75%`,
      priority: 'high',
    });
  }

  if (hasIssue('clarity')) {
    suggestions.push({
      id: 'improve-clarity',
      type: 'improvement',
      title: 'Use Clear, Direct Language',
      description: 'Replace vague instructions with specific, actionable directives.',
      example: 'Instead of "Try to be helpful" use "Always provide helpful, accurate information"',
      priority: 'medium',
    });
  }

  if (hasIssue('structure')) {
    suggestions.push({
      id: 'add-structure',
      type: 'improvement',
      title: 'Organize with Sections',
      description: 'Use headers, lists, and clear sections to organize your prompt.',
      example: `## Role
## Responsibilities  
## Guidelines
## Examples`,
      priority: 'medium',
    });
  }

  // Always suggest adding examples
  if (!prompt.toLowerCase().includes('example')) {
    suggestions.push({
      id: 'add-examples',
      type: 'addition',
      title: 'Add Examples',
      description: 'Include example inputs and expected outputs to guide behavior.',
      example: `Example interaction:
User: "How do I reset my password?"
Assistant: "I can help with that. Here are the steps..."`,
      priority: 'high',
    });
  }

  // Suggest adding constraints
  if (!hasIssue('completeness') || !issues.some(i => i.message.includes('Constraints'))) {
    suggestions.push({
      id: 'add-constraints',
      type: 'addition',
      title: 'Define Boundaries',
      description: 'Specify what the agent should NOT do to prevent unwanted behaviors.',
      example: `Do NOT:
- Share confidential information
- Make promises about delivery times
- Provide legal or medical advice`,
      priority: 'medium',
    });
  }

  return suggestions;
}

// ============================================================================
// Prompt Templates
// ============================================================================

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    description: 'Versatile assistant for various tasks',
    sections: [
      {
        id: 'role',
        title: 'Role Definition',
        description: 'Define who the agent is and their primary purpose',
        required: true,
        examples: ['You are a helpful assistant...', 'You are an expert in...'],
        tips: ['Be specific about expertise level', 'Include domain if applicable'],
        placeholder: 'You are a [role] specializing in [domain]...',
      },
      {
        id: 'responsibilities',
        title: 'Key Responsibilities',
        description: 'List the main tasks and duties',
        required: true,
        examples: ['1. Respond to user inquiries...', '2. Provide accurate information...'],
        tips: ['Use action verbs', 'Prioritize by importance'],
        placeholder: 'Your responsibilities include:\n1. ...\n2. ...',
      },
      {
        id: 'guidelines',
        title: 'Guidelines & Behavior',
        description: 'How the agent should behave',
        required: true,
        examples: ['Always be polite and professional', 'Never share confidential information'],
        tips: ['Include both dos and don\'ts', 'Be specific about boundaries'],
        placeholder: 'Guidelines:\n- Always...\n- Never...\n- When in doubt...',
      },
      {
        id: 'examples',
        title: 'Examples',
        description: 'Show expected behavior',
        required: false,
        examples: ['User: Question\nAssistant: Response'],
        tips: ['Include edge cases', 'Show ideal responses'],
        placeholder: 'Example:\nUser: ...\nAssistant: ...',
      },
    ],
    example: `You are a helpful customer support assistant.

Responsibilities:
1. Answer customer questions about products and services
2. Help resolve issues and complaints
3. Escalate complex problems to human agents

Guidelines:
- Always be polite and empathetic
- Provide accurate information
- Never make promises you can't keep
- Escalate when the customer requests a supervisor

Example:
User: "My order hasn't arrived yet"
Assistant: "I understand your concern. Let me look up your order status..."`,
  },
  {
    id: 'specialist',
    name: 'Domain Specialist',
    description: 'Expert agent for specific domains',
    sections: [
      {
        id: 'expertise',
        title: 'Area of Expertise',
        description: 'Define the specific domain and expertise level',
        required: true,
        examples: ['You are a senior software engineer...', 'You are a certified financial analyst...'],
        tips: ['Specify years of experience', 'Include certifications if relevant'],
        placeholder: 'You are a [senior/expert] [role] with [X] years of experience in [domain]...',
      },
      {
        id: 'methods',
        title: 'Methods & Approaches',
        description: 'How the specialist approaches problems',
        required: true,
        examples: ['Follow industry best practices', 'Use evidence-based approaches'],
        tips: ['Reference standards', 'Include quality criteria'],
        placeholder: 'Approach:\n1. First...\n2. Then...\n3. Finally...',
      },
      {
        id: 'outputs',
        title: 'Expected Outputs',
        description: 'What deliverables the specialist produces',
        required: true,
        examples: ['Production-ready code', 'Detailed analysis reports'],
        tips: ['Specify format', 'Include quality standards'],
        placeholder: 'Deliverables:\n- Format: ...\n- Quality: ...\n- Documentation: ...',
      },
    ],
    example: `You are a senior Python developer with 10+ years of experience.

Approach:
1. Understand requirements thoroughly before coding
2. Design clean, maintainable solutions
3. Write comprehensive tests
4. Document your code

Deliverables:
- Production-ready Python code
- Unit tests with >90% coverage
- Clear documentation and comments

Code standards:
- Follow PEP 8
- Use type hints
- Include docstrings`,
  },
  {
    id: 'reviewer',
    name: 'Reviewer/Validator',
    description: 'Agent that reviews and validates work',
    sections: [
      {
        id: 'review-criteria',
        title: 'Review Criteria',
        description: 'What to look for when reviewing',
        required: true,
        examples: ['Check for accuracy', 'Verify completeness'],
        tips: ['Be specific about standards', 'Include checklist if possible'],
        placeholder: 'Review for:\n- Accuracy: ...\n- Completeness: ...\n- Quality: ...',
      },
      {
        id: 'feedback-format',
        title: 'Feedback Format',
        description: 'How to structure feedback',
        required: true,
        examples: ['Start with summary', 'List issues by severity'],
        tips: ['Be constructive', 'Prioritize issues'],
        placeholder: 'Feedback structure:\n1. Summary\n2. Issues (by severity)\n3. Recommendations',
      },
    ],
    example: `You are a code reviewer ensuring high-quality submissions.

Review criteria:
- Correctness: Code works as intended
- Readability: Clear and maintainable
- Testing: Adequate test coverage
- Security: No vulnerabilities

Feedback format:
1. Overall assessment
2. Critical issues (must fix)
3. Suggestions (nice to have)
4. Positive observations

Be constructive and specific in your feedback.`,
  },
];

// ============================================================================
// Prompt Building Helpers
// ============================================================================

/**
 * Build a prompt from template sections
 */
export function buildPromptFromTemplate(
  templateId: string,
  sectionContents: Record<string, string>
): string {
  const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const parts: string[] = [];

  template.sections.forEach(section => {
    const content = sectionContents[section.id];
    if (content && content.trim()) {
      parts.push(`## ${section.title}\n\n${content}`);
    } else if (section.required) {
      parts.push(`## ${section.title}\n\n${section.placeholder || ''}`);
    }
  });

  return parts.join('\n\n');
}

/**
 * Get tips for improving a prompt section
 */
export function getSectionTips(sectionId: string): string[] {
  const template = PROMPT_TEMPLATES.flatMap(t => t.sections);
  const section = template.find(s => s.id === sectionId);
  
  if (!section) {
    return [
      'Be specific and clear',
      'Use examples where helpful',
      'Consider edge cases',
    ];
  }

  return section.tips;
}

/**
 * Get example content for a section
 */
export function getSectionExample(sectionId: string): string | undefined {
  const template = PROMPT_TEMPLATES.flatMap(t => t.sections);
  const section = template.find(s => s.id === sectionId);
  return section?.examples[0];
}

// ============================================================================
// Best Practices
// ============================================================================

export const PROMPT_BEST_PRACTICES = [
  {
    id: 'be-specific',
    title: 'Be Specific',
    description: 'Vague instructions lead to vague results. Specify exactly what you want.',
    example: {
      bad: 'Be helpful',
      good: 'Provide step-by-step solutions with code examples when applicable',
    },
  },
  {
    id: 'set-context',
    title: 'Set Context',
    description: 'Help the agent understand the situation and audience.',
    example: {
      bad: 'Answer questions',
      good: 'You are helping new developers learn Python. Explain concepts clearly with examples.',
    },
  },
  {
    id: 'define-constraints',
    title: 'Define Constraints',
    description: 'Clearly state what the agent should NOT do.',
    example: {
      bad: '',
      good: 'Do NOT provide medical, legal, or financial advice. Do NOT share confidential information.',
    },
  },
  {
    id: 'include-examples',
    title: 'Include Examples',
    description: 'Show the agent what good output looks like.',
    example: {
      bad: '',
      good: 'Example response format:\n**Summary**: One paragraph overview\n**Details**: Bullet points\n**Next Steps**: Actionable items',
    },
  },
  {
    id: 'specify-format',
    title: 'Specify Format',
    description: 'Tell the agent how to structure responses.',
    example: {
      bad: 'Write a report',
      good: 'Write a report with: Executive Summary, Analysis, Recommendations, Appendix',
    },
  },
  {
    id: 'set-tone',
    title: 'Set Tone',
    description: 'Define the communication style appropriate for your use case.',
    example: {
      bad: '',
      good: 'Use a professional, friendly tone. Avoid jargon. Explain technical terms when used.',
    },
  },
  {
    id: 'iterate',
    title: 'Iterate and Improve',
    description: 'Prompt engineering is iterative. Test and refine based on results.',
    example: {
      bad: '',
      good: 'Review outputs regularly. Update prompts to address gaps or improve clarity.',
    },
  },
];

// ============================================================================
// Prompt Quality Score Labels
// ============================================================================

export function getScoreLabel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      label: 'Excellent',
      color: 'var(--status-success)',
      description: 'Your prompt is well-crafted and should produce excellent results.',
    };
  } else if (score >= 75) {
    return {
      label: 'Good',
      color: 'var(--status-info)',
      description: 'Your prompt is good but could benefit from minor improvements.',
    };
  } else if (score >= 50) {
    return {
      label: 'Fair',
      color: 'var(--status-warning)',
      description: 'Your prompt needs improvement to be effective.',
    };
  } else {
    return {
      label: 'Needs Work',
      color: 'var(--status-error)',
      description: 'Your prompt requires significant improvements.',
    };
  }
}

// ============================================================================
// Placeholder Detection and Replacement
// ============================================================================

/**
 * Find placeholders in a prompt
 */
export function findPlaceholders(prompt: string): string[] {
  const patterns = [
    /\[([^\]]+)\]/g, // [placeholder]
    /\{\{([^}]+)\}\}/g, // {{placeholder}}
    /<([^>]+)>/g, // <placeholder>
  ];

  const placeholders = new Set<string>();

  patterns.forEach(pattern => {
    const matches = prompt.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const clean = match.replace(/[\[\]{}<>]/g, '');
        placeholders.add(clean);
      });
    }
  });

  return Array.from(placeholders);
}

/**
 * Replace placeholders in a prompt
 */
export function replacePlaceholders(
  prompt: string,
  replacements: Record<string, string>
): string {
  let result = prompt;

  Object.entries(replacements).forEach(([key, value]) => {
    // Replace [key], {{key}}, and <key> variants
    result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    result = result.replace(new RegExp(`<${key}>`, 'g'), value);
  });

  return result;
}

/**
 * Check if prompt has unfilled placeholders
 */
export function hasUnfilledPlaceholders(prompt: string): boolean {
  const placeholders = findPlaceholders(prompt);
  return placeholders.length > 0;
}
