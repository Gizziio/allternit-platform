/**
 * Udemy Public Search API Client
 * 
 * Searches Udemy's public catalog (no authentication required)
 * for free courses matching A://Labs subject areas.
 * 
 * Uses the affiliate/public API endpoints that don't require auth.
 */

import axios, { AxiosInstance } from 'axios';

export interface UdemyPublicCourse {
  id: number;
  title: string;
  headline: string;
  description?: string;
  url: string;
  image_240x135: string;
  image_480x270?: string;
  published_title: string;
  num_subscribers: number;
  num_reviews: number;
  rating: number;
  price: string;
  is_paid: boolean;
  level: 'Beginner' | 'Intermediate' | 'Expert' | 'All Levels';
  lang: string;
  num_lectures: number;
  instructional_level: string;
  category?: string;
  topics?: string[];
}

export interface SearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UdemyPublicCourse[];
}

export interface A2LabsCategory {
  id: string;
  tier: 'CORE' | 'OPS' | 'AGENTS';
  label: string;
  description: string;
  searchQueries: string[];
  prerequisites?: string[];
}

// A://Labs Subject Categories for Course Matching
export const A2LABS_CATEGORIES: A2LabsCategory[] = [
  // TIER 1: CORE (Foundations)
  {
    id: 'core-reasoning',
    tier: 'CORE',
    label: 'AI Reasoning & Prompt Engineering',
    description: 'Structured reasoning with AI, prompt engineering, decomposition, hallucination detection',
    searchQueries: [
      'prompt engineering',
      'AI reasoning',
      'chain of thought',
      'structured output AI',
      'LLM prompting',
    ],
  },
  {
    id: 'core-multimodal',
    tier: 'CORE',
    label: 'Multimodal AI Workflows',
    description: 'Processing text/images/PDFs, document intelligence, visual analysis',
    searchQueries: [
      'multimodal AI',
      'computer vision AI',
      'document processing AI',
      'image analysis AI',
      'OCR AI',
    ],
  },
  {
    id: 'core-evaluation',
    tier: 'CORE',
    label: 'AI Evaluation & Trust',
    description: 'Evaluation criteria, trust boundaries, quality assessment, hallucination detection',
    searchQueries: [
      'AI evaluation',
      'AI testing',
      'LLM evaluation',
      'AI safety',
      'AI trust',
    ],
  },

  // TIER 2: OPS (Operations)
  {
    id: 'ops-workflows',
    tier: 'OPS',
    label: 'AI Workflow Design',
    description: 'Process mapping, automation, AI-augmented workflows, productivity',
    searchQueries: [
      'AI workflow automation',
      'AI automation',
      'business process automation AI',
      'AI productivity',
      'Zapier AI',
    ],
  },
  {
    id: 'ops-research',
    tier: 'OPS',
    label: 'Research Operations',
    description: 'AI-assisted research workflows, research automation',
    searchQueries: [
      'AI research',
      'research automation AI',
      'web scraping AI',
      'data extraction AI',
    ],
  },
  {
    id: 'ops-content',
    tier: 'OPS',
    label: 'Content Operations',
    description: 'Content generation, content pipeline automation, AI writing',
    searchQueries: [
      'AI content generation',
      'AI writing',
      'content automation',
      'AI copywriting',
    ],
  },
  {
    id: 'ops-knowledge',
    tier: 'OPS',
    label: 'Knowledge Management',
    description: 'Knowledge base design, information organization, SOP management',
    searchQueries: [
      'knowledge management AI',
      'enterprise search AI',
      'document management AI',
      'notion AI',
    ],
  },

  // TIER 3: AGENTS (Advanced/Build)
  {
    id: 'agents-tools',
    tier: 'AGENTS',
    label: 'Tool-Using AI Systems',
    description: 'API invocation, function calling, structured outputs, tool safety',
    searchQueries: [
      'AI function calling',
      'tool use AI',
      'LangChain tools',
      'AI agents tools',
    ],
  },
  {
    id: 'agents-rag',
    tier: 'AGENTS',
    label: 'RAG & Document Intelligence',
    description: 'RAG systems, vector databases, embeddings, semantic search, document Q&A',
    searchQueries: [
      'RAG AI',
      'retrieval augmented generation',
      'vector database',
      'LangChain RAG',
      'semantic search AI',
      'Pinecone',
      'Chroma DB',
    ],
  },
  {
    id: 'agents-orchestration',
    tier: 'AGENTS',
    label: 'Multi-Agent Orchestration',
    description: 'Agent orchestration, routing, collaboration, LangGraph, CrewAI',
    searchQueries: [
      'multi-agent AI',
      'AI orchestration',
      'LangGraph',
      'CrewAI',
      'AI agent collaboration',
      'AutoGen',
    ],
  },
  {
    id: 'agents-web',
    tier: 'AGENTS',
    label: 'Web Research Agent',
    description: 'Web search automation, content extraction, research synthesis',
    searchQueries: [
      'web scraping Python',
      'web automation AI',
      'AI web research',
      'scraping API',
    ],
  },
  {
    id: 'agents-ops',
    tier: 'AGENTS',
    label: 'Incident Triage & DevOps AI',
    description: 'Log analysis, incident response, alert management, SRE AI',
    searchQueries: [
      'AI monitoring',
      'log analysis AI',
      'incident management AI',
      'DevOps AI',
    ],
  },
  {
    id: 'agents-sales',
    tier: 'AGENTS',
    label: 'Sales & CRM AI',
    description: 'Lead qualification, CRM integration, sales automation',
    searchQueries: [
      'AI sales automation',
      'CRM AI',
      'lead generation AI',
      'HubSpot AI',
    ],
  },
  {
    id: 'agents-code',
    tier: 'AGENTS',
    label: 'AI Copilot & Code Generation',
    description: 'Repo-aware coding assistants, code suggestion, automated code review',
    searchQueries: [
      'AI coding assistant',
      'code generation AI',
      'GitHub Copilot',
      'automated code review',
    ],
  },
  {
    id: 'agents-kb',
    tier: 'AGENTS',
    label: 'Knowledge Base Assistant',
    description: 'Multi-source ingestion, unified search, SOP lookup, decision retrieval',
    searchQueries: [
      'chatbot knowledge base',
      'enterprise chatbot AI',
      'RAG chatbot',
      'document Q&A AI',
    ],
  },
  {
    id: 'agents-edu',
    tier: 'AGENTS',
    label: 'Lesson Generation & EdTech AI',
    description: 'Automated curriculum, lesson generation, assessment generation',
    searchQueries: [
      'AI education',
      'AI curriculum',
      'lesson generation AI',
      'EdTech AI',
    ],
  },
  {
    id: 'agents-media',
    tier: 'AGENTS',
    label: 'Content Repurposing Pipeline',
    description: 'Transcription, multi-format content generation, channel optimization',
    searchQueries: [
      'AI content repurposing',
      'transcription AI',
      'content generation pipeline',
      'video to text AI',
    ],
  },
  {
    id: 'agents-comply',
    tier: 'AGENTS',
    label: 'Policy & Compliance AI',
    description: 'Policy indexing, compliance Q&A, conflict detection, audit trails',
    searchQueries: [
      'AI compliance',
      'policy management AI',
      'regulatory AI',
      'audit automation',
    ],
  },
  {
    id: 'agents-multi',
    tier: 'AGENTS',
    label: 'Router-Based Multi-Agent Systems',
    description: 'Agent registry, request routing, orchestration, agent handoffs',
    searchQueries: [
      'multi-agent system',
      'AI routing',
      'agent orchestration platform',
      'AI agent framework',
    ],
  },
];

