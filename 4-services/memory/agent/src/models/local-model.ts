/**
 * Local Model Manager - Ollama Integration
 * 
 * Handles all interactions with local Ollama models
 */

import { Ollama } from 'ollama';
import type { ChatResponse } from 'ollama';

/**
 * Model configuration
 */
export interface ModelConfig {
  name: string;
  temperature: number;
  topP: number;
  numPredict: number;
}

/**
 * Default model configurations optimized for different tasks
 * Using Qwen 3.5 distilled models for efficiency
 */
export const MODEL_PRESETS: Record<string, ModelConfig> = {
  // Fast summarization and extraction
  ingest: {
    name: 'qwen3.5:2b',
    temperature: 0.3,
    topP: 0.9,
    numPredict: 500,
  },
  // Reasoning and pattern finding
  consolidate: {
    name: 'qwen3.5:4b',
    temperature: 0.5,
    topP: 0.9,
    numPredict: 1000,
  },
  // Query synthesis
  query: {
    name: 'qwen3.5:2b',
    temperature: 0.4,
    topP: 0.9,
    numPredict: 800,
  },
  // Entity extraction (structured output)
  extract: {
    name: 'qwen3.5:2b',
    temperature: 0.2,
    topP: 0.9,
    numPredict: 400,
  },
  // Embeddings (still using specialized model)
  embed: {
    name: 'mxbai-embed-large',
    temperature: 0,
    topP: 1.0,
    numPredict: 0,
  },
};

/**
 * Local Model Manager class
 */
export class LocalModelManager {
  private ollama: Ollama;

  constructor(host: string = 'localhost', port: number = 11434) {
    this.ollama = new Ollama({ host: `http://${host}:${port}` });
  }

  /**
   * Check if Ollama is running and accessible
   */
  async isRunning(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.ollama.list();
      return response.models.map((m: { name: string }) => m.name);
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }

  /**
   * Pull a model if not already installed
   */
  async ensureModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      if (models.some(m => m.startsWith(modelName))) {
        return true;
      }

