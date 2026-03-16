/**
 * useToolRecommendations - Context-aware tool recommendations
 * 
 * Analyzes the current project context (language, framework, files)
 * and recommends relevant tools, plugins, and CLI utilities.
 */

import { useMemo, useEffect, useState } from 'react';
import { useToolRegistryStore, ToolCategory } from '../agents/tool-registry.store';
import type { FeaturePlugin, PluginCategory } from '../../plugins/feature.types';

// ============================================================================
// Types
// ============================================================================

export interface ProjectContext {
  /** Detected programming languages */
  languages: string[];
  /** Detected frameworks */
  frameworks: string[];
  /** Project type */
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'cli' | 'data' | 'unknown';
  /** Has package.json, Cargo.toml, etc. */
  hasPackageManager: boolean;
  /** Has Dockerfile, docker-compose.yml */
  hasDocker: boolean;
  /** Has CI/CD config */
  hasCI: boolean;
  /** Has test files */
  hasTests: boolean;
}

export interface ToolRecommendation {
  id: string;
  name: string;
  description: string;
  reason: string;
  type: 'plugin' | 'tool' | 'cli';
  category: PluginCategory | ToolCategory | string;
  confidence: number; // 0-1
  installed: boolean;
  enabled?: boolean;
}

export interface UseToolRecommendationsReturn {
  /** Current detected project context */
  context: ProjectContext | null;
  /** Is analyzing context */
  isAnalyzing: boolean;
  /** Recommended plugins for this context */
  recommendedPlugins: ToolRecommendation[];
  /** Recommended tools for this context */
  recommendedTools: ToolRecommendation[];
  /** Recommended CLI tools for this context */
  recommendedCliTools: ToolRecommendation[];
  /** All recommendations sorted by confidence */
  allRecommendations: ToolRecommendation[];
  /** Refresh context analysis */
  refresh: () => void;
}

// ============================================================================
// Project Detection Logic
// ============================================================================

/**
 * Analyze project files to detect context
 */
async function analyzeProjectContext(): Promise<ProjectContext> {
  const context: ProjectContext = {
    languages: [],
    frameworks: [],
    type: 'unknown',
    hasPackageManager: false,
    hasDocker: false,
    hasCI: false,
    hasTests: false,
  };

  try {
    // Check for common files
    const files = await detectProjectFiles();
    
    // Detect languages
    if (files.some(f => f.includes('package.json'))) {
      context.languages.push('javascript');
      context.hasPackageManager = true;
    }
    if (files.some(f => f.includes('tsconfig.json') || f.endsWith('.ts') || f.endsWith('.tsx'))) {
      context.languages.push('typescript');
    }
    if (files.some(f => f.includes('requirements.txt') || f.includes('pyproject.toml') || f.endsWith('.py'))) {
      context.languages.push('python');
    }
    if (files.some(f => f.includes('Cargo.toml') || f.endsWith('.rs'))) {
      context.languages.push('rust');
    }
    if (files.some(f => f.includes('go.mod') || f.endsWith('.go'))) {
      context.languages.push('go');
    }

    // Detect frameworks
    if (files.some(f => f.includes('next.config'))) {
      context.frameworks.push('nextjs');
      context.type = 'web';
    } else if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
      context.frameworks.push('react');
      context.type = 'web';
    }
    if (files.some(f => f.endsWith('.vue'))) {
      context.frameworks.push('vue');
      context.type = 'web';
    }
    if (files.some(f => f.includes('manage.py'))) {
      context.frameworks.push('django');
      context.type = 'api';
    }
    if (files.some(f => f.includes('application.properties') || f.includes('application.yml'))) {
      context.frameworks.push('spring');
      context.type = 'api';
    }

    // Detect infrastructure
    if (files.some(f => f.includes('Dockerfile') || f.includes('docker-compose'))) {
      context.hasDocker = true;
    }
    if (files.some(f => f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('Jenkinsfile'))) {
      context.hasCI = true;
    }

    // Detect tests
    if (files.some(f => f.includes('test') || f.includes('spec') || f.includes('jest') || f.includes('vitest') || f.includes('pytest') || f.includes('cypress') || f.includes('playwright'))) {
      context.hasTests = true;
    }

    // Determine project type
    if (context.type === 'unknown') {
      if (context.languages.includes('javascript') || context.languages.includes('typescript')) {
        context.type = 'web';
      } else if (context.languages.includes('python')) {
        context.type = context.frameworks.includes('django') ? 'api' : 'cli';
      } else if (context.languages.includes('rust') || context.languages.includes('go')) {
        context.type = 'cli';
      }
    }
  } catch (error) {
    console.error('Failed to analyze project context:', error);
  }

  return context;
}

