/**
 * Prompt Templates for LLM Insight Generation
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Templates for generating insights using LLM.
 * Coordinate with T3-A2 for 6Rs pipeline integration.
 */

import type { InsightRequest } from '../types.js';

/**
 * System prompt for insight generation
 */
export const INSIGHT_SYSTEM_PROMPT = `You are an expert knowledge analyst for Ars Contexta, a "second brain" knowledge system.

Your role is to analyze content and extract meaningful insights that help build a personal knowledge graph.

When analyzing content:
1. Identify patterns and recurring themes
2. Note contradictions or conflicting information
3. Highlight knowledge gaps that need exploration
4. Suggest opportunities for connections
5. Connect to broader concepts when relevant

Output insights in a structured format. Be concise but thorough.
Confidence scores (0.0-1.0) should reflect your certainty about each insight.`;

/**
 * Generate insight extraction prompt
 */
export function generateInsightPrompt(request: InsightRequest): string {
  const { content, context = [], focusAreas = [], maxInsights = 5, minConfidence = 0.5 } = request;
  
  let prompt = `Analyze the following content and generate up to ${maxInsights} insights.

CONTENT TO ANALYZE:
---
${content}
---
`;

  if (context.length > 0) {
    prompt += `
RELATED CONTEXT:
${context.map((c, i) => `${i + 1}. ${c.slice(0, 200)}${c.length > 200 ? '...' : ''}`).join('\n')}
`;
  }

  if (focusAreas.length > 0) {
    prompt += `
FOCUS AREAS (prioritize these):
${focusAreas.map(area => `- ${area}`).join('\n')}
`;
  }

  prompt += `
RESPONSE FORMAT (JSON):
{
  "insights": [
    {
      "type": "pattern|contradiction|gap|opportunity",
      "description": "Clear, actionable insight",
      "confidence": 0.85,
      "relatedConcepts": ["concept1", "concept2"]
    }
  ],
  "summary": "2-3 sentence overview",
  "keyThemes": ["theme1", "theme2"],
  "suggestedLinks": ["related topic 1", "related topic 2"]
}

Requirements:
- Only include insights with confidence >= ${minConfidence}
- Maximum ${maxInsights} insights
- Insights should be specific and actionable
- Note any contradictions explicitly
- Identify knowledge gaps worth exploring
`;

  return prompt;
}

/**
 * Entity extraction prompt template
 * Coordinates with GAP-79 NLP entity extraction
 */
export function generateEntityExtractionPrompt(content: string, entityTypes: string[]): string {
  return `Extract entities from the following content.

CONTENT:
---
${content}
---

ENTITY TYPES TO EXTRACT: ${entityTypes.join(', ')}

RESPONSE FORMAT (JSON):
{
  "entities": [
    {
      "text": "exact text from content",
      "type": "person|organization|location|concept|product|event",
      "confidence": 0.9,
      "normalizedForm": "canonical name"
    }
  ],
  "keyPhrases": ["phrase 1", "phrase 2"],
  "summary": "brief summary"
}

Guidelines:
- Extract only high-confidence entities (confidence >= 0.7)
- Normalize entity names to canonical forms
- Include exact character positions if possible
- Note relationships between entities when obvious`;
}

/**
 * Summarization prompt template
 */
export function generateSummarizationPrompt(content: string, detailLevel: 'brief' | 'balanced' | 'comprehensive' = 'balanced'): string {
  const lengthGuide = {
    brief: '1-2 sentences',
    balanced: '3-5 sentences',
    comprehensive: '1-2 paragraphs',
  };

  return `Summarize the following content in ${lengthGuide[detailLevel]}.

CONTENT:
---
${content}
---

Requirements:
- Capture the main points and key takeaways
- Preserve important details and nuance
- Use clear, concise language
- Output only the summary, no additional commentary`;
}

/**
 * Verification prompt (against research claims)
 * Coordinates with T3-A3 claims graph
 */
export function generateVerificationPrompt(content: string, claims: string[]): string {
  return `Verify the following content against known research claims.

CONTENT TO VERIFY:
---
${content}
---

KNOWN CLAIMS TO CHECK AGAINST:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

RESPONSE FORMAT (JSON):
{
  "valid": true|false,
  "conflicts": [
    {
      "claim": "the conflicting claim",
      "reason": "why it conflicts"
    }
  ],
  "supports": [
    {
      "claim": "claim supported",
      "evidence": "supporting evidence from content"
    }
  ],
  "uncertain": [
    "claims that couldn't be verified"
  ]
}`;
}

/**
 * Note link suggestion prompt
 */
export function generateLinkSuggestionPrompt(noteContent: string, existingNotes: { id: string; title: string; content: string }[]): string {
  const existingNotesText = existingNotes
    .map(n => `NOTE ${n.id}: ${n.title}\n${n.content.slice(0, 200)}${n.content.length > 200 ? '...' : ''}`)
    .join('\n\n');

  return `Suggest links between the new note and existing notes.

NEW NOTE:
---
${noteContent}
---

EXISTING NOTES:
---
${existingNotesText}
---

RESPONSE FORMAT (JSON):
{
  "suggestedLinks": [
    {
      "targetNoteId": "id of related note",
      "linkType": "reference|related|contradicts|extends",
      "strength": 0.85,
      "reason": "why these notes are connected"
    }
  ]
}

Link types:
- reference: cites or mentions
- related: similar topic or concept
- contradicts: opposing viewpoints
- extends: builds upon or elaborates`;
}

/**
 * Predefined prompt templates registry
 */
export const PromptTemplates = {
  insightGeneration: generateInsightPrompt,
  entityExtraction: generateEntityExtractionPrompt,
  summarization: generateSummarizationPrompt,
  verification: generateVerificationPrompt,
  linkSuggestion: generateLinkSuggestionPrompt,
} as const;

export type PromptTemplateName = keyof typeof PromptTemplates;
