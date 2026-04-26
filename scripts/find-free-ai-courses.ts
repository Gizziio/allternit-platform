#!/usr/bin/env tsx
/**
 * Find free AI courses on Udemy matching A://Labs categories
 */

import axios from 'axios';

// A://Labs Subject Categories for Course Matching
const A2LABS_CATEGORIES = [
  { id: 'core-reasoning', tier: 'CORE', label: 'AI Reasoning & Prompt Engineering', searchQueries: ['prompt engineering', 'AI reasoning', 'chain of thought', 'structured output AI', 'LLM prompting'] },
  { id: 'core-multimodal', tier: 'CORE', label: 'Multimodal AI Workflows', searchQueries: ['multimodal AI', 'computer vision AI', 'document processing AI', 'image analysis AI', 'OCR AI'] },
  { id: 'core-evaluation', tier: 'CORE', label: 'AI Evaluation & Trust', searchQueries: ['AI evaluation', 'AI testing', 'LLM evaluation', 'AI safety', 'AI trust'] },
  { id: 'ops-workflows', tier: 'OPS', label: 'AI Workflow Design', searchQueries: ['AI workflow automation', 'AI automation', 'business process automation AI', 'AI productivity', 'Zapier AI'] },
  { id: 'ops-research', tier: 'OPS', label: 'Research Operations', searchQueries: ['AI research', 'research automation AI', 'web scraping AI', 'data extraction AI'] },
  { id: 'ops-content', tier: 'OPS', label: 'Content Operations', searchQueries: ['AI content generation', 'AI writing', 'content automation', 'AI copywriting'] },
  { id: 'ops-knowledge', tier: 'OPS', label: 'Knowledge Management', searchQueries: ['knowledge management AI', 'enterprise search AI', 'document management AI', 'notion AI'] },
  { id: 'agents-tools', tier: 'AGENTS', label: 'Tool-Using AI Systems', searchQueries: ['AI function calling', 'tool use AI', 'LangChain tools', 'AI agents tools'] },
  { id: 'agents-rag', tier: 'AGENTS', label: 'RAG & Document Intelligence', searchQueries: ['RAG AI', 'retrieval augmented generation', 'vector database', 'LangChain RAG', 'semantic search AI', 'Pinecone', 'Chroma DB'] },
  { id: 'agents-orchestration', tier: 'AGENTS', label: 'Multi-Agent Orchestration', searchQueries: ['multi-agent AI', 'AI orchestration', 'LangGraph', 'CrewAI', 'AI agent collaboration', 'AutoGen'] },
  { id: 'agents-web', tier: 'AGENTS', label: 'Web Research Agent', searchQueries: ['web scraping Python', 'web automation AI', 'AI web research', 'scraping API'] },
  { id: 'agents-ops', tier: 'AGENTS', label: 'Incident Triage & DevOps AI', searchQueries: ['AI monitoring', 'log analysis AI', 'incident management AI', 'DevOps AI'] },
  { id: 'agents-sales', tier: 'AGENTS', label: 'Sales & CRM AI', searchQueries: ['AI sales automation', 'CRM AI', 'lead generation AI', 'HubSpot AI'] },
  { id: 'agents-code', tier: 'AGENTS', label: 'AI Copilot & Code Generation', searchQueries: ['AI coding assistant', 'code generation AI', 'GitHub Copilot', 'automated code review'] },
  { id: 'agents-kb', tier: 'AGENTS', label: 'Knowledge Base Assistant', searchQueries: ['chatbot knowledge base', 'enterprise chatbot AI', 'RAG chatbot', 'document Q&A AI'] },
  { id: 'agents-edu', tier: 'AGENTS', label: 'Lesson Generation & EdTech AI', searchQueries: ['AI course creation', 'AI lesson planning', 'AI education', 'AI tutoring', 'Canvas LMS'] },
];

interface UdemyCourse {
  id: number;
  title: string;
  headline: string;
  url: string;
  image_240x135: string;
  rating: number;
  num_reviews: number;
  num_subscribers: number;
  price: string;
  is_paid: boolean;
  level: string;
  lang: string;
  num_published_lectures: number;
  published_title: string;
}

async function searchUdemy(query: string, pageSize: number = 20): Promise<UdemyCourse[]> {
  const params = new URLSearchParams({
    search: query,
    page: '1',
    page_size: pageSize.toString(),
    ratings: '4.0,4.5,5.0',
    price: 'price-free',
    ordering: 'highest-rated',
  });

  const response = await axios.get(
    `https://www.udemy.com/api-2.0/courses/?${params.toString()}`,
    {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    }
  );

  return response.data?.results || [];
}

async function main() {
  console.log('🔍 Searching Udemy for free AI courses matching A://Labs categories...\n');

  const allCourses: Map<number, UdemyCourse & { matchedCategories: string[] }> = new Map();

  for (const category of A2LABS_CATEGORIES) {
    console.log(`Searching: ${category.label}...`);

    for (const query of category.searchQueries.slice(0, 2)) {
      try {
        const courses = await searchUdemy(query, 10);
        console.log(`  "${query}": ${courses.length} results`);

        for (const course of courses) {
          if (!allCourses.has(course.id)) {
            allCourses.set(course.id, { ...course, matchedCategories: [] });
          }
          const existing = allCourses.get(course.id)!;
          if (!existing.matchedCategories.includes(category.label)) {
            existing.matchedCategories.push(category.label);
          }
        }
      } catch (error: any) {
        console.error(`  Error searching "${query}": ${error.message}`);
      }

      // Be nice to the API
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const sortedCourses = Array.from(allCourses.values()).sort(
    (a, b) => (b.rating * b.num_reviews) - (a.rating * a.num_reviews)
  );

  console.log(`\n✅ Found ${sortedCourses.length} unique free AI courses\n`);

  // Group by category
  const byCategory: Record<string, typeof sortedCourses> = {};
  for (const course of sortedCourses) {
    for (const cat of course.matchedCategories) {
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(course);
    }
  }

  for (const [category, courses] of Object.entries(byCategory)) {
    console.log(`\n📚 ${category} (${courses.length} courses)`);
    console.log('─'.repeat(60));
    courses.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title}`);
      console.log(`     ID: ${c.id} | Rating: ${c.rating}⭐ (${c.num_reviews} reviews) | Lectures: ${c.num_published_lectures}`);
      console.log(`     URL: https://www.udemy.com${c.url}`);
    });
  }

  // Save full results
  const fs = await import('fs');
  const output = {
    total: sortedCourses.length,
    courses: sortedCourses.map(c => ({
      id: c.id,
      title: c.title,
      headline: c.headline,
      url: `https://www.udemy.com${c.url}`,
      rating: c.rating,
      num_reviews: c.num_reviews,
      num_lectures: c.num_published_lectures,
      level: c.level,
      categories: c.matchedCategories,
    })),
  };

  fs.writeFileSync('/tmp/free-ai-courses.json', JSON.stringify(output, null, 2));
  console.log(`\n💾 Full results saved to /tmp/free-ai-courses.json`);
}

main().catch(console.error);
