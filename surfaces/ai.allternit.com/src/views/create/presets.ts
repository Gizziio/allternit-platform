/**
 * Deterministic creation format presets.
 *
 * Mirrors the Kimi creation bar: each mode exposes a small, fixed set of
 * tabs/options so the model never has to guess the output type or constraints.
 * When the user sends, the selected preset is serialized into the prompt as
 * explicit instructions.
 */

export const CREATION_MODES = new Set<string>([
  'website',
  'docs',
  'data',
  'slides',
  'image',
  'video',
  'design',
]);

export function isCreationMode(modeId: string | null | undefined): boolean {
  return Boolean(modeId && CREATION_MODES.has(modeId));
}

export interface FormatOption {
  id: string;
  label: string;
  detail?: string;
  width?: number;
  height?: number;
  unit?: 'px' | 'cm';
}

export interface FormatTab {
  id: string;
  label: string;
  options: FormatOption[];
  allowCustom?: boolean;
}

export interface ModeFormatConfig {
  modeId: string;
  modeLabel: string;
  defaultTab: string;
  defaultOption: string;
  tabs: FormatTab[];
}

export const DESIGN_PRESETS: ModeFormatConfig = {
  modeId: 'design',
  modeLabel: 'Design',
  defaultTab: 'aspect-ratio',
  defaultOption: 'adaptive',
  tabs: [
    {
      id: 'aspect-ratio',
      label: 'Aspect Ratio',
      allowCustom: true,
      options: [
        { id: 'adaptive', label: 'Adaptive', detail: 'Smart canvas' },
        { id: '1-1', label: '1:1', detail: '1080 × 1080 px', width: 1080, height: 1080, unit: 'px' },
        { id: '16-9', label: '16:9', detail: '1280 × 720 px', width: 1280, height: 720, unit: 'px' },
        { id: '9-16', label: '9:16', detail: '720 × 1280 px', width: 720, height: 1280, unit: 'px' },
        { id: '4-3', label: '4:3', detail: '1280 × 960 px', width: 1280, height: 960, unit: 'px' },
        { id: '3-4', label: '3:4', detail: '960 × 1280 px', width: 960, height: 1280, unit: 'px' },
      ],
    },
    {
      id: 'resolution',
      label: 'Resolution',
      allowCustom: true,
      options: [
        { id: 'instagram-post', label: 'Instagram Post', detail: '1080 × 1350 px', width: 1080, height: 1350, unit: 'px' },
        { id: 'facebook-post', label: 'Facebook Post', detail: '1200 × 630 px', width: 1200, height: 630, unit: 'px' },
        { id: 'linkedin-post', label: 'LinkedIn Post', detail: '1200 × 1200 px', width: 1200, height: 1200, unit: 'px' },
        { id: 'twitter-post', label: 'Twitter/X Post', detail: '1600 × 900 px', width: 1600, height: 900, unit: 'px' },
        { id: 'youtube-thumb', label: 'YouTube Thumbnail', detail: '1280 × 720 px', width: 1280, height: 720, unit: 'px' },
      ],
    },
    {
      id: 'print',
      label: 'Print',
      allowCustom: true,
      options: [
        { id: 'a4-portrait', label: 'A4 Portrait', detail: '21 × 29.7 cm', width: 21, height: 29.7, unit: 'cm' },
        { id: 'a4-landscape', label: 'A4 Landscape', detail: '29.7 × 21 cm', width: 29.7, height: 21, unit: 'cm' },
        { id: 'a3-portrait', label: 'A3 Portrait', detail: '29.7 × 42 cm', width: 29.7, height: 42, unit: 'cm' },
        { id: 'a3-landscape', label: 'A3 Landscape', detail: '42 × 29.7 cm', width: 42, height: 29.7, unit: 'cm' },
      ],
    },
  ],
};