      console.log(`Pulling model: ${modelName}...`);
      await this.ollama.pull({ model: modelName });
      console.log(`Model ${modelName} pulled successfully`);
      return true;
    } catch (error) {
      console.error(`Error pulling model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Generate a response from the model
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    config?: Partial<ModelConfig>
  ): Promise<string> {
    const modelConfig = config?.name 
      ? { ...MODEL_PRESETS.ingest, ...config }
      : MODEL_PRESETS.ingest;

    try {
      const response: ChatResponse = await this.ollama.chat({
        model: modelConfig.name,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        options: {
          temperature: modelConfig.temperature,
          top_p: modelConfig.topP,
          num_predict: modelConfig.numPredict,
        },
      });

      return response.message.content;
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Model generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate with streaming (for long responses)
   */
  async *generateStream(
    prompt: string,
    systemPrompt?: string,
    config?: Partial<ModelConfig>
  ): AsyncGenerator<string> {
    const modelConfig = config?.name 
      ? { ...MODEL_PRESETS.ingest, ...config }
      : MODEL_PRESETS.ingest;

    try {
      const stream = await this.ollama.chat({
        model: modelConfig.name,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        options: {
          temperature: modelConfig.temperature,
          top_p: modelConfig.topP,
          num_predict: modelConfig.numPredict,
        },
        stream: true,
      });

      for await (const part of stream) {
        if (part.message?.content) {
          yield part.message.content;
        }
      }
    } catch (error) {
      console.error('Error streaming response:', error);
      throw new Error(`Model streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data using the model
   * Returns JSON-parseable object
   */
  async extractStructured<T>(
    prompt: string,
    schema: string,
    config?: Partial<ModelConfig>
  ): Promise<T | null> {
    const systemPrompt = `You are a data extraction assistant. 
Extract information from the input and format it as valid JSON according to this schema:
${schema}

Respond ONLY with valid JSON. No explanations, no markdown, no extra text.`;

    try {
      const response = await this.generate(prompt, systemPrompt, {
        ...config,
        temperature: 0.1, // Low temperature for consistent structured output
      });

      // Clean up response (remove markdown code blocks if present)
      const cleanedResponse = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      return JSON.parse(cleanedResponse) as T;
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return null;
    }
  }

  /**
   * Summarize text
   */
  async summarize(text: string, maxLength: number = 200): Promise<string> {
    const prompt = `Summarize the following text in ${maxLength} words or less. 
Focus on the key information and main points:

${text}`;

    return await this.generate(prompt, undefined, MODEL_PRESETS.ingest);
  }

  /**
   * Extract entities from text
   */
  async extractEntities(text: string): Promise<{ entities: string[]; topics: string[] }> {
    const schema = `{
  "entities": ["list of named entities (people, places, organizations, products, etc.)"],
  "topics": ["list of 3-5 main topics or themes"]
}`;

    const prompt = `Analyze the following text and extract named entities and main topics:

${text}

Return your analysis as JSON.`;

    const result = await this.extractStructured<{ entities: string[]; topics: string[] }>(
      prompt,
      schema,
      MODEL_PRESETS.extract
    );

    return result || { entities: [], topics: [] };
  }

  /**
   * Assess importance of content
   */
  async assessImportance(text: string): Promise<'low' | 'medium' | 'high' | 'critical'> {
    const prompt = `Assess the importance of this content on a scale of:
- low: Routine information, everyday details
- medium: Notable information, somewhat significant
- high: Important information, significant insights
- critical: Crucial information, major decisions, key learnings

Content:
${text}

Respond with ONLY one word: low, medium, high, or critical`;

    try {
      const response = await this.generate(prompt, undefined, {
        ...MODEL_PRESETS.extract,
        numPredict: 50,
      });

      const importance = response.trim().toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
      
      // Validate response
      if (['low', 'medium', 'high', 'critical'].includes(importance)) {
        return importance;
      }
      
      return 'medium'; // Default
    } catch (error) {
      console.error('Error assessing importance:', error);
      return 'medium';
    }
  }

  /**
   * Find connections between memories
   */
  async findConnections(memories: Array<{ id: string; summary: string; topics: string[] }>): Promise<
    Array<{
      memoryId1: string;
      memoryId2: string;
      relationship: string;
      strength: number;
    }>
  > {
    const schema = `{
  "connections": [
    {
      "memoryId1": "id of first memory",
      "memoryId2": "id of second memory", 
      "relationship": "description of how they relate",
      "strength": 0.0-1.0 confidence score
    }
  ]
}`;

    const memoriesText = memories
      .map(m => `- ${m.id}: ${m.summary} [Topics: ${m.topics.join(', ')}]`)
      .join('\n');

    const prompt = `Find meaningful connections between these memories:

${memoriesText}

Look for:
- Shared topics or themes
- Causal relationships
- Temporal connections
- Complementary information
- Contradictions or tensions

Return your analysis as JSON.`;

    const result = await this.extractStructured<{
      connections: Array<{
        memoryId1: string;
        memoryId2: string;
        relationship: string;
        strength: number;
      }>;
    }>(prompt, schema, MODEL_PRESETS.consolidate);

    return result?.connections || [];
  }

  /**
   * Generate insights from multiple memories
   */
  async generateInsights(
    memories: Array<{ id: string; summary: string; content: string }>
  ): Promise<Array<{ title: string; content: string; confidence: number }>> {
    const schema = `{
  "insights": [
    {
      "title": "Short descriptive title",
      "content": "The insight or pattern discovered",
      "confidence": 0.0-1.0 confidence score
    }
  ]
}`;

    const memoriesText = memories
      .map(m => `---\nMemory ${m.id}:\n${m.content}`)
      .join('\n');

    const prompt = `Analyze these memories and identify cross-cutting insights, patterns, and themes:

${memoriesText}

Look for:
- Recurring patterns
- Emerging themes
- Unexpected connections
- Higher-level abstractions
- Actionable insights

Return your analysis as JSON.`;

    const result = await this.extractStructured<{
      insights: Array<{
        title: string;
        content: string;
        confidence: number;
      }>;
    }>(prompt, schema, MODEL_PRESETS.consolidate);

    return result?.insights || [];
  }

  /**
   * Synthesize answer from memories
   */
  async synthesizeAnswer(
    query: string,
    memories: Array<{ summary: string; source: string }>
  ): Promise<{ answer: string; confidence: number }> {
    const schema = `{
  "answer": "Comprehensive answer synthesizing information from the memories",
  "confidence": 0.0-1.0 confidence score
}`;

    const memoriesText = memories
      .map((m, i) => `[${i + 1}] ${m.summary} (Source: ${m.source})`)
      .join('\n');

    const prompt = `Based on these memories, answer the following question:

Question: ${query}

Relevant Memories:
${memoriesText}

Provide a comprehensive answer that synthesizes information from the memories.
Cite sources where appropriate.
If the memories don't contain enough information to answer confidently, say so.

Return your response as JSON.`;

    const result = await this.extractStructured<{
      answer: string;
      confidence: number;
    }>(prompt, schema, MODEL_PRESETS.query);

    return result || { 
      answer: "I couldn't find enough information in memory to answer this question.", 
      confidence: 0 
    };
  }

  /**
   * Get Ollama client instance
   */
  getClient(): Ollama {
    return this.ollama;
  }
}
