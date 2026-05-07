/**
 * Built-in design direction library.
 *
 * Ported from nexu-io/open-design. When the user has no brand spec and picks
 * "Pick a direction for me" in the discovery form, the agent emits a second
 * <question-form id="direction"> with direction-cards. Each card carries a
 * deterministic OKLch palette + font stack + layout posture so the agent
 * never improvises a visual from scratch.
 *
 * Adding a new direction: append to `DESIGN_DIRECTIONS`. It appears in the
 * picker automatically — keep them visually distinct.
 */

export interface DesignDirection {
  id: string;
  label: string;
  mood: string;
  references: string[];
  displayFont: string;
  bodyFont: string;
  monoFont?: string;
  palette: {
    bg: string;
    surface: string;
    fg: string;
    muted: string;
    border: string;
    accent: string;
  };
  posture: string[];
}

export const DESIGN_DIRECTIONS: DesignDirection[] = [
  {
    id: 'editorial-monocle',
    label: 'Editorial — Monocle / FT magazine',
    mood: 'Print-magazine feel. Generous whitespace, large serif headlines, restrained palette of off-white paper + ink + a single warm accent. Confident, quietly intelligent.',
    references: ['Monocle', 'The Financial Times Weekend', 'NYT Magazine', "It's Nice That"],
    displayFont: "'Iowan Old Style', 'Charter', Georgia, serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    palette: {
      bg:      'oklch(97% 0.012 80)',
      surface: 'oklch(99% 0.005 80)',
      fg:      'oklch(20% 0.02 60)',
      muted:   'oklch(48% 0.015 60)',
      border:  'oklch(89% 0.012 80)',
      accent:  'oklch(58% 0.16 35)',
    },
    posture: [
      'serif display, sans body, mono for metadata only',
      'no shadows, no rounded cards — borders + whitespace do the work',
      'one decisive image, cropped only at the bottom',
      'kicker / eyebrow in mono uppercase, one accent color, used at most twice',
    ],
  },
  {
    id: 'modern-minimal',
    label: 'Modern minimal — Linear / Vercel',
    mood: 'Quiet, precise, software-native. System fonts, near-greyscale palette, a single saturated accent. The chrome disappears so content is the only thing that registers.',
    references: ['Linear', 'Vercel', 'Notion 2024', 'Stripe docs'],
    displayFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    palette: {
      bg:      'oklch(99% 0.002 240)',
      surface: 'oklch(100% 0 0)',
      fg:      'oklch(18% 0.012 250)',
      muted:   'oklch(54% 0.012 250)',
      border:  'oklch(92% 0.005 250)',
      accent:  'oklch(58% 0.18 255)',
    },
    posture: [
      'tight letter-spacing on display sizes (-0.02em)',
      'hairline borders only, no shadows except dropdowns/modals',
      'mono numerics with `font-variant-numeric: tabular-nums`',
      'sticky frosted nav, content-led layouts (no hero illustrations)',
      'one accent: links + primary CTA, nothing else',
    ],
  },
  {
    id: 'warm-soft',
    label: 'Warm & soft — Stripe pre-2020 / Headspace',
    mood: 'Cream backgrounds, soft accent, gentle radii. Reads like a thoughtful product magazine — friendly without being cute. Good for fintech, wellness, indie SaaS.',
    references: ['Stripe pre-2020', 'Headspace', 'Substack', 'Mercury'],
    displayFont: "'Tiempos Headline', 'Newsreader', 'Iowan Old Style', Georgia, serif",
    bodyFont: "'Söhne', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    palette: {
      bg:      'oklch(97% 0.018 70)',
      surface: 'oklch(99% 0.008 70)',
      fg:      'oklch(22% 0.02 50)',
      muted:   'oklch(50% 0.018 50)',
      border:  'oklch(90% 0.014 70)',
      accent:  'oklch(64% 0.13 28)',
    },
    posture: [
      'serif display, soft sans body',
      'gentle radii (12–16px), no hard 0px corners on content cards',
      'single accent used for primary CTA + one editorial flourish',
      'soft inner glow on hero cards rather than drop shadows',
      'avoid icons; use real screenshots / photographs / illustrations',
    ],
  },
  {
    id: 'tech-utility',
    label: 'Tech / utility — Datadog / GitHub',
    mood: 'Data-dense, monospace-friendly, dark or light + grid. Made for engineers and operators who want information per square inch, not vibes.',
    references: ['Datadog', 'GitHub', 'Cloudflare dashboard', 'Sentry'],
    displayFont: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
    monoFont: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
    palette: {
      bg:      'oklch(98% 0.005 250)',
      surface: 'oklch(100% 0 0)',
      fg:      'oklch(22% 0.02 240)',
      muted:   'oklch(50% 0.018 240)',
      border:  'oklch(90% 0.008 240)',
      accent:  'oklch(58% 0.16 145)',
    },
    posture: [
      'sans display + sans body (one family) is OK here — utility trumps editorial',
      'tabular numerics everywhere, mono for code / IDs / hashes',
      'dense tables with hairline borders, no row striping',
      'inline status pills (success / warn / danger) with restrained tinted backgrounds',
      'avoid: hero images, oversized headlines, marketing copy — show the product instead',
    ],
  },
  {
    id: 'brutalist-experimental',
    label: 'Brutalist / experimental — Are.na / Yale',
    mood: 'Loud type. Visible grid. System sans + a single oversized serif. Deliberate ugliness as confidence. Great for art, indie, agency, manifesto pages.',
    references: ['Are.na', 'Yale Center for British Art', 'mschf', 'Read.cv'],
    displayFont: "'Times New Roman', 'Iowan Old Style', Georgia, serif",
    bodyFont: "ui-monospace, 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace",
    palette: {
      bg:      'oklch(96% 0.004 100)',
      surface: 'oklch(100% 0 0)',
      fg:      'oklch(15% 0.02 100)',
      muted:   'oklch(40% 0.02 100)',
      border:  'oklch(15% 0.02 100)',
      accent:  'oklch(60% 0.22 25)',
    },
    posture: [
      'display = serif at extreme sizes (clamp(80px, 12vw, 200px))',
      'body = monospace — yes, monospace as body, deliberately',
      'borders are full-strength fg (1.5–2px), not muted greys',
      'asymmetric layouts: one column 70%, the other 30%',
      'almost no border-radius (0–2px). No shadows. No gradients.',
      'underline links, no hover decoration — let the typography carry it',
    ],
  },

  // ─── Huashu philosophy schools (ported from alchaincyf/huashu-design) ──────

  {
    id: 'cartographic-stamen',
    label: 'Cartographic — Stamen / data poetry',
    mood: 'Layered like topographic maps. Algorithm-generated organic shapes, warm earth tones, a hand-crafted feel beneath the digital precision. Ideal for data journalism, climate, and urban research.',
    references: ['Stamen Design', 'The Pudding', 'FlowingData', 'Datawrapper'],
    displayFont: "'Newsreader', 'Iowan Old Style', Georgia, serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    palette: {
      bg:      'oklch(95% 0.022 68)',
      surface: 'oklch(97% 0.014 68)',
      fg:      'oklch(22% 0.025 55)',
      muted:   'oklch(50% 0.022 55)',
      border:  'oklch(88% 0.018 68)',
      accent:  'oklch(52% 0.13 152)',
    },
    posture: [
      'organic layered shapes — topographic contours, not flat cards',
      'warm terracotta / sage / deep blue tricolor — never pure #000',
      'hand-crafted feel: slight imperfection in curves and weight',
      'soft shadows and depth — multiple z-levels of information',
      'data visualization is the hero; typography is supportive',
    ],
  },
  {
    id: 'content-first-ia',
    label: 'Content-first — Information Architects / iA Writer',
    mood: 'Content is architecture. System fonts, blue hyperlinks, 66-char line length. Designed for reading, not impressing. Every pixel earns its place by clarifying the text.',
    references: ['iA Writer', 'Information Architects', 'Gwern.net', 'Craig Mod'],
    displayFont: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    bodyFont: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
    palette: {
      bg:      'oklch(100% 0 0)',
      surface: 'oklch(98% 0.003 240)',
      fg:      'oklch(15% 0.01 250)',
      muted:   'oklch(50% 0.01 250)',
      border:  'oklch(92% 0.005 240)',
      accent:  'oklch(40% 0.25 265)',
    },
    posture: [
      'zero decorative elements — every element is load-bearing content',
      'classic blue hyperlinks (oklch(40% 0.25 265) ≈ #0000EE territory)',
      '66-character line length for body text; never stretch to full width',
      'progressive disclosure: table of contents → section → paragraph',
      'system fonts only — loading a web font is a performance statement',
    ],
  },
  {
    id: 'parallax-locomotive',
    label: 'Parallax narrative — Locomotive / cinematic scroll',
    mood: 'Scrolling is a journey, not browsing. Film-like scene composition, bold type emerging from darkness, strategic glowing accents. Each section full-viewport tall, unhurried.',
    references: ['Locomotive Scroll', 'Lusion.co', 'Obys Agency', 'Priceless.com'],
    displayFont: "'Montserrat', 'Neue Montreal', system-ui, sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    palette: {
      bg:      'oklch(10% 0.008 250)',
      surface: 'oklch(14% 0.01 250)',
      fg:      'oklch(95% 0.005 80)',
      muted:   'oklch(55% 0.01 250)',
      border:  'oklch(22% 0.01 250)',
      accent:  'oklch(80% 0.18 85)',
    },
    posture: [
      'dark mode only — background near oklch(10%); never pure #000 or cold navy',
      'hero sections are full-viewport (100vh min); never shorter',
      'typography emerges from darkness — light on dark for display',
      'one glowing accent: treat as a focal light source, not a button color',
      'parallax depth: three z-layers minimum (bg texture, mid content, fg type)',
    ],
  },
  {
    id: 'webgl-activetheory',
    label: 'WebGL / particles — Active Theory / deep space',
    mood: 'Data as a living universe. Particle systems, neon gradients on deep space, mouse-reactive environments. Technology made visible — and beautiful.',
    references: ['Active Theory', 'NASA Prospect', 'Google ATAP', 'Unit9'],
    displayFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'Space Grotesk', -apple-system, system-ui, sans-serif",
    monoFont: "'DM Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
    palette: {
      bg:      'oklch(8% 0.015 270)',
      surface: 'oklch(12% 0.018 270)',
      fg:      'oklch(94% 0.008 180)',
      muted:   'oklch(52% 0.015 270)',
      border:  'oklch(20% 0.02 270)',
      accent:  'oklch(74% 0.26 196)',
    },
    posture: [
      'deep space background — near-black with a blue-violet undertone',
      'accent = electric cyan or magenta; never warm tones in this direction',
      'glassmorphism panels floating over a particle or mesh background',
      'tabular-nums mono for all data — numbers are part of the art',
      'depth of field: UI elements at different opacity levels suggest z-depth',
    ],
  },
  {
    id: 'generative-field',
    label: 'Generative / algorithmic — Field.io',
    mood: 'Code is the designer. Abstract geometry, Voronoi diagrams, mathematical precision — yet every execution subtly unique. Monochrome base, one vibrant accent, computational feel.',
    references: ['Field.io', 'British Council digital', 'Casey Reas', 'Refik Anadol'],
    displayFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    bodyFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    monoFont: "ui-monospace, 'IBM Plex Mono', Menlo, monospace",
    palette: {
      bg:      'oklch(97% 0.003 250)',
      surface: 'oklch(100% 0 0)',
      fg:      'oklch(12% 0.008 250)',
      muted:   'oklch(50% 0.01 250)',
      border:  'oklch(88% 0.005 250)',
      accent:  'oklch(65% 0.28 320)',
    },
    posture: [
      'geometric patterns: Voronoi, Delaunay, L-systems — never freehand curves',
      'mathematical spacing: 8pt base grid, column ratios from golden ratio (φ 1.618)',
      'monochromatic base with one vibrant accent — accent is pure signal',
      'typography: rationalist grotesque (Helvetica or equivalent), tight and neutral',
      'no photography; abstract computation output is the image',
    ],
  },
  {
    id: 'gamified-resn',
    label: 'Gamified narrative — Resn / interactive storytelling',
    mood: 'Every click advances the story. Illustrative style meets product UI, warm palette despite tech subject, progress indicators that feel earned. Scroll-triggered reveals, character-driven.',
    references: ['Resn', 'Jam3', 'Hello Monday', 'Active Theory'],
    displayFont: "'Fraunces', 'Playfair Display', Georgia, serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    palette: {
      bg:      'oklch(20% 0.03 260)',
      surface: 'oklch(26% 0.025 260)',
      fg:      'oklch(94% 0.01 80)',
      muted:   'oklch(58% 0.015 260)',
      border:  'oklch(32% 0.02 260)',
      accent:  'oklch(76% 0.15 68)',
    },
    posture: [
      'dark base with warm accent — approachable warmth, not cold tech darkness',
      'progress indicators that feel earned (counters, unlock reveals, stars)',
      'editorial illustration for hero moments — no stock photography',
      'scroll-triggered animation: each section enters like a new scene',
      'character-driven copy — first-person, narrative, emotionally specific',
    ],
  },
  {
    id: 'monogram-jetset',
    label: 'Conceptual minimal — Experimental Jetset / Whitney',
    mood: 'One idea = one form. Primary colors (red/blue/yellow) + black/white only. Typography is the main graphic element, not support for imagery. Anti-commercial, honest.',
    references: ['Experimental Jetset', 'Whitney Museum identity', 'Werkplaats Typografie', 'Mevis & van Deursen'],
    displayFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    bodyFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    palette: {
      bg:      'oklch(100% 0 0)',
      surface: 'oklch(97% 0 0)',
      fg:      'oklch(10% 0 0)',
      muted:   'oklch(45% 0 0)',
      border:  'oklch(10% 0 0)',
      accent:  'oklch(50% 0.26 25)',
    },
    posture: [
      'primary colors only — red, blue, or yellow + black/white. No muted intermediates.',
      'typography IS the graphic — no decorative imagery, only type and geometry',
      'grid-based with one deliberate rule break that becomes the design signature',
      'no border-radius — right angles everywhere, including buttons',
      'borders are full-strength black (2px solid), never muted grey',
    ],
  },
  {
    id: 'swiss-brockmann',
    label: 'Swiss grid — Müller-Brockmann / objective rationalism',
    mood: 'Objectivity as beauty. Mathematical 8pt baseline grid, strict alignment, two-color maximum. The grid is not a constraint — it is the design.',
    references: ['Josef Müller-Brockmann', 'Armin Hofmann', 'Neue Grafik', 'Basel School'],
    displayFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    bodyFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    palette: {
      bg:      'oklch(100% 0 0)',
      surface: 'oklch(98% 0 0)',
      fg:      'oklch(8% 0 0)',
      muted:   'oklch(42% 0 0)',
      border:  'oklch(8% 0 0)',
      accent:  'oklch(55% 0.24 25)',
    },
    posture: [
      '8pt baseline grid: all vertical spacing is a multiple of 8',
      'strict alignment: flush-left or centered — never justified, never mixed',
      'two colors maximum: black + one accent (or black-only for full purity)',
      'no decorative elements — every line must carry information',
      'type scale: 10 / 14 / 20 / 28 / 40 / 56px (ratio ≈ √2)',
    ],
  },
  {
    id: 'luxury-build',
    label: 'Luxury minimal — Build / high-end brand',
    mood: 'Refined simplicity is harder than complexity. 70%+ whitespace, subtle weight contrast (200 → 600), golden ratio proportions. Quiet authority — no decoration needed.',
    references: ['Build Studio London', 'Winkreative', 'Muji', 'Céline'],
    displayFont: "'Cormorant Garamond', 'Libre Baskerville', Georgia, serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    palette: {
      bg:      'oklch(99% 0.004 80)',
      surface: 'oklch(100% 0 0)',
      fg:      'oklch(18% 0.01 60)',
      muted:   'oklch(55% 0.01 60)',
      border:  'oklch(92% 0.008 80)',
      accent:  'oklch(48% 0.09 50)',
    },
    posture: [
      '70%+ of every layout is breathing room — whitespace is the product',
      'type weight contrast: display at 200–300, labels at 600 — nothing in between',
      'one accent, used at most once per screen — a signature, not a system',
      'golden ratio proportions (1:1.618) for column splits and image crops',
      'avoid: hover effects, transitions, animations — stillness is the luxury signal',
    ],
  },
  {
    id: 'code-poetry-zach',
    label: 'Code as art — Zach Lieberman / generative drawing',
    mood: 'Programming is painting. Hand-drawn aesthetics generated by algorithm. Black and white only — no color, ever. The process is visible: construction lines, sketch energy, the mark of the tool.',
    references: ['Zach Lieberman', 'openFrameworks', 'Processing Foundation', 'drawingbots.net'],
    displayFont: "ui-monospace, 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace",
    bodyFont: "ui-monospace, 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace",
    monoFont: "ui-monospace, 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace",
    palette: {
      bg:      'oklch(100% 0 0)',
      surface: 'oklch(98% 0 0)',
      fg:      'oklch(5% 0 0)',
      muted:   'oklch(55% 0 0)',
      border:  'oklch(70% 0 0)',
      accent:  'oklch(40% 0 0)',
    },
    posture: [
      'black and white only — use line density for tone, not grey gradients',
      'monospace everywhere: display, body, labels — mono IS the aesthetic',
      'construction lines visible: grid marks, axis labels, sketch-like edges',
      'avoid clean rectangles and smooth curves — prefer hatching, dots, hand-drawn paths',
      'variation and imperfection are intentional — the algorithm is the signature',
    ],
  },
  {
    id: 'warm-cyberpunk-ash',
    label: 'Warm cyberpunk — Ash Thorp / cinematic concept',
    mood: 'The future is lonely, not sterile. Film-grade volumetric lighting, orange-teal palette (not cold blue), industrial design refined to luxury. Blade Runner warmth over Tron coldness.',
    references: ['Ash Thorp', 'Ghost in the Shell concept art', 'Blade Runner 2049', 'Territory Studio'],
    displayFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'Space Grotesk', -apple-system, system-ui, sans-serif",
    monoFont: "ui-monospace, 'Share Tech Mono', Menlo, monospace",
    palette: {
      bg:      'oklch(12% 0.025 40)',
      surface: 'oklch(18% 0.028 38)',
      fg:      'oklch(90% 0.01 80)',
      muted:   'oklch(55% 0.02 50)',
      border:  'oklch(28% 0.03 38)',
      accent:  'oklch(74% 0.18 60)',
    },
    posture: [
      'warm dark: near-black with an amber undertone — never #0D1117 cold blue-black',
      'accent = warm orange or amber; teal as secondary highlight only',
      'volumetric: layered radial gradients suggest physical light sources',
      'industrial precision: technical readouts, monospace data, hairline borders',
      'narrative concept-art feel — each screen tells one cinematic moment',
    ],
  },
  {
    id: 'vfx-territory',
    label: 'Sci-fi FUI — Territory Studio / fantasy UI',
    mood: 'Believable future technology. Holographic projections, overlapping data layers, orange/amber or cyan monochrome readouts. The interface belongs inside a spacecraft — functional but awe-inspiring.',
    references: ['Territory Studio', 'Blade Runner 2049 screen graphics', 'Oblivion (2013)', 'Marvel FUI'],
    displayFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'Space Grotesk', -apple-system, system-ui, sans-serif",
    monoFont: "ui-monospace, 'Courier New', monospace",
    palette: {
      bg:      'oklch(10% 0.02 40)',
      surface: 'oklch(15% 0.03 38)',
      fg:      'oklch(88% 0.12 80)',
      muted:   'oklch(52% 0.06 60)',
      border:  'oklch(68% 0.14 60)',
      accent:  'oklch(78% 0.2 68)',
    },
    posture: [
      'FUI color: orange/amber monochrome OR cyan — not a mix of both in one design',
      'multiple overlapping layers at 40–80% opacity suggest holographic depth',
      'all data is live-looking: counters, progress arcs, technical readouts',
      'borders glow: use box-shadow with accent color to suggest illumination',
      'typography is uppercase, tracked (+0.1–0.2em), condensed and monospace-friendly',
    ],
  },
  {
    id: 'japanese-takram',
    label: 'Japanese speculative — Takram / modest sophistication',
    mood: 'Technology as philosophical inquiry. Concept diagrams as art, gentle shadows, beige and soft grey. The interface whispers — it does not shout. Modest, precise, curious.',
    references: ['Takram', 'NHK Special data visuals', 'good design company', 'Kenya Hara / Muji'],
    displayFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    palette: {
      bg:      'oklch(97% 0.006 80)',
      surface: 'oklch(99% 0.003 80)',
      fg:      'oklch(20% 0.01 60)',
      muted:   'oklch(55% 0.01 60)',
      border:  'oklch(91% 0.006 80)',
      accent:  'oklch(58% 0.08 152)',
    },
    posture: [
      'natural neutral palette: warm beige background, muted sage accent',
      'diagrams and concept charts treated as art — generous space, fine 1px lines',
      'rounded corners (8–12px) and gentle shadows — never harsh or angular',
      'restrained hover states: opacity shift only, no movement or glow',
      'copy is philosophical in register — questions and observations, not imperatives',
    ],
  },
];