export const DOCS_PRESETS: ModeFormatConfig = {
  modeId: 'docs',
  modeLabel: 'Docs',
  defaultTab: 'type',
  defaultOption: 'proposal',
  tabs: [
    {
      id: 'type',
      label: 'Type',
      options: [
        { id: 'memo', label: 'Memo', detail: 'Short internal note' },
        { id: 'proposal', label: 'Proposal', detail: 'Scope, timeline, budget' },
        { id: 'report', label: 'Report', detail: 'Evidence-backed long-form' },
        { id: 'prd', label: 'PRD', detail: 'Requirements & acceptance criteria' },
        { id: 'letter', label: 'Letter', detail: 'Formal correspondence' },
        { id: 'brief', label: 'Brief', detail: 'Creative or project brief' },
      ],
    },
    {
      id: 'tone',
      label: 'Tone',
      options: [
        { id: 'formal', label: 'Formal', detail: 'Professional and precise' },
        { id: 'casual', label: 'Casual', detail: 'Conversational and friendly' },
        { id: 'technical', label: 'Technical', detail: 'Dense and exact' },
        { id: 'executive', label: 'Executive', detail: 'Concise, top-line only' },
      ],
    },
    {
      id: 'length',
      label: 'Length',
      options: [
        { id: 'short', label: 'Short', detail: '~1 page' },
        { id: 'medium', label: 'Medium', detail: '~3 pages' },
        { id: 'long', label: 'Long', detail: '~6+ pages' },
      ],
    },
  ],
};

export const DATA_PRESETS: ModeFormatConfig = {
  modeId: 'data',
  modeLabel: 'Sheets',
  defaultTab: 'type',
  defaultOption: 'budget',
  tabs: [
    {
      id: 'type',
      label: 'Type',
      options: [
        { id: 'budget', label: 'Budget', detail: 'Income, expenses, totals' },
        { id: 'forecast', label: 'Forecast', detail: 'Projections with assumptions' },
        { id: 'inventory', label: 'Inventory', detail: 'Items, counts, values' },
        { id: 'analysis', label: 'Analysis', detail: 'Profiling and segmentation' },
        { id: 'tracker', label: 'Tracker', detail: 'Tasks, owners, status' },
      ],
    },
    {
      id: 'sheets',
      label: 'Sheets',
      options: [
        { id: '1', label: '1 sheet', detail: 'Single worksheet' },
        { id: '3', label: '3 sheets', detail: 'Summary + details' },
        { id: '5', label: '5 sheets', detail: 'Multi-tab workbook' },
      ],
    },
    {
      id: 'charts',
      label: 'Charts',
      options: [
        { id: 'none', label: 'None', detail: 'Data only' },
        { id: 'summary', label: 'Summary', detail: '1–2 key charts' },
        { id: 'full', label: 'Full', detail: 'Charts per section' },
      ],
    },
  ],
};

export const SLIDES_PRESETS: ModeFormatConfig = {
  modeId: 'slides',
  modeLabel: 'Slides',
  defaultTab: 'type',
  defaultOption: 'pitch',
  tabs: [
    {
      id: 'type',
      label: 'Type',
      options: [
        { id: 'pitch', label: 'Pitch', detail: 'Investor or sales deck' },
        { id: 'report', label: 'Report', detail: 'Status or research deck' },
        { id: 'training', label: 'Training', detail: 'Onboarding or tutorial' },
        { id: 'campaign', label: 'Campaign', detail: 'Launch or marketing deck' },
      ],
    },
    {
      id: 'slides',
      label: 'Slides',
      options: [
        { id: '5', label: '5 slides', detail: 'Lightning' },
        { id: '10', label: '10 slides', detail: 'Standard' },
        { id: '15', label: '15 slides', detail: 'Detailed' },
        { id: '20', label: '20 slides', detail: 'Deep' },
      ],
    },
    {
      id: 'theme',
      label: 'Theme',
      options: [
        { id: 'minimal', label: 'Minimal', detail: 'Clean typography' },
        { id: 'bold', label: 'Bold', detail: 'High contrast' },
        { id: 'editorial', label: 'Editorial', detail: 'Magazine-style' },
        { id: 'technical', label: 'Technical', detail: 'Diagrams and data' },
      ],
    },
  ],
};