// Technology keywords that indicate a course is relevant
const TECH_KEYWORDS = [
  'python', 'javascript', 'typescript', 'node.js', 'react',
  'langchain', 'openai', 'gpt', 'llm', 'transformer',
  'api', 'rest', 'webhook', 'automation',
  'machine learning', 'deep learning', 'neural network',
  'chatgpt', 'claude', 'gemini', 'ollama',
];

class UdemyPublicSearch {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.udemy.com',
      timeout: 30000,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
  }

  /**
   * Search Udemy's public catalog
   */
  async search(
    query: string,
    options: {
      page?: number;
      pageSize?: number;
      price?: 'free' | 'paid' | 'all';
      level?: string;
      language?: string;
      category?: string;
    } = {}
  ): Promise<SearchResponse> {
    const {
      page = 1,
      pageSize = 20,
      price = 'free',
      level,
      language = 'en',
    } = options;

    const params: Record<string, any> = {
      'page': page,
      'page_size': pageSize,
      'search': query,
      'ratings': '4.0,4.5,5.0', // Only highly-rated courses
    };

    if (price === 'free') {
      params['price'] = 'price-free';
    } else if (price === 'paid') {
      params['price'] = 'price-paid';
    }

    if (level) {
      params['instructional_level'] = level;
    }

    if (language) {
      params['closed_captions'] = language;
    }

    try {
      const response = await this.client.get<SearchResponse>(
        '/api-2.0/courses/',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error(`Search failed for "${query}":`, error);
      return { count: 0, next: null, previous: null, results: [] };
    }
  }

  /**
   * Search across all A://Labs categories
   */
  async searchAllCategories(
    options: {
      price?: 'free' | 'paid' | 'all';
      onProgress?: (category: string, count: number) => void;
    } = {}
  ): Promise<Map<string, UdemyPublicCourse[]>> {
    const { price = 'free', onProgress } = options;
    const results = new Map<string, UdemyPublicCourse[]>();

    for (const category of A2LABS_CATEGORIES) {
      const allCourses: UdemyPublicCourse[] = [];
      const seen = new Set<number>();

      for (const query of category.searchQueries) {
        try {
          const response = await this.search(query, { price, page: 1, pageSize: 20 });

          for (const course of response.results) {
            if (!seen.has(course.id)) {
              seen.add(course.id);
              allCourses.push({
                ...course,
                category: category.label,
                topics: this.extractTopics(course),
              });
            }
          }

          onProgress?.(category.label, response.results.length);
        } catch (error) {
          console.error(`Failed to search "${query}":`, error);
        }

        // Rate limiting - be respectful
        await this.sleep(500);
      }

      // Sort by rating and subscribers
      allCourses.sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
        return (b.num_subscribers || 0) - (a.num_subscribers || 0);
      });

      results.set(category.id, allCourses);
    }

    return results;
  }

  /**
   * Search for courses matching a specific A://Labs category
   */
  async searchByCategory(
    categoryId: string,
    options: { price?: 'free' | 'paid' | 'all'; page?: number } = {}
  ): Promise<UdemyPublicCourse[]> {
    const category = A2LABS_CATEGORIES.find(c => c.id === categoryId);
    if (!category) {
      throw new Error(`Unknown category: ${categoryId}`);
    }

    const { price = 'free', page = 1 } = options;
    const allCourses: UdemyPublicCourse[] = [];
    const seen = new Set<number>();

    for (const query of category.searchQueries) {
      try {
        const response = await this.search(query, { price, page, pageSize: 20 });

        for (const course of response.results) {
          if (!seen.has(course.id)) {
            seen.add(course.id);
            allCourses.push({
              ...course,
              category: category.label,
              topics: this.extractTopics(course),
            });
          }
        }
      } catch (error) {
        console.error(`Failed to search "${query}":`, error);
      }

      await this.sleep(500);
    }

    allCourses.sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
      return (b.num_subscribers || 0) - (a.num_subscribers || 0);
    });

    return allCourses;
  }

  /**
   * Extract relevant topics from course data
   */
  private extractTopics(course: UdemyPublicCourse): string[] {
    const topics: string[] = [];
    const text = `${course.title} ${course.headline} ${course.description || ''}`.toLowerCase();

    for (const keyword of TECH_KEYWORDS) {
      if (text.includes(keyword)) {
        topics.push(keyword);
      }
    }

    return [...new Set(topics)];
  }

  /**
   * Check if a course is free
   */
  static isFree(course: UdemyPublicCourse): boolean {
    return !course.is_paid || course.price === 'Free' || course.price === 'free';
  }

  /**
   * Get course level badge color
   */
  static getLevelColor(level: string): string {
    switch (level) {
      case 'Beginner':
      case 'All Levels':
        return '#22c55e';
      case 'Intermediate':
        return '#f59e0b';
      case 'Expert':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  /**
   * Format subscriber count
   */
  static formatSubscribers(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default UdemyPublicSearch;
