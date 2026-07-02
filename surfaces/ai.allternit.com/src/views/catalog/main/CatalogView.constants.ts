import type { A2LabsCategory } from "./CatalogView.types";

export const A2LABS_CATEGORIES: A2LabsCategory[] = [
  {
    id: 'core-reasoning',
    tier: 'CORE',
    label: 'AI Reasoning & Prompt Engineering',
    description: 'Structured reasoning, prompt engineering, decomposition',
    searchQueries: ['prompt engineering', 'AI reasoning', 'chain of thought', 'LLM prompting'],
  },
  {
    id: 'core-multimodal',
    tier: 'CORE',
    label: 'Multimodal AI Workflows',
    description: 'Processing text/images/PDFs, document intelligence',
    searchQueries: ['multimodal AI', 'computer vision AI', 'document processing AI', 'OCR AI'],
  },
  {
    id: 'core-evaluation',
    tier: 'CORE',
    label: 'AI Evaluation & Trust',
    description: 'Evaluation criteria, trust boundaries, quality assessment',
    searchQueries: ['AI evaluation', 'LLM evaluation', 'AI safety', 'AI trust'],
  },
  {
    id: 'ops-workflows',
    tier: 'OPS',
    label: 'AI Workflow Design',
    description: 'Process mapping, automation, AI-augmented workflows',
    searchQueries: ['AI workflow automation', 'AI automation', 'AI productivity'],
  },
  {
    id: 'ops-research',
    tier: 'OPS',
    label: 'Research Operations',
    description: 'AI-assisted research workflows',
    searchQueries: ['AI research', 'research automation AI', 'web scraping AI'],
  },
  {
    id: 'ops-content',
    tier: 'OPS',
    label: 'Content Operations',
    description: 'Content generation, content pipeline automation',
    searchQueries: ['AI content generation', 'AI writing', 'content automation'],
  },
  {
    id: 'ops-knowledge',
    tier: 'OPS',
    label: 'Knowledge Management',
    description: 'Knowledge base design, information organization',
    searchQueries: ['knowledge management AI', 'enterprise search AI', 'document management AI'],
  },
  {
    id: 'agents-rag',
    tier: 'AGENTS',
    label: 'RAG & Document Intelligence',
    description: 'RAG systems, vector databases, semantic search',
    searchQueries: ['RAG AI', 'retrieval augmented generation', 'vector database', 'LangChain RAG'],
  },
  {
    id: 'agents-orchestration',
    tier: 'AGENTS',
    label: 'Multi-Agent Orchestration',
    description: 'Agent orchestration, collaboration, LangGraph, CrewAI',
    searchQueries: ['multi-agent AI', 'LangGraph', 'CrewAI', 'AI agent collaboration'],
  },
  {
    id: 'agents-code',
    tier: 'AGENTS',
    label: 'AI Copilot & Code Generation',
    description: 'Repo-aware coding assistants, code suggestion',
    searchQueries: ['AI coding assistant', 'code generation AI', 'automated code review'],
  },
  {
    id: 'agents-web',
    tier: 'AGENTS',
    label: 'Web Research Agent',
    description: 'Web search automation, content extraction',
    searchQueries: ['web scraping Python', 'web automation AI', 'AI web research'],
  },
  {
    id: 'agents-kb',
    tier: 'AGENTS',
    label: 'Knowledge Base Assistant',
    description: 'Multi-source ingestion, unified search, document Q&A',
    searchQueries: ['chatbot knowledge base', 'RAG chatbot', 'document Q&A AI'],
  },
];

export const CURATED_KEY = 'allternit-labs-curated-courses';
