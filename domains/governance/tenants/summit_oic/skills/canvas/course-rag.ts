/**
 * Course RAG System
 * 
 * Provides semantic search and Q&A over course content.
 * Uses vector embeddings for intelligent retrieval.
 * 
 * @module summit.canvas.course_rag
 */

import { CanvasConnector } from './canvas-connector';
import { TeacherProfile } from './teacher_intake';

// ============================================================================
// Types
// ============================================================================

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'module' | 'assignment' | 'page' | 'discussion';
    courseId: string;
    url: string;
    createdAt: string;
    teacherId?: string;
  };
}

export interface CourseIndex {
  courseId: string;
  documents: VectorDocument[];
  indexedAt: string;
  documentCount: number;
}

export interface QAResponse {
  answer: string;
  sources: VectorDocument[];
  confidence: number;
  teacherVoice: boolean;
  followUpQuestions?: string[];
}

export interface SearchQuery {
  query: string;
  courseId?: string;
  types?: ('module' | 'assignment' | 'page' | 'discussion')[];
  limit?: number;
}

// ============================================================================
// Simple Embedding Function (no external API needed)
// ============================================================================

class SimpleEmbedding {
  /**
   * Generate simple embedding for text
   * Uses TF-IDF-like approach for demonstration
   * In production, use actual embeddings (OpenAI, Cohere, etc.)
   */
  static embed(text: string, dimensions: number = 128): number[] {
    const embedding = new Array(dimensions).fill(0);
    
    // Simple hash-based embedding
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.hashWord(word);
      
      for (let j = 0; j < dimensions; j++) {
        embedding[j] += Math.sin(hash + j) * (1 / (i + 1));
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  static similarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magA * magB);
  }
  
