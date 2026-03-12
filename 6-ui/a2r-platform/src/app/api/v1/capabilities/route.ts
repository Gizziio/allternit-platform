/**
 * Capabilities API - Fetch available agent capabilities
 *
 * Returns a comprehensive list of capabilities that agents can have,
 * organized by category with descriptions and metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";

/**
 * Default capabilities catalog
 * 
 * These represent the core capabilities that agents can possess.
 * In production, this would be fetched from a backend service or database.
 */
const DEFAULT_CAPABILITIES = [
  // Core Reasoning Capabilities
  {
    id: 'reasoning',
    name: 'Advanced Reasoning',
    category: 'Cognitive',
    description: 'Complex problem-solving and logical deduction capabilities',
    enabled: true,
    icon: 'Brain',
    level: 'advanced',
  },
  {
    id: 'planning',
    name: 'Strategic Planning',
    category: 'Cognitive',
    description: 'Multi-step planning and task decomposition',
    enabled: true,
    icon: 'Target',
    level: 'advanced',
  },
  {
    id: 'memory',
    name: 'Long-term Memory',
    category: 'Cognitive',
    description: 'Persistent knowledge retention and recall across sessions',
    enabled: true,
    icon: 'Database',
    level: 'intermediate',
  },
  {
    id: 'learning',
    name: 'Continuous Learning',
    category: 'Cognitive',
    description: 'Adapts and improves from interactions over time',
    enabled: false,
    icon: 'TrendingUp',
    level: 'advanced',
  },
  
  // Communication Capabilities
  {
    id: 'natural_language',
    name: 'Natural Language Understanding',
    category: 'Communication',
    description: 'Deep comprehension of human language and context',
    enabled: true,
    icon: 'MessageSquare',
    level: 'basic',
  },
  {
    id: 'multilingual',
    name: 'Multilingual Support',
    category: 'Communication',
    description: 'Communicate in multiple languages fluently',
    enabled: true,
    icon: 'Globe',
    level: 'intermediate',
  },
  {
    id: 'voice_interaction',
    name: 'Voice Interaction',
    category: 'Communication',
    description: 'Speech-to-text and text-to-speech capabilities',
    enabled: false,
    icon: 'Mic',
    level: 'intermediate',
  },
  {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    category: 'Communication',
    description: 'Detect and respond to user emotions and tone',
    enabled: true,
    icon: 'Smile',
    level: 'intermediate',
  },
  
  // Technical Capabilities
  {
    id: 'code_execution',
    name: 'Code Execution',
    category: 'Technical',
    description: 'Execute and debug code in multiple programming languages',
    enabled: true,
    icon: 'Terminal',
    level: 'advanced',
  },
  {
    id: 'file_operations',
    name: 'File Operations',
    category: 'Technical',
    description: 'Read, write, and manage files in the workspace',
    enabled: true,
    icon: 'FileText',
    level: 'basic',
  },
  {
    id: 'web_access',
    name: 'Web Access',
    category: 'Technical',
    description: 'Browse and extract information from websites',
    enabled: true,
    icon: 'Globe',
    level: 'intermediate',
  },
  {
    id: 'api_integration',
    name: 'API Integration',
    category: 'Technical',
    description: 'Connect and interact with external APIs and services',
    enabled: true,
    icon: 'Zap',
    level: 'advanced',
  },
  {
    id: 'database_access',
    name: 'Database Access',
    category: 'Technical',
    description: 'Query and manage database operations',
    enabled: false,
    icon: 'Database',
    level: 'advanced',
  },
  
  // Creative Capabilities
  {
    id: 'image_generation',
    name: 'Image Generation',
    category: 'Creative',
    description: 'Create images and visual content from descriptions',
    enabled: true,
    icon: 'Image',
    level: 'intermediate',
  },
  {
    id: 'content_creation',
    name: 'Content Creation',
    category: 'Creative',
    description: 'Generate high-quality written content and documents',
    enabled: true,
    icon: 'PenTool',
    level: 'basic',
  },
  {
    id: 'design_assistance',
    name: 'Design Assistance',
    category: 'Creative',
    description: 'Help with UI/UX design and visual layouts',
    enabled: false,
    icon: 'Palette',
    level: 'intermediate',
  },
  
  // Collaboration Capabilities
  {
    id: 'multi_agent_coordination',
    name: 'Multi-Agent Coordination',
    category: 'Collaboration',
    description: 'Coordinate tasks with other agents in the system',
    enabled: true,
    icon: 'Users',
    level: 'advanced',
  },
  {
    id: 'human_collaboration',
    name: 'Human Collaboration',
    category: 'Collaboration',
    description: 'Work alongside humans with shared context and goals',
    enabled: true,
    icon: 'GitBranch',
    level: 'intermediate',
  },
  {
    id: 'task_delegation',
    name: 'Task Delegation',
    category: 'Collaboration',
    description: 'Delegate subtasks to specialized agents',
    enabled: false,
    icon: 'Layers',
    level: 'advanced',
  },
  
  // Security & Compliance
  {
    id: 'security_scanning',
    name: 'Security Scanning',
    category: 'Security',
    description: 'Identify security vulnerabilities and suggest fixes',
    enabled: true,
    icon: 'Shield',
    level: 'advanced',
  },
  {
    id: 'compliance_check',
    name: 'Compliance Checking',
    category: 'Security',
    description: 'Ensure outputs comply with policies and regulations',
    enabled: true,
    icon: 'Check',
    level: 'intermediate',
  },
  {
    id: 'access_control',
    name: 'Access Control',
    category: 'Security',
    description: 'Respect role-based access control and permissions',
    enabled: true,
    icon: 'Lock',
    level: 'basic',
  },
];

/**
 * GET /api/v1/capabilities
 * 
 * Fetch all available capabilities with optional filtering
 * 
 * Query parameters:
 * - category: Filter by category (Cognitive, Communication, Technical, Creative, Collaboration, Security)
 * - enabled: Filter by enabled status (true/false)
 * - search: Search by name or description
 * - level: Filter by difficulty level (basic, intermediate, advanced)
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication (optional - capabilities are public)
    // const session = await auth.api.getSession({ headers: req.headers });
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');
    const level = searchParams.get('level');

    let capabilities = [...DEFAULT_CAPABILITIES];

    // Filter by category
    if (category) {
      capabilities = capabilities.filter(cap => 
        cap.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter by enabled status
    if (enabled !== null && enabled !== undefined) {
      const isEnabled = enabled === 'true';
      capabilities = capabilities.filter(cap => cap.enabled === isEnabled);
    }

    // Filter by level
    if (level) {
      capabilities = capabilities.filter(cap => 
        cap.level.toLowerCase() === level.toLowerCase()
      );
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      capabilities = capabilities.filter(cap =>
        cap.name.toLowerCase().includes(searchLower) ||
        cap.description.toLowerCase().includes(searchLower) ||
        cap.id.toLowerCase().includes(searchLower)
      );
    }

    // Return structured response
    return NextResponse.json({
      capabilities,
      categories: Array.from(new Set(DEFAULT_CAPABILITIES.map(c => c.category))),
      total: capabilities.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Capabilities API] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        error: "Failed to fetch capabilities", 
        message,
        capabilities: DEFAULT_CAPABILITIES, // Fallback
        categories: ['Cognitive', 'Communication', 'Technical', 'Creative', 'Collaboration', 'Security'],
        total: DEFAULT_CAPABILITIES.length,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