export const WEBSITE_PRESETS: ModeFormatConfig = {
  modeId: 'website',
  modeLabel: 'Websites',
  defaultTab: 'stack',
  defaultOption: 'nextjs',
  tabs: [
    {
      id: 'stack',
      label: 'Stack',
      options: [
        { id: 'nextjs', label: 'Next.js', detail: 'App Router + React' },
        { id: 'react', label: 'React', detail: 'Vite + React' },
        { id: 'html', label: 'HTML', detail: 'Vanilla static site' },
      ],
    },
    {
      id: 'pages',
      label: 'Pages',
      options: [
        { id: '1', label: 'Landing', detail: 'Single page' },
        { id: '3', label: '3 pages', detail: 'Home, about, contact' },
        { id: '5', label: '5 pages', detail: 'Small site' },
      ],
    },
    {
      id: 'style',
      label: 'Style',
      options: [
        { id: 'modern', label: 'Modern', detail: 'Clean, minimal' },
        { id: 'corporate', label: 'Corporate', detail: 'Professional, structured' },
        { id: 'creative', label: 'Creative', detail: 'Bold, expressive' },
      ],
    },
  ],
};

export const IMAGE_PRESETS: ModeFormatConfig = {
  modeId: 'image',
  modeLabel: 'Image',
  defaultTab: 'provider',
  defaultOption: 'pollinations',
  tabs: [
    {
      id: 'provider',
      label: 'Provider',
      options: [
        { id: 'pollinations', label: 'Pollinations', detail: 'Free FLUX images, no key' },
        { id: 'cloudflare', label: 'Cloudflare', detail: 'FLUX.1-schnell free tier' },
        { id: 'huggingface', label: 'HuggingFace', detail: 'Free read-token inference' },
        { id: 'nvidia', label: 'NVIDIA NIM', detail: 'Free trial API key' },
        { id: 'gemini-nano-banana', label: 'Gemini', detail: 'Google AI Studio free tier' },
        { id: 'seed-dance', label: 'Seed.Dance', detail: 'Requires configured endpoint' },
        { id: 'openai', label: 'DALL-E 3', detail: 'OpenAI API key' },
        { id: 'bonsai-local', label: 'Bonsai Local', detail: 'Loopback companion' },
        { id: 'bonsai-webgpu', label: 'Bonsai WebGPU', detail: 'Fast local GPU' },
      ],
    },
    {
      id: 'aspect-ratio',
      label: 'Aspect Ratio',
      options: [
        { id: 'square', label: '1:1', detail: '1080 × 1080 px', width: 1080, height: 1080, unit: 'px' },
        { id: 'landscape', label: '16:9', detail: '1920 × 1080 px', width: 1920, height: 1080, unit: 'px' },
        { id: 'portrait', label: '9:16', detail: '1080 × 1920 px', width: 1080, height: 1920, unit: 'px' },
        { id: 'vertical', label: '4:5', detail: '1080 × 1350 px', width: 1080, height: 1350, unit: 'px' },
      ],
    },
    {
      id: 'style',
      label: 'Style',
      options: [
        { id: 'photographic', label: 'Photographic', detail: 'Realistic' },
        { id: 'illustration', label: 'Illustration', detail: 'Drawn or painted' },
        { id: '3d', label: '3D Render', detail: 'Cinematic CGI' },
        { id: 'abstract', label: 'Abstract', detail: 'Non-figurative' },
      ],
    },
  ],
};

