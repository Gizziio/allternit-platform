/**
 * Provider Registry
 * 
 * Maps provider IDs to visual metadata:
 * - Brand names
 * - Hex colors
 * - Icons (SVG names from assets/runtime-logos/)
 */

export interface ProviderMeta {
  id: string;
  name: string;
  color: string;
  icon: string;
  textColor?: string;
}

export const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#D97757',
    icon: 'claude-logo.svg',
    textColor: '#FFFFFF',
  },
  claude: { // Alias
    id: 'claude',
    name: 'Claude',
    color: '#D97757',
    icon: 'claude-logo.svg',
    textColor: '#FFFFFF',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    color: '#10A37F',
    icon: 'openai-logo.svg',
    textColor: '#FFFFFF',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    color: '#4285F4',
    icon: 'gemini-logo.svg',
    textColor: '#FFFFFF',
  },
  gemini: { // Alias
    id: 'gemini',
    name: 'Gemini',
    color: '#4285F4',
    icon: 'gemini-logo.svg',
    textColor: '#FFFFFF',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    color: '#000000',
    icon: 'ollama-logo.svg',
    textColor: '#FFFFFF',
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    color: '#5B4CF3',
    icon: 'zai-logo.svg', // Kimi often uses ZAI logo or similar
    textColor: '#FFFFFF',
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    color: '#551DB0',
    icon: 'qwen-logo.svg',
    textColor: '#FFFFFF',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    color: '#000000',
    icon: 'openai-logo.svg', // Codex is OpenAI
    textColor: '#FFFFFF',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    color: '#000000',
    icon: 'open-code-logo.svg',
    textColor: '#FFFFFF',
  },
  allternit: {
    id: 'allternit',
    name: 'Allternit',
    color: '#6366F1',
    icon: 'allternit-logo.svg',
    textColor: '#FFFFFF',
  },
};

/**
 * Get provider metadata by ID
 */
export function getProviderMeta(id: string | undefined): ProviderMeta {
  if (!id) return PROVIDER_REGISTRY.allternit;
  
  // Try direct match
  const meta = PROVIDER_REGISTRY[id.toLowerCase()];
  if (meta) return meta;
  
  // Try partial match
  const key = Object.keys(PROVIDER_REGISTRY).find(k => id.toLowerCase().includes(k));
  if (key) return PROVIDER_REGISTRY[key];
  
  // Default fallback
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    color: '#6B7280',
    icon: 'bot',
  };
}
