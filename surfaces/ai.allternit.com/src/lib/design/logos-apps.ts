/**
 * logos-apps resolver
 *
 * Provides SVG logo URLs from the ln-dev7/logos-apps catalog:
 * https://github.com/ln-dev7/logos-apps
 *
 * Used as a fallback when the platform does not ship a local icon for a
 * provider, connector, or mini-app.
 */

const LOGOS_APPS_BASE = "/assets/logos-apps";

/**
 * Manual aliases for names that do not map 1:1 to logos-apps slugs.
 * Keys are lower-cased, punctuation-stripped lookup tokens.
 *
 * A `null` value means the brand is known but has no matching logo in the
 * logos-apps catalog; callers should fall back to their own local/runtime icon.
 */
const LOGOS_APPS_ALIASES: Record<string, string | null> = {
  // Providers / models — hosted APIs
  anthropic: "anthropic",
  claude: "anthropic",
  claudecli: "anthropic",
  openai: "openai",
  codex: "openai",
  codexcli: "openai",
  google: "google",
  googlegemini: "gemini",
  gemini: "gemini",
  ollama: "ollama",
  kimi: "kimi",
  kimicli: "kimi",
  moonshot: "kimi",
  moonshotai: "kimi",
  qwen: "qwen",
  qwencli: "qwen",
  alibaba: "alibaba",
  alibabacloud: "alibaba",
  xai: "x",
  grok: "grok",
  deepseek: "deepseek",
  dsh: "deepseek",
  deepseekharness: "deepseek",
  groq: "groq",
  mistral: "mistral-ai",
  minstral: "mistral-ai",
  cohere: "cohere",
  together: "together-ai",
  togetherai: "together-ai",
  perplexity: "perplexity",
  amazon: "amazon-web-services",
  amazonbedrock: "amazon-web-services",
  bedrock: "amazon-web-services",
  aws: "amazon-web-services",
  amazonwebservices: "amazon-web-services",

  // Providers / models — CLI / local runtimes
  antigravity: "google-antigravity",
  agy: "google-antigravity",
  cursor: "cursor",
  cursoragent: "cursor",
  copilot: "github-copilot",
  githubcopilot: "github-copilot",
  githubcopilotcli: "github-copilot",
  opencode: "opencode",
  openclaw: "openclaw",
  hermes: "hermes",
  pi: "pi-coding-agent",
  tencent: "tencent",
  huawei: "huawei",
  trae: "traeai",
  traecli: "traeai",
  minimax: "minimax",
  minimaxcode: "minimax",
  mcode: "minimax",
  sidecar: "ollama",

  // Platform brands with no logos-apps entry — rely on runtime-logos fallback
  zai: null,
  codebuddy: null,
  tencentcodebuddy: null,
  deveco: null,
  kiro: null,
  kirocli: null,
  qoder: null,
  qodercli: null,
  qoderclicn: null,
  qwenpaw: null,
  reasonix: null,
  omp: null,
  ohmp: null,
  ohmmypi: null,
  ohmypi: null,
  dim: null,
  dimcode: null,
  devecocode: null,
  allternit: null,
  localengine: null,

  // Common connector / SaaS brands that differ from domain guess
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  slack: "slack",
  discord: "discord",
  gmail: "gmail",
  notion: "notion",
  trello: "trello",
  jira: "jira",
  confluence: "confluence",
  azure: "azure",
  mongodb: "mongodb",
  postgresql: "postgresql",
  mysql: "mysql",
  redis: "redis",
  supabase: "supabase",
  cloudflare: "cloudflare",
  netlify: "netlify",
  vercel: "vercel",
  docker: "docker",
  figma: "figma",
  webflow: "webflow",
  linkedin: "linkedin",
  twitter: "twitter",
  x: "x",
  twilio: "twilio",
  salesforce: "salesforce",
  zoom: "zoom",
  stripe: "stripe",
  hubspot: "hubspot",
  airtable: "airtable",
  asana: "asana",
  dropbox: "dropbox",
  box: "box",
  shopify: "shopify",
  zapier: "zapier",
  intercom: "intercom",
  zendesk: "zendesk",
  databricks: "databricks",
  snowflake: "snowflake",
  linear: "linear",
  spotify: "spotify",
  paypal: "paypal",
  apple: "apple",
  microsoft: "microsoft",
  meta: "meta",
  facebook: "facebook",
  instagram: "instagram",
  youtube: "youtube",
  twitch: "twitch",
  reddit: "reddit",
  tiktok: "tiktok",
};

/**
 * Normalize a brand/name string into a lower-case, alphanumeric token.
 */
function normalizeBrand(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Resolve a logos-apps SVG URL for a brand or product name.
 *
 * Returns `null` for empty/unknown input, or for brands explicitly marked as
 * having no logos-apps entry, so callers can keep their existing fallback chain.
 */
export function getLogosAppsUrl(name: string | undefined | null): string | null {
  if (!name) return null;
  const normalized = normalizeBrand(name);
  if (!normalized) return null;

  const alias = LOGOS_APPS_ALIASES[normalized];
  if (alias === null) return null;

  const slug = alias ?? normalized;
  return `${LOGOS_APPS_BASE}/${slug}.svg`;
}
