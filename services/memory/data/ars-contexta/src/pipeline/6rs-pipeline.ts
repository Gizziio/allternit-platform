// OWNER: T3-A2

/**
 * 6Rs Pipeline - GAP-80
 * 
 * Research, Reason, Reflect, Refine, Resolve, Respond
 */

import { LlmClient, createLlmClient, LlmClientOptions } from '../llm/client.js';

/// Research result from R1
export interface ResearchResult {
  facts: string[];
  sources: string[];
  context: string;
  related: string[];
}

/// Reasoning from R2
export interface Reasoning {
  steps: string[];
  conclusion: string;
  confidence: number;
}

/// Reflection from R3
export interface Reflection {
  implications: string[];
  edgeCases: string[];
  limitations: string[];
}

/// Refined answer from R4
export interface RefinedAnswer {
  answer: string;
  improvements: string[];
}

/// Resolution from R5
export interface Resolution {
  answer: string;
  confidence: number;
  reasoning: string;
}

/// The 6Rs Pipeline
export class SixRsPipeline {
  private llm: LlmClient;

  constructor(options: LlmClientOptions) {
    this.llm = createLlmClient(options);
  }

  /// R1: Research - Gather information
  async research(query: string): Promise<ResearchResult> {
    const prompt = `Research this topic thoroughly: ${query}
    
Provide:
1. Key facts (at least 5)
2. Sources or references
3. Context and background
4. Related concepts

Format as JSON with: facts[], sources[], context, related[]`;

    const response = await this.llm.generate(prompt);
    return this.parseResearch(response);
  }

  /// R2: Reason - Analyze and think through
  async reason(research: ResearchResult, question: string): Promise<Reasoning> {
    const prompt = `Given this research:
${JSON.stringify(research, null, 2)}

Analyze this question step by step: ${question}

Provide:
1. Step-by-step reasoning
2. Conclusion
3. Confidence level (0-1)

Format as JSON with: steps[], conclusion, confidence`;

    const response = await this.llm.generate(prompt);
    return this.parseReasoning(response);
  }

  /// R3: Reflect - Consider implications
  async reflect(reasoning: Reasoning): Promise<Reflection> {
    const prompt = `Reflect on this analysis:
${JSON.stringify(reasoning, null, 2)}

What are:
1. Implications of this conclusion
2. Edge cases to consider
3. Limitations of this reasoning

Format as JSON with: implications[], edgeCases[], limitations[]`;

    const response = await this.llm.generate(prompt);
    return this.parseReflection(response);
  }

  /// R4: Refine - Improve the answer
  async refine(reflection: Reflection, originalResearch: ResearchResult): Promise<RefinedAnswer> {
    const prompt = `Improve this answer based on reflection:

Research: ${JSON.stringify(originalResearch, null, 2)}
Reflection: ${JSON.stringify(reflection, null, 2)}

Provide:
1. Refined answer incorporating insights
2. List of improvements made

Format as JSON with: answer, improvements[]`;

    const response = await this.llm.generate(prompt);
    return this.parseRefinedAnswer(response);
  }

  /// R5: Resolve - Make a decision/conclusion
  async resolve(refined: RefinedAnswer): Promise<Resolution> {
    const prompt = `Provide final resolution:
${JSON.stringify(refined, null, 2)}

Provide:
1. Final answer
2. Confidence level (0-1)
3. Brief reasoning

Format as JSON with: answer, confidence, reasoning`;

    const response = await this.llm.generate(prompt);
    return this.parseResolution(response);
  }

  /// R6: Respond - Format output
  respond(resolution: Resolution): string {
    return resolution.answer;
  }

  /// Run full 6Rs pipeline
  async process(query: string): Promise<string> {
    const research = await this.research(query);
    const reasoning = await this.reason(research, query);
    const reflection = await this.reflect(reasoning);
    const refined = await this.refine(reflection, research);
    const resolution = await this.resolve(refined);
    return this.respond(resolution);
  }

  // Parsing helpers
  private parseResearch(response: string): ResearchResult {
    try {
      const json = JSON.parse(response);
      return {
        facts: json.facts || [],
        sources: json.sources || [],
        context: json.context || '',
        related: json.related || [],
      };
    } catch {
      return {
        facts: [response],
        sources: [],
        context: response,
        related: [],
      };
    }
  }

  private parseReasoning(response: string): Reasoning {
    try {
      const json = JSON.parse(response);
      return {
        steps: json.steps || [],
        conclusion: json.conclusion || '',
        confidence: json.confidence || 0.5,
      };
    } catch {
      return {
        steps: [response],
        conclusion: response,
        confidence: 0.5,
      };
    }
  }

  private parseReflection(response: string): Reflection {
    try {
      const json = JSON.parse(response);
      return {
        implications: json.implications || [],
        edgeCases: json.edgeCases || [],
        limitations: json.limitations || [],
      };
    } catch {
      return {
        implications: [response],
        edgeCases: [],
        limitations: [],
      };
    }
  }

  private parseRefinedAnswer(response: string): RefinedAnswer {
    try {
      const json = JSON.parse(response);
      return {
        answer: json.answer || '',
        improvements: json.improvements || [],
      };
    } catch {
      return {
        answer: response,
        improvements: [],
      };
    }
  }

  private parseResolution(response: string): Resolution {
    try {
      const json = JSON.parse(response);
      return {
        answer: json.answer || '',
        confidence: json.confidence || 0.5,
        reasoning: json.reasoning || '',
      };
    } catch {
      return {
        answer: response,
        confidence: 0.5,
        reasoning: '',
      };
    }
  }
}

/**
 * Create 6Rs pipeline
 */
export function createSixRsPipeline(options: LlmClientOptions): SixRsPipeline {
  return new SixRsPipeline(options);
}
