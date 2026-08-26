/**
 * Agent CLI icon mappings and display names for the Allternit runtime board.
 *
 * The runtime discovers agent CLIs and each CLI exposes an `icon` key that maps
 * to a filename under `/icons/agent-clis/{icon}.svg`. Keep this module in sync
 * with the runtime discovery schema.
 */

/** Maps an agent CLI icon key to its public SVG asset path. */
export const AGENT_CLI_ICON_MAP: Record<string, string> = {
  claude: '/icons/agent-clis/claude.svg',
  codex: '/icons/agent-clis/codex.svg',
  kimi: '/icons/agent-clis/kimi.svg',
  qwen: '/icons/agent-clis/qwen.svg',
  gemini: '/icons/agent-clis/gemini.svg',
  agy: '/icons/agent-clis/agy.svg',
  antigravity: '/icons/agent-clis/antigravity.svg',
  ollama: '/icons/agent-clis/ollama.svg',
  copilot: '/icons/agent-clis/copilot.svg',
  llm: '/icons/agent-clis/llm.svg',
  aichat: '/icons/agent-clis/aichat.svg',
  fabric: '/icons/agent-clis/fabric.svg',
  chatgpt: '/icons/agent-clis/chatgpt.svg',
  openclaw: '/icons/agent-clis/openclaw.svg',
  cursor: '/icons/agent-clis/cursor.svg',
  opencode: '/icons/agent-clis/opencode.svg',
  hermes: '/icons/agent-clis/hermes.svg',
  pi: '/icons/agent-clis/pi.svg',
  codebuddy: '/icons/agent-clis/codebuddy.svg',
  deveco: '/icons/agent-clis/deveco.svg',
  kiro: '/icons/agent-clis/kiro.svg',
  qoder: '/icons/agent-clis/qoder.svg',
  'qoder-cn': '/icons/agent-clis/qoder-cn.svg',
  qwenpaw: '/icons/agent-clis/qwenpaw.svg',
  reasonix: '/icons/agent-clis/reasonix.svg',
  trae: '/icons/agent-clis/trae.svg',
  dsh: '/icons/agent-clis/dsh.svg',
  omp: '/icons/agent-clis/omp.svg',
};

/** Human-readable display names for supported agent CLIs. */
export const AGENT_CLI_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  kimi: 'Kimi',
  qwen: 'Qwen',
  gemini: 'Gemini',
  agy: 'Agy',
  antigravity: 'Antigravity',
  ollama: 'Ollama',
  copilot: 'Copilot',
  llm: 'LLM',
  aichat: 'AIChat',
  fabric: 'Fabric',
  chatgpt: 'ChatGPT',
  openclaw: 'OpenClaw',
  cursor: 'Cursor',
  opencode: 'OpenCode',
  hermes: 'Hermes',
  pi: 'Pi',
  codebuddy: 'CodeBuddy',
  deveco: 'DevEco',
  kiro: 'Kiro',
  qoder: 'Qoder',
  'qoder-cn': 'Qoder CN',
  qwenpaw: 'QwenPaw',
  reasonix: 'Reasonix',
  trae: 'Trae',
  dsh: 'Dsh',
  omp: 'Omp',
};

const DEFAULT_ICON_PATH = '/icons/agent-clis/default.svg';

/**
 * Resolve the icon asset path for a given agent CLI icon key.
 * Falls back to the generic `default` icon for unknown keys.
 */
export function getAgentCliIconPath(icon: string): string {
  return AGENT_CLI_ICON_MAP[icon] ?? DEFAULT_ICON_PATH;
}

/**
 * Resolve a human-readable display name for a given agent CLI icon key.
 * Falls back to the key itself for unknown keys.
 */
export function getAgentCliDisplayName(icon: string): string {
  return AGENT_CLI_DISPLAY_NAMES[icon] ?? icon;
}
