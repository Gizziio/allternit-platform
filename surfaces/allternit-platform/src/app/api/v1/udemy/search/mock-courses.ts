/**
 * Mock Udemy Course Data
 * 
 * Comprehensive set of free courses matching A://Labs subject areas.
 * Used as fallback when Udemy API is unreachable.
 */

interface MockCourse {
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
  num_lectures: number;
  published_title: string;
  category?: string;
  topics?: string[];
  matchQueries?: string[];
}

const COURSE_TEMPLATES: Omit<MockCourse, 'matchQueries'>[] = [
  // ==================== CORE TIER ====================
  
  // AI Reasoning & Prompt Engineering
  {
    id: 1001,
    title: 'ChatGPT Prompt Engineering for Developers',
    headline: 'Learn to use ChatGPT effectively with prompt engineering patterns and best practices',
    url: '/course/chatgpt-prompt-engineering',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/4996660_b97c.jpg',
    rating: 4.7,
    num_reviews: 12543,
    num_subscribers: 285000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 23,
    published_title: '2024',
    category: 'AI Reasoning & Prompt Engineering',
    topics: ['chatgpt', 'openai', 'prompt engineering', 'llm'],
  },
  {
    id: 1002,
    title: 'LangChain for LLM Application Development',
    headline: 'Build powerful applications with LangChain, OpenAI, and Large Language Models',
    url: '/course/langchain-llm-development',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5239362_f595.jpg',
    rating: 4.6,
    num_reviews: 8234,
    num_subscribers: 156000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 45,
    published_title: '2024',
    category: 'AI Reasoning & Prompt Engineering',
    topics: ['langchain', 'openai', 'llm', 'python'],
  },
  {
    id: 1003,
    title: 'Prompt Engineering: How to Talk to AI',
    headline: 'Master structured reasoning with AI through prompt patterns and decomposition techniques',
    url: '/course/prompt-engineering-ai',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5098216_8a2e.jpg',
    rating: 4.5,
    num_reviews: 5678,
    num_subscribers: 98000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 18,
    published_title: '2024',
    category: 'AI Reasoning & Prompt Engineering',
    topics: ['prompt engineering', 'chain of thought', 'structured output'],
  },
  {
    id: 1004,
    title: 'Advanced ChatGPT: Complete Guide',
    headline: 'Chain of thought prompting, few-shot learning, and advanced LLM techniques',
    url: '/course/advanced-chatgpt-guide',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5156789_a3c1.jpg',
    rating: 4.6,
    num_reviews: 4321,
    num_subscribers: 76000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 32,
    published_title: '2024',
    category: 'AI Reasoning & Prompt Engineering',
    topics: ['chatgpt', 'prompt engineering', 'chain of thought'],
  },

  // Multimodal AI Workflows
  {
    id: 1011,
    title: 'Computer Vision with Python: Complete Guide',
    headline: 'Learn image processing, OCR, and visual analysis using Python and OpenCV',
    url: '/course/computer-vision-python',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/4892341_c7a2.jpg',
    rating: 4.5,
    num_reviews: 7890,
    num_subscribers: 134000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 56,
    published_title: '2024',
    category: 'Multimodal AI Workflows',
    topics: ['python', 'computer vision', 'opencv', 'ocr'],
  },
  {
    id: 1012,
    title: 'GPT-4 Vision API: Build Multimodal AI Apps',
    headline: 'Process images, documents, and visual data with GPT-4 Vision API',
    url: '/course/gpt4-vision-api',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5289012_d4f3.jpg',
    rating: 4.7,
    num_reviews: 3456,
    num_subscribers: 67000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 28,
    published_title: '2024',
    category: 'Multimodal AI Workflows',
    topics: ['openai', 'gpt', 'computer vision', 'api'],
  },
  {
    id: 1013,
    title: 'Document Processing with AI and OCR',
    headline: 'Extract data from PDFs, invoices, and documents using AI-powered OCR',
    url: '/course/document-processing-ai-ocr',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5123456_b8e1.jpg',
    rating: 4.4,
    num_reviews: 2345,
    num_subscribers: 45000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 22,
    published_title: '2024',
    category: 'Multimodal AI Workflows',
    topics: ['ocr', 'document processing', 'ai', 'python'],
  },

  // AI Evaluation & Trust
  {
    id: 1021,
    title: 'AI Safety and Ethics: A Practical Guide',
    headline: 'Understanding AI risks, trust boundaries, and safety evaluation methods',
    url: '/course/ai-safety-ethics',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5034567_e2a1.jpg',
    rating: 4.6,
    num_reviews: 4567,
    num_subscribers: 89000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 20,
    published_title: '2024',
    category: 'AI Evaluation & Trust',
    topics: ['ai safety', 'ai trust', 'evaluation'],
  },
  {
    id: 1022,
    title: 'Testing and Evaluating LLM Applications',
    headline: 'Build evaluation pipelines and detect hallucinations in LLM outputs',
    url: '/course/testing-evaluating-llm',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5198765_c3b2.jpg',
    rating: 4.5,
    num_reviews: 1234,
    num_subscribers: 34000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 25,
    published_title: '2024',
    category: 'AI Evaluation & Trust',
    topics: ['llm', 'evaluation', 'testing'],
  },

  // ==================== OPS TIER ====================

  // AI Workflow Design
  {
    id: 1031,
    title: 'AI Automation with Make.com and Zapier',
    headline: 'Automate business processes using AI-powered workflow tools',
    url: '/course/ai-automation-make-zapier',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5067890_f1a2.jpg',
    rating: 4.6,
    num_reviews: 6789,
    num_subscribers: 112000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 35,
    published_title: '2024',
    category: 'AI Workflow Design',
    topics: ['automation', 'zapier', 'ai', 'workflow'],
  },
  {
    id: 1032,
    title: 'AI for Business Productivity',
    headline: 'Boost productivity with AI tools for emails, scheduling, and task management',
    url: '/course/ai-business-productivity',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5145678_d2c1.jpg',
    rating: 4.5,
    num_reviews: 3456,
    num_subscribers: 78000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 28,
    published_title: '2024',
    category: 'AI Workflow Design',
    topics: ['ai productivity', 'automation', 'business'],
  },

  // Research Operations
  {
    id: 1041,
    title: 'Web Scraping with Python: Complete Bootcamp',
    headline: 'Master web scraping, data extraction, and automated research workflows',
    url: '/course/web-scraping-python-bootcamp',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/4789012_a3b1.jpg',
    rating: 4.7,
    num_reviews: 15678,
    num_subscribers: 234000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 68,
    published_title: '2024',
    category: 'Research Operations',
    topics: ['python', 'web scraping', 'automation', 'api'],
  },
  {
    id: 1042,
    title: 'AI-Powered Research and Data Analysis',
    headline: 'Use AI to automate research, data extraction, and synthesis workflows',
    url: '/course/ai-research-data-analysis',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5234567_e1d2.jpg',
    rating: 4.5,
    num_reviews: 2345,
    num_subscribers: 56000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 30,
    published_title: '2024',
    category: 'Research Operations',
    topics: ['ai research', 'data extraction', 'python'],
  },

  // Content Operations
  {
    id: 1051,
    title: 'AI Content Generation with ChatGPT',
    headline: 'Automate content creation pipelines using AI writing tools',
    url: '/course/ai-content-generation-chatgpt',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5078901_b2c1.jpg',
    rating: 4.4,
    num_reviews: 5678,
    num_subscribers: 95000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 24,
    published_title: '2024',
    category: 'Content Operations',
    topics: ['ai writing', 'content automation', 'chatgpt'],
  },
  {
    id: 1052,
    title: 'Automated Content Marketing with AI',
    headline: 'Build content pipelines with AI for blogs, social media, and newsletters',
    url: '/course/automated-content-marketing-ai',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5167890_c3d1.jpg',
    rating: 4.5,
    num_reviews: 3456,
    num_subscribers: 67000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 32,
    published_title: '2024',
    category: 'Content Operations',
    topics: ['ai copywriting', 'content automation', 'marketing'],
  },

  // Knowledge Management
  {
    id: 1061,
    title: 'Notion AI: Build Your Second Brain',
    headline: 'Organize knowledge and build AI-powered knowledge management systems',
    url: '/course/notion-ai-second-brain',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5089012_d4e1.jpg',
    rating: 4.6,
    num_reviews: 4567,
    num_subscribers: 89000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 26,
    published_title: '2024',
    category: 'Knowledge Management',
    topics: ['notion ai', 'knowledge management', 'ai'],
  },
  {
    id: 1062,
    title: 'Enterprise Search with AI',
    headline: 'Build intelligent search systems for documents, databases, and knowledge bases',
    url: '/course/enterprise-search-ai',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5212345_e2f1.jpg',
    rating: 4.4,
    num_reviews: 1234,
    num_subscribers: 34000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 22,
    published_title: '2024',
    category: 'Knowledge Management',
    topics: ['enterprise search', 'document management', 'ai'],
  },

  // ==================== AGENTS TIER ====================

  // RAG & Document Intelligence
  {
    id: 1071,
    title: 'Build RAG Applications with LangChain',
    headline: 'Create retrieval-augmented generation apps with vector databases and embeddings',
    url: '/course/build-rag-applications-langchain',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5245678_f3a1.jpg',
    rating: 4.8,
    num_reviews: 6789,
    num_subscribers: 123000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 42,
    published_title: '2024',
    category: 'RAG & Document Intelligence',
    topics: ['langchain', 'rag', 'vector database', 'pinecone'],
  },
  {
    id: 1072,
    title: 'Semantic Search with ChromaDB and Embeddings',
    headline: 'Build document Q&A systems using Chroma, OpenAI embeddings, and semantic search',
    url: '/course/semantic-search-chromadb',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5178901_a2b1.jpg',
    rating: 4.6,
    num_reviews: 2345,
    num_subscribers: 56000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 30,
    published_title: '2024',
    category: 'RAG & Document Intelligence',
    topics: ['chroma db', 'semantic search', 'embeddings', 'rag'],
  },
  {
    id: 1073,
    title: 'Document Intelligence with AI and Python',
    headline: 'Extract insights from documents using RAG, OCR, and NLP techniques',
    url: '/course/document-intelligence-ai-python',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5134567_c1d2.jpg',
    rating: 4.5,
    num_reviews: 1890,
    num_subscribers: 45000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 28,
    published_title: '2024',
    category: 'RAG & Document Intelligence',
    topics: ['python', 'rag', 'document processing', 'nlp'],
  },

  // Multi-Agent Orchestration
  {
    id: 1081,
    title: 'LangGraph: Build Multi-Agent AI Systems',
    headline: 'Create complex AI workflows with LangGraph, agent collaboration, and state management',
    url: '/course/langgraph-multi-agent',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5267890_d3e1.jpg',
    rating: 4.7,
    num_reviews: 3456,
    num_subscribers: 78000,
    price: 'Free',
    is_paid: false,
    level: 'Expert',
    lang: 'en',
    num_lectures: 38,
    published_title: '2024',
    category: 'Multi-Agent Orchestration',
    topics: ['langgraph', 'multi-agent', 'ai orchestration'],
  },
  {
    id: 1082,
    title: 'CrewAI: Multi-Agent Collaboration Framework',
    headline: 'Build autonomous agent teams with CrewAI, role assignment, and task delegation',
    url: '/course/crewai-multi-agent',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5189012_e2f1.jpg',
    rating: 4.6,
    num_reviews: 2345,
    num_subscribers: 56000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 32,
    published_title: '2024',
    category: 'Multi-Agent Orchestration',
    topics: ['crewai', 'multi-agent', 'ai agent collaboration'],
  },
  {
    id: 1083,
    title: 'AutoGen: Microsoft Multi-Agent Framework',
    headline: 'Build conversable agents and multi-agent workflows with Microsoft AutoGen',
    url: '/course/autogen-microsoft',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5223456_f1a2.jpg',
    rating: 4.5,
    num_reviews: 1678,
    num_subscribers: 43000,
    price: 'Free',
    is_paid: false,
    level: 'Expert',
    lang: 'en',
    num_lectures: 35,
    published_title: '2024',
    category: 'Multi-Agent Orchestration',
    topics: ['autogen', 'multi-agent', 'microsoft'],
  },

  // AI Copilot & Code Generation
  {
    id: 1091,
    title: 'GitHub Copilot: AI-Paired Programming',
    headline: 'Master AI code generation, refactoring, and automated code review with Copilot',
    url: '/course/github-copilot-ai',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5056789_a1b2.jpg',
    rating: 4.7,
    num_reviews: 8901,
    num_subscribers: 167000,
    price: 'Free',
    is_paid: false,
    level: 'Beginner',
    lang: 'en',
    num_lectures: 30,
    published_title: '2024',
    category: 'AI Copilot & Code Generation',
    topics: ['github copilot', 'code generation', 'ai'],
  },
  {
    id: 1092,
    title: 'Build Your Own AI Coding Assistant',
    headline: 'Create a repo-aware coding assistant with code indexing and smart suggestions',
    url: '/course/build-ai-coding-assistant',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5145678_b2c1.jpg',
    rating: 4.6,
    num_reviews: 2345,
    num_subscribers: 56000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 36,
    published_title: '2024',
    category: 'AI Copilot & Code Generation',
    topics: ['ai coding assistant', 'code generation', 'python'],
  },

  // Web Research Agent
  {
    id: 1101,
    title: 'Python Web Automation and Scraping Masterclass',
    headline: 'Build automated web research agents with Selenium, BeautifulSoup, and APIs',
    url: '/course/python-web-automation-scraping',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/4923456_c3d1.jpg',
    rating: 4.7,
    num_reviews: 12345,
    num_subscribers: 198000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 52,
    published_title: '2024',
    category: 'Web Research Agent',
    topics: ['python', 'web scraping', 'web automation', 'selenium'],
  },
  {
    id: 1102,
    title: 'Build an AI Research Assistant with Python',
    headline: 'Automate web research, content extraction, and synthesis with AI agents',
    url: '/course/ai-research-assistant-python',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5198765_d4e1.jpg',
    rating: 4.5,
    num_reviews: 3456,
    num_subscribers: 67000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 28,
    published_title: '2024',
    category: 'Web Research Agent',
    topics: ['python', 'ai research', 'web automation'],
  },

  // Knowledge Base Assistant
  {
    id: 1111,
    title: 'Build a RAG Chatbot for Your Knowledge Base',
    headline: 'Create document Q&A systems with RAG, vector search, and citations',
    url: '/course/build-rag-chatbot',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5212345_e1f2.jpg',
    rating: 4.6,
    num_reviews: 4567,
    num_subscribers: 89000,
    price: 'Free',
    is_paid: false,
    level: 'Intermediate',
    lang: 'en',
    num_lectures: 34,
    published_title: '2024',
    category: 'Knowledge Base Assistant',
    topics: ['rag chatbot', 'document q&a', 'knowledge base'],
  },
  {
    id: 1112,
    title: 'Enterprise Chatbot with LangChain and LlamaIndex',
    headline: 'Multi-source data ingestion, unified search, and intelligent document retrieval',
    url: '/course/enterprise-chatbot-langchain',
    image_240x135: 'https://img-c.udemycdn.com/course/240x135/5256789_f2a1.jpg',
    rating: 4.7,
    num_reviews: 2345,
    num_subscribers: 56000,
    price: 'Free',
    is_paid: false,
    level: 'Expert',
    lang: 'en',
    num_lectures: 40,
    published_title: '2024',
    category: 'Knowledge Base Assistant',
    topics: ['langchain', 'rag', 'enterprise search'],
  },
];