export function renderDirectionFormBody(): string {
  const cards = DESIGN_DIRECTIONS.map((d) => ({
    id: d.id,
    label: d.label,
    mood: d.mood,
    references: d.references,
    palette: [
      d.palette.bg,
      d.palette.surface,
      d.palette.border,
      d.palette.muted,
      d.palette.fg,
      d.palette.accent,
    ],
    displayFont: d.displayFont,
    bodyFont: d.bodyFont,
  }));

  const form = {
    description: 'No brand to match — pick a visual direction. Each one ships with a real palette, font stack, and layout posture. You can override the accent below.',
    questions: [
      {
        id: 'direction',
        label: 'Direction',
        type: 'direction-cards',
        required: true,
        options: DESIGN_DIRECTIONS.map((d) => d.id),
        cards,
      },
      {
        id: 'accent_override',
        label: 'Accent override (optional)',
        type: 'text',
        placeholder: 'e.g. "use moss green instead of cobalt", "no orange — too brand-y for us"',
      },
    ],
  };

  return JSON.stringify(form, null, 2);
}

export function renderDirectionSpecBlock(): string {
  const lines: string[] = [
    '## Direction library — bind into `:root` when the user picks one',
    '',
    "Each direction below carries a CSS-ready palette (OKLch values) and font stacks. When the user selects one in the direction-form, replace the seed template's `:root` block with that direction's palette and font stacks **verbatim** — do not improvise. Posture cues describe how that direction *behaves* (border weight, radius, accent budget); honour them in the layout choices.",
    '',
  ];
  for (const d of DESIGN_DIRECTIONS) {
    lines.push(`### ${d.label}  \`(id: ${d.id})\``);
    lines.push('');
    lines.push(`**Mood:** ${d.mood}`);
    lines.push('');
    lines.push(`**References:** ${d.references.join(', ')}.`);
    lines.push('');
    lines.push('**Palette (drop into `:root`):**');
    lines.push('');
    lines.push('```css');
    lines.push(`:root {`);
    lines.push(`  --bg:      ${d.palette.bg};`);
    lines.push(`  --surface: ${d.palette.surface};`);
    lines.push(`  --fg:      ${d.palette.fg};`);
    lines.push(`  --muted:   ${d.palette.muted};`);
    lines.push(`  --border:  ${d.palette.border};`);
    lines.push(`  --accent:  ${d.palette.accent};`);
    lines.push('');
    lines.push(`  --font-display: ${d.displayFont};`);
    lines.push(`  --font-body:    ${d.bodyFont};`);
    if (d.monoFont) lines.push(`  --font-mono:    ${d.monoFont};`);
    lines.push(`}`);
    lines.push('```');
    lines.push('');
    lines.push('**Posture:**');
    for (const p of d.posture) lines.push(`- ${p}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function findDirectionByLabel(label: string): DesignDirection | undefined {
  const trimmed = label.trim();
  return DESIGN_DIRECTIONS.find((d) => d.label === trimmed || d.id === trimmed);
}

export function findDirectionById(id: string): DesignDirection | undefined {
  return DESIGN_DIRECTIONS.find((d) => d.id === id);
}

/** Extract preview color swatches for a given direction (bg → surface → border → muted → fg → accent) */
export function getDirectionSwatches(id: string): string[] {
  const d = findDirectionById(id);
  if (!d) return [];
  return [d.palette.bg, d.palette.surface, d.palette.border, d.palette.muted, d.palette.fg, d.palette.accent];
}
