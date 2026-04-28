/**
 * Hyperdesign Registry
 * 
 * A marketplace of Design.md specifications that can be installed 
 * and applied to any Allternit agent or workspace.
 */

export interface DesignSystem {
  id: string;
  name: string;
  description: string;
  vibe: string;
  author: string;
  creatorHandle?: string;
  installs: number;
  likes?: number;
  views?: number;
  forks?: number;
  tags: string[];
  designMd: string;
  previewColors: string[]; // 3-4 hex codes for preview
}

export const DESIGN_MARKETPLACE: DesignSystem[] = [
  {
    id: 'vercel-precision',
    name: 'Vercel Precision',
    description: 'Black and white precision, high-contrast minimalism with Geist typography.',
    vibe: 'Engineering Excellence',
    author: 'Vercel community',
    installs: 4500,
    likes: 4500,
    views: 4500,
    forks: 4500,
    tags: ['minimalist', 'dark', 'monochrome'],
    previewColors: ['#000000', '#ffffff', 'var(--ui-text-inverse)'],
    designMd: `
# Brand: Vercel
## Intent
High-contrast minimalism focusing on speed and developer precision.
## Colors
- primary: #ffffff
- background: #000000
- surface: #111111
- text: #ededed
## Typography
- fontFamily: "Geist, Inter"
## Radii
- base: 6px
    `
  },
  {
    id: 'linear-pro',
    name: 'Linear Pro',
    description: 'Ultra-minimal, precise "engineering" aesthetic with signature purple accents.',
    vibe: 'Streamlined Productivity',
    author: 'Linear Fans',
    installs: 3200,
    likes: 3200,
    views: 3200,
    forks: 3200,
    tags: ['productivity', 'saas', 'purple'],
    previewColors: ['#0c0c0e', '#5e6ad2', '#151518'],
    designMd: `
# Brand: Linear
## Intent
Professional efficiency with deep focus states and refined transitions.
## Colors
- primary: #5e6ad2
- background: #0c0c0e
- surface: #151518
- text: #f7f8f8
## Typography
- fontFamily: "Inter, system-ui"
## Radii
- base: 4px
    `
  },
  {
    id: 'stripe-precision',
    name: 'Stripe Global',
    description: 'The industry standard for clean financial design and mesh gradients.',
    vibe: 'Financial Authority',
    author: 'Design Spec Standard',
    installs: 5600,
    likes: 5600,
    views: 5600,
    forks: 5600,
    tags: ['fintech', 'clean', 'white'],
    previewColors: ['#ffffff', '#635bff', '#f6f9fc'],
    designMd: `
# Brand: Stripe
## Intent
Clean, authoritative financial engineering with complex mesh backgrounds.
## Colors
- primary: #635bff
- background: #ffffff
- surface: #f6f9fc
- text: #1a1f36
## Typography
- fontFamily: "Sohne, Inter"
## Radii
- base: 8px
    `
  },
  {
    id: 'cursor-ai',
    name: 'Cursor Glow',
    description: 'Sleek dark interface with neon blue/purple gradient accents and AI-glow effects.',
    vibe: 'AI-Native IDE',
    author: 'Cursor community',
    installs: 1800,
    likes: 1800,
    views: 1800,
    forks: 1800,
    tags: ['ai', 'dark', 'glow'],
    previewColors: ['#0b0b0b', 'var(--status-info)', '#8b5cf6'],
    designMd: `
# Brand: Cursor
## Intent
AI-native development environment with high focus and vibrant activity states.
## Colors
- primary: #3b82f6
- background: #0b0b0b
- surface: #161616
- text: #d1d5db
## Typography
- fontFamily: "JetBrains Mono, Inter"
## Radii
- base: 8px
    `
  },
  {
    id: 'raycast-density',
    name: 'Raycast Chrome',
    description: 'Sleek dark chrome, vibrant gradient icons, keyboard-centric density.',
    vibe: 'Spotlight Search',
    author: 'Raycast Fans',
    installs: 2100,
    likes: 2100,
    views: 2100,
    forks: 2100,
    tags: ['density', 'dark', 'utility'],
    previewColors: ['#1c1c1e', '#ff6363', '#2c2c2e'],
    designMd: `
# Brand: Raycast
## Intent
Compact, efficient launcher-style UI with vibrant status indicators.
## Colors
- primary: #ff6363
- background: #1c1c1e
- surface: #2c2c2e
- text: #ffffff
## Typography
- fontFamily: "Inter, system-ui"
## Radii
- base: 10px
    `
  },
  {
    id: 'supabase-emerald',
    name: 'Supabase Emerald',
    description: 'Dark emerald theme with a sharp, code-first industrial layout.',
    vibe: 'Backend Authority',
    author: 'Supabase community',
    installs: 1500,
    likes: 1500,
    views: 1500,
    forks: 1500,
    tags: ['dev-tools', 'emerald', 'dark'],
    previewColors: ['#1c1c1c', '#3ecf8e', '#2a2a2a'],
    designMd: `
# Brand: Supabase
## Intent
Industrial-grade backend management with high accessibility and clear hierarchy.
## Colors
- primary: #3ecf8e
- background: #1c1c1c
- surface: #2a2a2a
- text: #ededed
## Typography
- fontFamily: "Geist Mono, Inter"
## Radii
- base: 2px
    `
  },
  {
    id: 'apple-cinematic',
    name: 'Apple Cinematic',
    description: 'Premium white space, SF Pro typography, and cinematic product imagery.',
    vibe: 'Modern Classic',
    author: 'Cupertino Design',
    installs: 8900,
    likes: 8900,
    views: 8900,
    forks: 8900,
    tags: ['premium', 'classic', 'clean'],
    previewColors: ['#fbfbfd', '#000000', '#ffffff'],
    designMd: `
# Brand: Apple
## Intent
Premium, focused, and emotional design with extreme attention to detail.
## Colors
- primary: #000000
- background: #fbfbfd
- surface: #ffffff
- text: #1d1d1f
## Typography
- fontFamily: "SF Pro, Inter"
## Radii
- base: 12px
    `
  },
  {
    id: 'ollama-terminal',
    name: 'Ollama Monochrome',
    description: 'Terminal-native, stark black/white, monospace-first simplicity.',
    vibe: 'Local AI',
    author: 'Ollama Fans',
    installs: 1200,
    likes: 1200,
    views: 1200,
    forks: 1200,
    tags: ['monochrome', 'terminal', 'minimalist'],
    previewColors: ['#000000', '#ffffff', 'var(--ui-text-inverse)'],
    designMd: `
# Brand: Ollama
## Intent
Simple, brutalist, and functional local model orchestration.
## Colors
- primary: #ffffff
- background: #000000
- surface: #0a0a0a
- text: #ffffff
## Typography
- fontFamily: "Geist Mono, system-ui"
## Radii
- base: 0px
    `
  },
  {
    id: 'mistral-minimal',
    name: 'Mistral French-Pro',
    description: 'French-engineered minimalism with deep purple tones and clean serif headings.',
    vibe: 'Sophisticated AI',
    author: 'Mistral community',
    installs: 950,
    likes: 950,
    views: 950,
    forks: 950,
    tags: ['minimalist', 'purple', 'elegant'],
    previewColors: ['var(--ui-text-inverse)', '#7c3aed', 'var(--ui-text-inverse)'],
    designMd: `
# Brand: Mistral AI
## Intent
Sophisticated, academic yet powerful AI orchestration with refined serif touches.
## Colors
- primary: #7c3aed
- background: #0a0a0a
- surface: #111111
- text: #f3f4f6
## Typography
- fontFamily: "Instrument Serif, Inter"
## Radii
- base: 4px
    `
  },
  {
    id: 'runway-media',
    name: 'Runway Cinematic',
    description: 'Cinematic dark UI, media-rich, heavy use of overlays and blurs.',
    vibe: 'Creative Motion',
    author: 'Runway Fans',
    installs: 1100,
    likes: 1100,
    views: 1100,
    forks: 1100,
    tags: ['creative', 'dark', 'blurs'],
    previewColors: ['#050505', '#ffffff', 'var(--ui-border-default)'],
    designMd: `
# Brand: Runway
## Intent
A playground for creative generation focusing on media immersion and overlays.
## Colors
- primary: #ffffff
- background: #050505
- surface: rgba(255, 255, 255, 0.05)
- text: #ffffff
## Typography
- fontFamily: "Inter, system-ui"
## Radii
- base: 20px
    `
  },
  {
    id: 'perplexity-clean',
    name: 'Perplexity Search',
    description: 'Clean search-centric layout, neutral tones, focus on readability.',
    vibe: 'Curious Discovery',
    author: 'Perplexity Fans',
    installs: 2500,
    likes: 2500,
    views: 2500,
    forks: 2500,
    tags: ['search', 'clean', 'readable'],
    previewColors: ['#ffffff', 'var(--status-success)', '#f9fafb'],
    designMd: `
# Brand: Perplexity
## Intent
High-clarity information discovery with a focus on sources and speed.
## Colors
- primary: #22c55e
- background: #ffffff
- surface: #f9fafb
- text: #0f172a
## Typography
- fontFamily: "Inter, sans-serif"
## Radii
- base: 6px
    `
  },
  {
    id: 'resend-minimal',
    name: 'Resend Utility',
    description: 'Minimalist dark theme with monospace accents and "developer-utility" aesthetic.',
    vibe: 'Developer Tooling',
    author: 'Resend community',
    installs: 1300,
    likes: 1300,
    views: 1300,
    forks: 1300,
    tags: ['minimalist', 'dark', 'developer'],
    previewColors: ['#000000', '#ffffff', 'var(--ui-text-inverse)'],
    designMd: `
# Brand: Resend
## Intent
Stark, functional developer utility focusing on documentation and delivery.
## Colors
- primary: #ffffff
- background: #000000
- surface: #0a0a0a
- text: #ededed
## Typography
- fontFamily: "Geist, JetBrains Mono"
## Radii
- base: 2px
    `
  },
  {
    id: 'voltagent-dark',
    name: 'VoltAgent Void',
    description: 'Void-black canvas, emerald accents, and terminal-style borders.',
    vibe: 'Hyper-Agentic',
    author: 'VoltAgent Core',
    installs: 450,
    likes: 450,
    views: 450,
    forks: 450,
    tags: ['agentic', 'dark', 'emerald'],
    previewColors: ['#000000', 'var(--status-success)', '#050505'],
    designMd: `
# Brand: VoltAgent
## Intent
Cutting-edge AI orchestration with a "stealth-op" industrial look.
## Colors
- primary: #10b981
- background: #000000
- surface: #050505
- text: #10b981
## Typography
- fontFamily: "Monaspace Neon, monospace"
## Radii
- base: 0px
    `
  },
  {
    id: 'airbnb-rounded',
    name: 'Airbnb Warm',
    description: 'Warm coral accents, photography-driven, heavily rounded UI (24px+).',
    vibe: 'Friendly Living',
    author: 'Travel Design',
    installs: 1400,
    likes: 1400,
    views: 1400,
    forks: 1400,
    tags: ['friendly', 'rounded', 'white'],
    previewColors: ['#ffffff', '#ff385c', '#ffffff'],
    designMd: `
# Brand: Airbnb
## Intent
Approachable, human-centric design with high-quality spacing and rounded corners.
## Colors
- primary: #ff385c
- background: #ffffff
- surface: #ffffff
- text: #222222
## Typography
- fontFamily: "Inter, Circular"
## Radii
- base: 24px
    `
  },
  {
    id: 'linear-purple',
    name: 'Linear Cosmic',
    description: 'A more vibrant variation of Linear with cosmic purple blurs.',
    vibe: 'Deep Productivity',
    author: 'Linear Fans',
    installs: 1600,
    likes: 1600,
    views: 1600,
    forks: 1600,
    tags: ['cosmic', 'purple', 'dark'],
    previewColors: ['#020204', '#bb86fc', '#08080a'],
    designMd: `
# Brand: Linear Cosmic
## Intent
Deep, immersive productivity with atmospheric lighting.
## Colors
- primary: #bb86fc
- background: #020204
- surface: #08080a
- text: #e8e0d8
## Typography
- fontFamily: "Inter, system-ui"
## Radii
- base: 6px
    `
  },
  {
    id: 'happy-hues-1',
    name: 'Happy Hues: Energizing',
    description: 'A vibrant, high-energy palette for apps that need to feel alive.',
    vibe: 'High Energy',
    author: 'Happy Hues',
    installs: 3400,
    likes: 3400,
    views: 3400,
    forks: 3400,
    tags: ['curated', 'colors', 'vibrant'],
    previewColors: ['#fffffe', '#ff8906', '#f25f4c'],
    designMd: `
# Brand: Happy Hues Energizing
## Intent
High-energy vibrant user experience.
## Colors
- primary: #ff8906
- background: #fffffe
- surface: #f25f4c
- text: #0f0e17
## Typography
- fontFamily: "Space Grotesk, sans-serif"
## Radii
- base: 12px
    `
  },
  {
    id: 'happy-hues-2',
    name: 'Happy Hues: Focused',
    description: 'A calm, professional palette for productivity and deep work.',
    vibe: 'Productivity',
    author: 'Happy Hues',
    installs: 2800,
    likes: 2800,
    views: 2800,
    forks: 2800,
    tags: ['curated', 'colors', 'calm'],
    previewColors: ['#0f0e17', '#ff8906', '#f25f4c'],
    designMd: `
# Brand: Happy Hues Focused
## Intent
Calm professional productivity.
## Colors
- primary: #ff8906
- background: #0f0e17
- surface: #2e2f3e
- text: #fffffe
## Typography
- fontFamily: "Inter, sans-serif"
## Radii
- base: 6px
    `
  },
  {
    id: 'kami-editorial',
    name: 'Kami Editorial',
    description: 'High-end "AI Native Docs" aesthetic with warm parchment and ink-blue precision.',
    vibe: 'Editorial Authority',
    author: 'tw93 / Kami',
    installs: 150,
    likes: 150,
    views: 150,
    forks: 150,
    tags: ['docs', 'editorial', 'clean', 'serif'],
    previewColors: ['#f5f4ed', '#1B365D', '#f5f4ed'],
    designMd: `
# Brand: Kami
## Intent
Professional AI-composed documentation that feels like high-end printed matter.
Consistency over creativity.
## Colors
- primary: #1B365D
- background: #f5f4ed
- surface: #ffffff
- text: #1B365D
- muted: rgba(27, 54, 93, 0.4)
## Typography
- fontFamily: "Charter, YuMincho, serif"
- baseSize: 16px
- headingScale: 1.1
## Radii
- base: 2px
- card: 4px
    `
  }
];

export function getDesignById(id: string): DesignSystem | undefined {
  return DESIGN_MARKETPLACE.find(d => d.id === id);
}

export function searchDesigns(query: string): DesignSystem[] {
  const lower = query.toLowerCase();
  return DESIGN_MARKETPLACE.filter(d => 
    d.name.toLowerCase().includes(lower) || 
    d.description.toLowerCase().includes(lower) ||
    d.tags.some(t => t.toLowerCase().includes(lower))
  );
}