export const VIDEO_PRESETS: ModeFormatConfig = {
  modeId: 'video',
  modeLabel: 'Video',
  defaultTab: 'provider',
  defaultOption: 'pollinations',
  tabs: [
    {
      id: 'provider',
      label: 'Provider',
      options: [
        { id: 'pollinations', label: 'Pollinations', detail: 'Free T2V/I2V, no key' },
        { id: 'replicate', label: 'Replicate', detail: 'Model aggregator' },
        { id: 'fal', label: 'fal.ai', detail: 'Fast inference API' },
        { id: 'huggingface', label: 'HuggingFace', detail: 'Free read-token inference' },
        { id: 'minimax', label: 'MiniMax', detail: 'Hailuo T2V/I2V' },
        { id: 'kling', label: 'Kling', detail: 'Cinematic clips' },
        { id: 'runway', label: 'Runway', detail: 'Gen-2 / Gen-3' },
        { id: 'pika', label: 'Pika', detail: 'Short stylized clips' },
        { id: 'luma', label: 'Luma', detail: 'Dream Machine' },
        { id: 'stability', label: 'Stability', detail: 'Stable Video Diffusion' },
        { id: 'custom', label: 'Custom', detail: 'BYO OpenAI-compatible endpoint' },
      ],
    },
    {
      id: 'duration',
      label: 'Duration',
      options: [
        { id: '6s', label: '6 seconds', detail: 'Short clip' },
        { id: '15s', label: '15 seconds', detail: 'Social spot' },
        { id: '30s', label: '30 seconds', detail: 'Ad length' },
      ],
    },
    {
      id: 'style',
      label: 'Style',
      options: [
        { id: 'cinematic', label: 'Cinematic', detail: 'Film quality' },
        { id: 'product', label: 'Product', detail: 'Studio reveal' },
        { id: 'animated', label: 'Animated', detail: 'Motion graphics' },
      ],
    },
  ],
};

export const MODE_FORMAT_CONFIGS: Record<string, ModeFormatConfig> = {
  design: DESIGN_PRESETS,
  docs: DOCS_PRESETS,
  data: DATA_PRESETS,
  slides: SLIDES_PRESETS,
  website: WEBSITE_PRESETS,
  image: IMAGE_PRESETS,
  video: VIDEO_PRESETS,
};

export interface FormatSelection {
  modeId: string;
  tabId: string;
  optionId: string;
  custom?: { width: number; height: number; unit: 'px' | 'cm' } | null;
}

export function getDefaultFormatSelection(modeId: string): FormatSelection | null {
  const config = MODE_FORMAT_CONFIGS[modeId];
  if (!config) return null;
  return {
    modeId,
    tabId: config.defaultTab,
    optionId: config.defaultOption,
    custom: null,
  };
}

export function getSelectedOption(config: ModeFormatConfig, selection: FormatSelection): FormatOption | null {
  const tab = config.tabs.find((t) => t.id === selection.tabId);
  if (!tab) return null;
  return tab.options.find((o) => o.id === selection.optionId) ?? null;
}

export function formatSelectionToPromptBlock(selection: FormatSelection): string {
  const config = MODE_FORMAT_CONFIGS[selection.modeId];
  if (!config) return '';

  const tab = config.tabs.find((t) => t.id === selection.tabId);
  if (!tab) return '';

  const option = tab.options.find((o) => o.id === selection.optionId);
  const label = option?.label ?? (selection.custom ? 'Custom' : selection.optionId);

  const lines: string[] = [
    `[CREATE_MODE: ${selection.modeId}]`,
    `[FORMAT_TAB: ${tab.id}]`,
    `[FORMAT: ${option?.id ?? (selection.custom ? 'custom' : selection.optionId)}]`,
  ];

  if (selection.custom) {
    lines.push(`[CUSTOM_SIZE: ${selection.custom.width} × ${selection.custom.height} ${selection.custom.unit}]`);
  } else if (option?.detail) {
    lines.push(`[DETAIL: ${option.detail}]`);
  }

  return lines.join('\n');
}
