/**
 * Environment Auto-Detection
 * 
 * Detects and suggests environment setup based on project files
 */

import { TerminalProfileType } from './terminal-profiles';

export interface DetectedEnvironment {
  type: TerminalProfileType;
  name: string;
  description: string;
  icon: string;
  detectedFiles: string[];
  initCommands: string[];
  envVars: Record<string, string>;
}

interface ProjectPattern {
  type: TerminalProfileType;
  files: string[];
  name: string;
  description: string;
  icon: string;
  initCommands: string[];
  envVars: Record<string, string>;
}

const PROJECT_PATTERNS: ProjectPattern[] = [
  {
    type: 'python',
    files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'poetry.lock'],
    name: 'Python Project',
    description: 'Python with pip/virtualenv/poetry',
    icon: 'python',
    initCommands: [
      'if [ -f .venv/bin/activate ]; then source .venv/bin/activate && echo "✓ Activated .venv"; elif [ -f venv/bin/activate ]; then source venv/bin/activate && echo "✓ Activated venv"; fi',
      'python --version',
    ],
    envVars: {
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONUNBUFFERED: '1',
    },
  },
  {
    type: 'nodejs',
    files: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    name: 'Node.js Project',
    description: 'JavaScript/TypeScript with npm/yarn/pnpm',
    icon: 'nodejs',
    initCommands: [
      'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"',
      'node --version',
      'npm --version',
    ],
    envVars: {
      NODE_ENV: 'development',
    },
  },
  {
    type: 'docker',
    files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'],
    name: 'Docker Project',
    description: 'Containerized application',
    icon: 'docker',
    initCommands: [
      'docker --version',
      'docker-compose --version 2>/dev/null || docker compose version',
    ],
    envVars: {},
  },
  {
    type: 'python',
    files: ['.venv', 'venv', 'env'],
    name: 'Python Virtualenv',
    description: 'Python virtual environment detected',
    icon: 'python',
    initCommands: [
      'source bin/activate 2>/dev/null || source Scripts/activate 2>/dev/null || true',
      'python --version',
    ],
    envVars: {},
  },
];

export interface DetectionResult {
  environments: DetectedEnvironment[];
  primary: DetectedEnvironment | null;
}

/**
 * Detect environment from file list
 */
export function detectEnvironment(files: string[]): DetectionResult {
  const detected: DetectedEnvironment[] = [];
  
  for (const pattern of PROJECT_PATTERNS) {
    const matchedFiles = pattern.files.filter(f => 
      files.some(file => file.toLowerCase().includes(f.toLowerCase()))
    );
    
    if (matchedFiles.length > 0) {
      detected.push({
        type: pattern.type,
        name: pattern.name,
        description: pattern.description,
        icon: pattern.icon,
        detectedFiles: matchedFiles,
        initCommands: pattern.initCommands,
        envVars: pattern.envVars,
      });
    }
  }
  
  // Remove duplicates by type, keeping first (more specific)
  const unique = detected.filter((env, index) => 
    detected.findIndex(e => e.type === env.type) === index
  );
  
  return {
    environments: unique,
    primary: unique[0] || null,
  };
}

/**
 * Generate setup script for detected environment
 */
export function generateSetupScript(env: DetectedEnvironment): string {
  const lines: string[] = [
    '# Auto-detected environment setup',
    `echo "🔧 Setting up ${env.name}..."`,
  ];
  
  // Set environment variables
  Object.entries(env.envVars).forEach(([key, value]) => {
    lines.push(`export ${key}="${value}"`);
  });
  
  // Run init commands
  lines.push(...env.initCommands);
  
  lines.push(`echo "✅ ${env.name} ready"`);
  
  return lines.join('\n');
}

/**
 * Check if running in specific environment
 */
export function isEnvironmentActive(type: TerminalProfileType): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Python virtualenv
  if (type === 'python') {
    return !!process.env.VIRTUAL_ENV;
  }
  
  // Check for Node.js
  if (type === 'nodejs') {
    return !!process.env.NODE_ENV;
  }
  
  return false;
}