/**
 * Mock function to detect project files
 * In production, this would use the file system API or backend
 */
async function detectProjectFiles(): Promise<string[]> {
  // TODO: Replace with actual file system detection
  // For now, return empty array - context will be unknown
  return [];
}

// ============================================================================
// Recommendation Logic
// ============================================================================

const RECOMMENDATION_RULES: {
  condition: (context: ProjectContext) => boolean;
  recommendations: Omit<ToolRecommendation, 'installed' | 'enabled'>[];
}[] = [
  // JavaScript/TypeScript Projects
  {
    condition: (ctx) => ctx.languages.includes('javascript') || ctx.languages.includes('typescript'),
    recommendations: [
      {
        id: 'plugin-eslint',
        name: 'ESLint Integration',
        description: 'Lint your JavaScript/TypeScript code for potential errors',
        reason: 'JavaScript/TypeScript project detected',
        type: 'plugin',
        category: 'code-quality',
        confidence: 0.95,
      },
      {
        id: 'plugin-prettier',
        name: 'Prettier',
        description: 'Automatic code formatting for consistent style',
        reason: 'Code formatting improves team collaboration',
        type: 'plugin',
        category: 'code-quality',
        confidence: 0.9,
      },
      {
        id: 'tool-node-fs',
        name: 'Node File System',
        description: 'File operations for Node.js projects',
        reason: 'Essential for JavaScript projects',
        type: 'tool',
        category: 'file-system',
        confidence: 0.85,
      },
      {
        id: 'cli-npm',
        name: 'npm check',
        description: 'Check for outdated npm packages',
        reason: 'Keep dependencies up to date',
        type: 'cli',
        category: 'dev',
        confidence: 0.8,
      },
    ],
  },
  
  // React/Next.js Projects
  {
    condition: (ctx) => ctx.frameworks.includes('react') || ctx.frameworks.includes('nextjs'),
    recommendations: [
      {
        id: 'plugin-react-devtools',
        name: 'React DevTools',
        description: 'Debug React components and hooks',
        reason: 'React framework detected',
        type: 'plugin',
        category: 'debugging',
        confidence: 0.95,
      },
      {
        id: 'tool-web-scraper',
        name: 'Web Scraper',
        description: 'Scrape web pages for data extraction',
        reason: 'Useful for web projects',
        type: 'tool',
        category: 'web',
        confidence: 0.7,
      },
    ],
  },
  
  // Python Projects
  {
    condition: (ctx) => ctx.languages.includes('python'),
    recommendations: [
      {
        id: 'plugin-black',
        name: 'Black Formatter',
        description: 'The uncompromising Python code formatter',
        reason: 'Python project detected',
        type: 'plugin',
        category: 'code-quality',
        confidence: 0.9,
      },
      {
        id: 'plugin-pylint',
        name: 'Pylint',
        description: 'Static code analysis for Python',
        reason: 'Catch Python errors early',
        type: 'plugin',
        category: 'code-quality',
        confidence: 0.85,
      },
      {
        id: 'tool-python-executor',
        name: 'Python Executor',
        description: 'Run Python code in sandboxed environment',
        reason: 'Execute Python scripts',
        type: 'tool',
        category: 'system',
        confidence: 0.9,
      },
      {
        id: 'cli-pip',
        name: 'pip list',
        description: 'Manage Python packages',
        reason: 'Package management for Python',
        type: 'cli',
        category: 'dev',
        confidence: 0.8,
      },
    ],
  },
  
  // Docker Projects
  {
    condition: (ctx) => ctx.hasDocker,
    recommendations: [
      {
        id: 'plugin-docker',
        name: 'Docker Integration',
        description: 'Manage containers and images',
        reason: 'Docker configuration detected',
        type: 'plugin',
        category: 'infrastructure',
        confidence: 0.95,
      },
      {
        id: 'tool-container-manager',
        name: 'Container Manager',
        description: 'Start, stop, and manage Docker containers',
        reason: 'Docker project detected',
        type: 'tool',
        category: 'container',
        confidence: 0.9,
      },
      {
        id: 'cli-docker',
        name: 'docker-compose',
        description: 'Docker Compose for multi-container apps',
        reason: 'Essential for Docker projects',
        type: 'cli',
        category: 'dev',
        confidence: 0.9,
      },
    ],
  },
  
  // Projects with CI/CD
  {
    condition: (ctx) => ctx.hasCI,
    recommendations: [
      {
        id: 'plugin-ci-monitor',
        name: 'CI Monitor',
        description: 'Monitor CI/CD pipeline status',
        reason: 'CI/CD configuration detected',
        type: 'plugin',
        category: 'observability',
        confidence: 0.85,
      },
      {
        id: 'tool-deployment',
        name: 'Deployment Tool',
        description: 'Deploy to staging/production environments',
        reason: 'Streamline deployments',
        type: 'tool',
        category: 'system',
        confidence: 0.8,
      },
    ],
  },
  
  // Projects with Tests
  {
    condition: (ctx) => ctx.hasTests,
    recommendations: [
      {
        id: 'plugin-test-runner',
        name: 'Test Runner',
        description: 'Run and visualize test results',
        reason: 'Test files detected',
        type: 'plugin',
        category: 'testing',
        confidence: 0.9,
      },
      {
        id: 'tool-coverage',
        name: 'Coverage Analyzer',
        description: 'Analyze code coverage from tests',
        reason: 'Monitor test coverage',
        type: 'tool',
        category: 'observability',
        confidence: 0.85,
      },
    ],
  },
  
  // API Projects
  {
    condition: (ctx) => ctx.type === 'api',
    recommendations: [
      {
        id: 'plugin-api-tester',
        name: 'API Tester',
        description: 'Test REST and GraphQL endpoints',
        reason: 'API project detected',
        type: 'plugin',
        category: 'testing',
        confidence: 0.9,
      },
      {
        id: 'tool-http-client',
        name: 'HTTP Client',
        description: 'Make HTTP requests from the shell',
        reason: 'Essential for API development',
        type: 'tool',
        category: 'web',
        confidence: 0.85,
      },
      {
        id: 'cli-curl',
        name: 'curl',
        description: 'Command-line HTTP client',
        reason: 'Test APIs from terminal',
        type: 'cli',
        category: 'network',
        confidence: 0.9,
      },
    ],
  },
  
  // General recommendations for all projects
  {
    condition: () => true,
    recommendations: [
      {
        id: 'plugin-git',
        name: 'Git Integration',
        description: 'Enhanced Git commands and visualization',
        reason: 'Version control is essential',
        type: 'plugin',
        category: 'version-control',
        confidence: 0.9,
      },
      {
        id: 'tool-file-search',
        name: 'File Search',
        description: 'Fast file search across the project',
        reason: 'Navigate large codebases',
        type: 'tool',
        category: 'file-system',
        confidence: 0.85,
      },
      {
        id: 'cli-ripgrep',
        name: 'ripgrep',
        description: 'Fast text search in files',
        reason: 'Search code efficiently',
        type: 'cli',
        category: 'text',
        confidence: 0.8,
      },
      {
        id: 'cli-fzf',
        name: 'fzf',
        description: 'Fuzzy finder for files and commands',
        reason: 'Quick file navigation',
        type: 'cli',
        category: 'shell',
        confidence: 0.75,
      },
    ],
  },
];

