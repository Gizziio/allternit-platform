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

const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
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
  'claude-cli': {
    id: 'claude-cli',
    name: 'Claude CLI',
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
  'codex-cli': {
    id: 'codex-cli',
    name: 'Codex CLI',
    color: '#10A37F',
    icon: 'openai-logo.svg',
    textColor: '#FFFFFF',
  },
  codex: { // Alias
    id: 'codex',
    name: 'Codex',
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
    icon: 'zai-logo.svg',
    textColor: '#FFFFFF',
  },
  'kimi-cli': {
    id: 'kimi-cli',
    name: 'Kimi CLI',
    color: '#5B4CF3',
    icon: 'zai-logo.svg',
    textColor: '#FFFFFF',
  },
  zai: {
    id: 'zai',
    name: 'ZAI',
    color: '#5B4CF3',
    icon: 'zai-logo.svg',
    textColor: '#FFFFFF',
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    color: '#551DB0',
    icon: 'qwen-logo.svg',
    textColor: '#FFFFFF',
  },
  'qwen-cli': {
    id: 'qwen-cli',
    name: 'Qwen CLI',
    color: '#551DB0',
    icon: 'qwen-logo.svg',
    textColor: '#FFFFFF',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    color: '#000000',
    icon: 'xai-logo.svg',
    textColor: '#FFFFFF',
  },
  grok: { // Alias for xAI
    id: 'grok',
    name: 'Grok',
    color: '#000000',
    icon: 'xai-logo.svg',
    textColor: '#FFFFFF',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4D6BFA',
    icon: 'deepseek-logo.svg',
    textColor: '#FFFFFF',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    color: '#F55036',
    icon: 'groq-logo.svg',
    textColor: '#FFFFFF',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    color: '#FF7000',
    icon: 'mistral-logo.svg',
    textColor: '#FFFFFF',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    color: '#D18EE2',
    icon: 'cohere-logo.svg',
    textColor: '#FFFFFF',
  },
  togetherai: {
    id: 'togetherai',
    name: 'Together AI',
    color: '#0D3B66',
    icon: 'togetherai-logo.svg',
    textColor: '#FFFFFF',
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#20B8FB',
    icon: 'perplexity-logo.svg',
    textColor: '#FFFFFF',
  },
  'amazon-bedrock': {
    id: 'amazon-bedrock',
    name: 'Amazon Bedrock',
    color: '#FF9900',
    icon: 'amazon-bedrock-logo.svg',
    textColor: '#FFFFFF',
  },
  bedrock: { // Alias
    id: 'bedrock',
    name: 'Bedrock',
    color: '#FF9900',
    icon: 'amazon-bedrock-logo.svg',
    textColor: '#FFFFFF',
  },
  alibaba: {
    id: 'alibaba',
    name: 'Alibaba Cloud',
    color: '#FF6A00',
    icon: 'alibaba-logo.svg',
    textColor: '#FFFFFF',
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity',
    color: '#6366F1',
    icon: 'allternit-logo.svg',
    textColor: '#FFFFFF',
  },
  allternit: {
    id: 'allternit',
    name: 'Allternit',
    color: '#6366F1',
    icon: 'allternit-logo.svg',
    textColor: '#FFFFFF',
  },
  'allternit-local-engine': {
    id: 'allternit-local-engine',
    name: 'Local Engine',
    color: '#22c55e',
    icon: 'allternit-logo.svg',
    textColor: '#FFFFFF',
  },
  'allternit-sidecar': {
    id: 'allternit-sidecar',
    name: 'Sidecar',
    color: '#22c55e',
    icon: 'ollama-logo.svg',
    textColor: '#FFFFFF',
  },
};

/**
 * Get provider metadata by ID
 */
export function getProviderMeta(id: string | undefined): ProviderMeta {
  if (!id) return PROVIDER_REGISTRY.allternit;

  const normalized = id.toLowerCase();

  // Try direct match
  const meta = PROVIDER_REGISTRY[normalized];
  if (meta) return meta;

  // Try partial match for CLI suffixes and compound IDs
  const key = Object.keys(PROVIDER_REGISTRY).find((k) => normalized.includes(k));
  if (key) return PROVIDER_REGISTRY[key];

  // Default fallback
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    color: '#6B7280',
    icon: '',
  };
}

/**
 * Returns a stable display name for a provider ID.
 */
export function getProviderName(id: string | undefined): string {
  return getProviderMeta(id).name;
}