// Category-to-search-query mapping for matching
const CATEGORY_QUERY_MAP: Record<string, string[]> = {
  'AI Reasoning & Prompt Engineering': ['prompt engineering', 'ai reasoning', 'chain of thought', 'llm prompting', 'structured output'],
  'Multimodal AI Workflows': ['multimodal ai', 'computer vision', 'document processing', 'ocr', 'image analysis'],
  'AI Evaluation & Trust': ['ai evaluation', 'ai safety', 'ai trust', 'llm evaluation', 'hallucination'],
  'AI Workflow Design': ['ai automation', 'ai workflow', 'ai productivity', 'zapier ai', 'business automation'],
  'Research Operations': ['ai research', 'web scraping', 'data extraction', 'research automation'],
  'Content Operations': ['ai writing', 'content generation', 'content automation', 'ai copywriting'],
  'Knowledge Management': ['knowledge management', 'notion ai', 'enterprise search', 'document management'],
  'RAG & Document Intelligence': ['rag', 'vector database', 'chroma', 'pinecone', 'semantic search', 'document q&a'],
  'Multi-Agent Orchestration': ['multi-agent', 'langgraph', 'crewai', 'autogen', 'agent collaboration'],
  'AI Copilot & Code Generation': ['ai coding', 'code generation', 'github copilot', 'code assistant'],
  'Web Research Agent': ['web scraping', 'web automation', 'ai research', 'selenium'],
  'Knowledge Base Assistant': ['rag chatbot', 'document q&a', 'knowledge base', 'enterprise chatbot'],
};