// ============================================================================
// Hook
// ============================================================================

export function useToolRecommendations(): UseToolRecommendationsReturn {
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Get installed/enabled state from stores
  const tools = useToolRegistryStore((state) => state.tools);
  const cliTools = useToolRegistryStore((state) => state.cliTools);
  
  // Analyze project context
  const analyzeContext = async () => {
    setIsAnalyzing(true);
    try {
      const ctx = await analyzeProjectContext();
      setContext(ctx);
    } catch (error) {
      console.error('Failed to analyze context:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Analyze on mount
  useEffect(() => {
    analyzeContext();
  }, []);
  
  // Generate recommendations based on context
  const recommendations = useMemo(() => {
    if (!context) return [];
    
    const allRecs: ToolRecommendation[] = [];
    
    for (const rule of RECOMMENDATION_RULES) {
      if (rule.condition(context)) {
        for (const rec of rule.recommendations) {
          // Check if already installed/enabled
          let installed = false;
          let enabled = false;
          
          if (rec.type === 'tool' && tools[rec.id]) {
            installed = true;
            enabled = tools[rec.id].isEnabled;
          } else if (rec.type === 'cli' && cliTools[rec.id]) {
            installed = cliTools[rec.id].installed;
          }
          
          allRecs.push({
            ...rec,
            installed,
            enabled,
          });
        }
      }
    }
    
    // Sort by confidence and remove duplicates
    const seen = new Set<string>();
    return allRecs
      .filter((rec) => {
        if (seen.has(rec.id)) return false;
        seen.add(rec.id);
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }, [context, tools, cliTools]);
  
  // Split by type
  const recommendedPlugins = recommendations.filter((r) => r.type === 'plugin');
  const recommendedTools = recommendations.filter((r) => r.type === 'tool');
  const recommendedCliTools = recommendations.filter((r) => r.type === 'cli');
  
  return {
    context,
    isAnalyzing,
    recommendedPlugins,
    recommendedTools,
    recommendedCliTools,
    allRecommendations: recommendations,
    refresh: analyzeContext,
  };
}

export default useToolRecommendations;
