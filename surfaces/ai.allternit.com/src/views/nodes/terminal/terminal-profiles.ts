/**
 * Terminal Profiles
 * 
 * Pre-configured terminal environments for different workflows
 * - Standard Shell
 * - Python Environment
 * - Node.js Environment
 * - Docker Shell
 * - SSH Remote
 */

import { SandboxConfig } from './terminal.service';

export type TerminalProfileType = 
  | 'standard'
  | 'python'
  | 'nodejs'
  | 'docker'
  | 'ssh';

export interface TerminalProfile {
  id: TerminalProfileType;
  name: string;
  description: string;
  icon: string;
  shell: string;
  shellArgs?: string[];
  env: Record<string, string>;
  workingDir?: string;
  autoDetectPaths?: string[];
  initCommands?: string[];
  sandbox?: SandboxConfig;
  theme?: {
    background?: string;
    foreground?: string;
    accent?: string;
  };
}

export const TERMINAL_PROFILES: Record<TerminalProfileType, TerminalProfile> = {
  standard: {
    id: 'standard',
    name: 'Standard Shell',
    description: 'Default bash/zsh environment',
    icon: 'Terminal',
    shell: '/bin/bash',
    env: {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      accent: '#58a6ff',
    },
  },

  python: {
    id: 'python',
    name: 'Python Environment',
    description: 'Auto-detects and activates virtualenv',
    icon: 'Python',
    shell: '/bin/bash',
    env: {
      TERM: 'xterm-256color',
      PYTHONDONTWRITEBYTECODE: '1',
    },
    autoDetectPaths: ['.venv', 'venv', 'env', '.env', 'virtualenv'],
    initCommands: [
      'if [ -f .venv/bin/activate ]; then source .venv/bin/activate; elif [ -f venv/bin/activate ]; then source venv/bin/activate; fi',
      'python --version',
    ],
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      accent: '#3fb950',
    },
  },

  nodejs: {
    id: 'nodejs',
    name: 'Node.js Environment',
    description: 'Node.js with nvm support',
    icon: 'Node',
    shell: '/bin/bash',
    env: {
      TERM: 'xterm-256color',
      NODE_ENV: 'development',
    },
    initCommands: [
      'export NVM_DIR="$HOME/.nvm"',
      '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"',
      'node --version',
    ],
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      accent: '#f7df1e',
    },
  },

  docker: {
    id: 'docker',
    name: 'Docker Shell',
    description: 'Docker container context',
    icon: 'Docker',
    shell: '/bin/bash',
    env: {
      TERM: 'xterm-256color',
    },
    initCommands: [
      'docker --version',
      'docker-compose --version 2>/dev/null || echo "docker-compose not installed"',
    ],
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      accent: '#2496ed',
    },
  },

  ssh: {
    id: 'ssh',
    name: 'SSH Remote',
    description: 'Connect to remote node via SSH',
    icon: 'Globe',
    shell: '/bin/bash',
    env: {
      TERM: 'xterm-256color',
    },
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      accent: '#bc8cff',
    },
  },
};

export function getProfileById(id: TerminalProfileType): TerminalProfile {
  return TERMINAL_PROFILES[id] || TERMINAL_PROFILES.standard;
}

export function detectProfileFromPath(path: string): TerminalProfileType {
  // Check for Python
  if (path.includes('.venv') || path.includes('venv/') || path.includes('/env/')) {
    return 'python';
  }
  
  // Check for Node.js
  if (path.includes('node_modules') || path.includes('package.json')) {
    return 'nodejs';
  }
  
  // Check for Docker
  if (path.includes('Dockerfile') || path.includes('docker-compose')) {
    return 'docker';
  }
  
  return 'standard';
}

export function generateInitScript(profile: TerminalProfile): string {
  const lines: string[] = [];
  
  // Set environment variables
  Object.entries(profile.env).forEach(([key, value]) => {
    lines.push(`export ${key}="${value}"`);
  });
  
  // Change to working dir
  if (profile.workingDir) {
    lines.push(`cd "${profile.workingDir}"`);
  }
  
  // Run init commands
  if (profile.initCommands) {
    lines.push(...profile.initCommands);
  }
  
  return lines.join('\n');
}