export function getMockCourses(
  query: string,
  options: { price?: 'free' | 'paid' | 'all'; level?: string } = {}
): MockCourse[] {
  const { price = 'free', level } = options;
  const searchTerms = query.toLowerCase().split(/\s+/);

  let courses = COURSE_TEMPLATES.filter(course => {
    // Price filter
    if (price === 'free' && course.is_paid) return false;
    if (price === 'paid' && !course.is_paid) return false;

    // Level filter
    if (level && level !== 'all' && course.level !== level && course.level !== 'All Levels') {
      return false;
    }

    // Match against query terms
    const searchText = [
      course.title,
      course.headline,
      course.category,
      ...(course.topics || []),
    ].join(' ').toLowerCase();

    // Direct match
    const directMatch = searchTerms.some(term => searchText.includes(term));

    // Category query match
    const categoryQueries = course.category ? CATEGORY_QUERY_MAP[course.category] || [] : [];
    const categoryMatch = categoryQueries.some(q => 
      searchTerms.some(term => q.toLowerCase().includes(term))
    );

    return directMatch || categoryMatch;
  });

  // Sort by rating and subscribers
  courses.sort((a, b) => {
    const ratingDiff = b.rating - a.rating;
    if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
    return b.num_subscribers - a.num_subscribers;
  });

  return courses;
}

export function getAllMockCourses(): MockCourse[] {
  return COURSE_TEMPLATES.sort((a, b) => b.rating - a.rating);
}

export function getMockCoursesByCategory(categoryId: string): MockCourse[] {
  const categoryMap: Record<string, string> = {
    'core-reasoning': 'AI Reasoning & Prompt Engineering',
    'core-multimodal': 'Multimodal AI Workflows',
    'core-evaluation': 'AI Evaluation & Trust',
    'ops-workflows': 'AI Workflow Design',
    'ops-research': 'Research Operations',
    'ops-content': 'Content Operations',
    'ops-knowledge': 'Knowledge Management',
    'agents-rag': 'RAG & Document Intelligence',
    'agents-orchestration': 'Multi-Agent Orchestration',
    'agents-code': 'AI Copilot & Code Generation',
    'agents-web': 'Web Research Agent',
    'agents-kb': 'Knowledge Base Assistant',
  };

  const categoryName = categoryMap[categoryId];
  if (!categoryName) return [];

  return COURSE_TEMPLATES.filter(c => c.category === categoryName);
}