  private static hashWord(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

// ============================================================================
// Course RAG System
// ============================================================================

export class CourseRAGSystem {
  private canvasConnector: CanvasConnector;
  private indices: Map<string, CourseIndex> = new Map();
  private teacherProfile?: TeacherProfile;

  constructor(canvasConnector: CanvasConnector, teacherProfile?: TeacherProfile) {
    this.canvasConnector = canvasConnector;
    this.teacherProfile = teacherProfile;
  }

  /**
   * Index course content
   */
  async indexCourse(courseId: string): Promise<CourseIndex> {
    const index: CourseIndex = {
      courseId,
      documents: [],
      indexedAt: new Date().toISOString(),
      documentCount: 0,
    };

    try {
      // Get modules
      const modules = await this.canvasConnector.listModules(courseId);
      
      for (const module of modules) {
        const doc: VectorDocument = {
          id: `module_${module.id}`,
          content: `${module.name}\n${module.position}`,
          embedding: SimpleEmbedding.embed(`${module.name} module week ${module.position}`),
          metadata: {
            type: 'module',
            courseId,
            url: `${this.canvasConnector.getBaseUrl()}/courses/${courseId}/modules/${module.id}`,
            createdAt: new Date().toISOString(),
          },
        };
        index.documents.push(doc);
      }

      // Get assignments (would need to be implemented in connector)
      // For now, simplified
      const assignments = await this.getAssignments(courseId);
      
      for (const assignment of assignments) {
        const doc: VectorDocument = {
          id: `assignment_${assignment.id}`,
          content: `${assignment.name}\n${assignment.description || ''}\nPoints: ${assignment.points_possible}`,
          embedding: SimpleEmbedding.embed(`${assignment.name} assignment ${assignment.description || ''}`),
          metadata: {
            type: 'assignment',
            courseId,
            url: `${this.canvasConnector.getBaseUrl()}/courses/${courseId}/assignments/${assignment.id}`,
            createdAt: assignment.due_at || new Date().toISOString(),
          },
        };
        index.documents.push(doc);
      }

      index.documentCount = index.documents.length;
      this.indices.set(courseId, index);

      return index;
    } catch (error: any) {
      console.error('[CourseRAG] Indexing error:', error);
      throw error;
    }
  }

  /**
   * Search course content
   */
  async search(query: SearchQuery): Promise<VectorDocument[]> {
    const { query: queryString, courseId, types, limit = 10 } = query;

    // Get query embedding
    const queryEmbedding = SimpleEmbedding.embed(queryString);

    // Search relevant indices
    let results: VectorDocument[] = [];

    if (courseId) {
      // Search specific course
      const index = this.indices.get(courseId);
      if (index) {
        results = this.searchIndex(index, queryEmbedding, types, limit);
      }
    } else {
      // Search all indices
      for (const index of this.indices.values()) {
        const courseResults = this.searchIndex(index, queryEmbedding, types, limit);
        results = [...results, ...courseResults];
      }
      results.sort((a, b) => {
        const simA = SimpleEmbedding.similarity(queryEmbedding, a.embedding);
        const simB = SimpleEmbedding.similarity(queryEmbedding, b.embedding);
        return simB - simA;
      });
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Answer question about course
   */
  async answerQuestion(question: string, courseId?: string): Promise<QAResponse> {
    // Search for relevant content
    const results = await this.search({
      query: question,
      courseId,
      limit: 5,
    });

    if (results.length === 0) {
      return {
        answer: "I couldn't find information about that in the course materials.",
        sources: [],
        confidence: 0,
        teacherVoice: false,
      };
    }

    // Generate answer from results
    const answer = this.generateAnswer(question, results);

    // Apply teacher voice if profile available
    const teacherVoiceAnswer = this.teacherProfile 
      ? this.applyTeacherVoice(answer, this.teacherProfile)
      : answer;

    return {
      answer: teacherVoiceAnswer,
      sources: results.slice(0, 3),
      confidence: SimpleEmbedding.similarity(
        SimpleEmbedding.embed(question),
        results[0].embedding
      ),
      teacherVoice: !!this.teacherProfile,
      followUpQuestions: this.generateFollowUpQuestions(question, results),
    };
  }

  /**
   * Search within an index
   */
  private searchIndex(
    index: CourseIndex,
    queryEmbedding: number[],
    types?: ('module' | 'assignment' | 'page' | 'discussion')[],
    limit?: number
  ): VectorDocument[] {
    let documents = index.documents;

    // Filter by type
    if (types && types.length > 0) {
      documents = documents.filter(doc => types.includes(doc.metadata.type));
    }

    // Calculate similarities
    const scored = documents.map(doc => ({
      doc,
      similarity: SimpleEmbedding.similarity(queryEmbedding, doc.embedding),
    }));

    // Sort by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return top results
    return scored.slice(0, limit).map(s => s.doc);
  }

  /**
   * Generate answer from search results
   */
  private generateAnswer(question: string, results: VectorDocument[]): string {
    if (results.length === 0) {
      return "I couldn't find information about that.";
    }

    // Simple answer generation (in production, use LLM)
    const topResult = results[0];
    const type = topResult.metadata.type;

    let answer = `Based on the course ${type}: "${topResult.content.split('\n')[0]}"\n\n`;

    if (type === 'assignment') {
      answer += `This assignment is part of the course. `;
      if (topResult.metadata.createdAt) {
        answer += `Due date information is available.\n`;
      }
    } else if (type === 'module') {
      answer += `This module covers course content. `;
    }

    if (results.length > 1) {
      answer += `\nRelated content found: ${results.length - 1} more ${results.length === 2 ? 'item' : 'items'}.`;
    }

    return answer;
  }

  /**
   * Apply teacher's communication style
   */
  private applyTeacherVoice(answer: string, profile: TeacherProfile): string {
    const tone = profile.preferences.communication.tone.toLowerCase();

    // Add teacher's tone markers
    const prefixes: Record<string, string> = {
      'encouraging': "Great question! ",
      'formal': "Regarding your inquiry: ",
      'casual': "Hey! ",
      'friendly': "Hi there! ",
      'direct': "",
    };

    const suffixes: Record<string, string> = {
      'encouraging': " You've got this! 💪",
      'formal': "",
      'casual': " Hope that helps!",
      'friendly': " Let me know if you need anything else! 😊",
      'direct': "",
    };

    const prefix = prefixes[tone] || '';
    const suffix = suffixes[tone] || '';

    return `${prefix}${answer}${suffix}`;
  }

  /**
   * Generate follow-up questions
   */
  private generateFollowUpQuestions(question: string, results: VectorDocument[]): string[] {
    const followUps: string[] = [];

    if (results.some(r => r.metadata.type === 'assignment')) {
      followUps.push("What are the submission requirements?");
      followUps.push("Is there a rubric for this?");
    }

    if (results.some(r => r.metadata.type === 'module')) {
      followUps.push("What assignments are in this module?");
      followUps.push("Are there any readings for this module?");
    }

    return followUps.slice(0, 3);
  }

  /**
   * Get assignments (simplified - would use Canvas API in production)
   */
  private async getAssignments(courseId: string): Promise<any[]> {
    // In production, use Canvas API: GET /api/v1/courses/{course_id}/assignments
    // For now, return empty array
    return [];
  }

  /**
   * Get indexed courses
   */
  getIndexedCourses(): string[] {
    return Array.from(this.indices.keys());
  }

  /**
   * Clear index for course
   */
  clearIndex(courseId: string): void {
    this.indices.delete(courseId);
  }

  /**
   * Get index stats
   */
  getIndexStats(courseId?: string): { totalDocuments: number; courses: number } {
    if (courseId) {
      const index = this.indices.get(courseId);
      return {
        totalDocuments: index?.documentCount || 0,
        courses: index ? 1 : 0,
      };
    }

    let total = 0;
    for (const index of this.indices.values()) {
      total += index.documentCount;
    }

    return {
      totalDocuments: total,
      courses: this.indices.size,
    };
  }
}

/**
 * Factory function to create RAG system
 */
export function createCourseRAGSystem(
  canvasConnector: CanvasConnector,
  teacherProfile?: TeacherProfile
): CourseRAGSystem {
  return new CourseRAGSystem(canvasConnector, teacherProfile);
}
