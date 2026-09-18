/**
 * Avatar sprite-pack manifest for the create-bot wizard.
 *
 * This file is the data layer only — pure types + data + path helpers.
 * A separate UI pass renders it.
 *
 * For the asset-generation handoff spec (dimensions, frame layout, art
 * direction per pack, QA checklist), see ./AVATAR_PACKS.md. The declared
 * assets are generated into surfaces/ai.allternit.com/public/avatar-packs/
 * and served at AVATAR_PACK_ASSET_ROOT.
 */

export interface AvatarPackSprite {
  /** Stable slug, unique within the pack. */
  id: string;
  /** Display name, e.g. "Atlas". */
  name: string;
  /**
   * Static square portrait used for lists/avatar rendering.
   * Relative to the pack assets root (see AVATAR_PACK_ASSET_ROOT).
   */
  portraitUrl: string;
  /**
   * Optional animated spritesheet in the Codex-carry pet format
   * (8 columns × 9 rows of 192×208 px frames). When present, bot
   * surfaces can animate the avatar; otherwise the portrait is used.
   */
  sheetUrl?: string;
}

export interface AvatarPack {
  id: string;
  name: string;
  /** One-line description shown in the pack browser. */
  description: string;
  /** Filter chips in the pack browser (e.g. 'bot', 'pet', 'mascot'). */
  themes: string[];
  sprites: AvatarPackSprite[];
}

export const AVATAR_PACK_ASSET_ROOT = '/avatar-packs';

/**
 * Packs whose portraits (and sheets, when declared animated) are on disk
 * under public/avatar-packs/. Other packs stay in the wizard catalog as
 * placeholders until their art lands.
 */
export const SHIPPED_AVATAR_PACK_IDS = [
  'alloy-classic',
  'alloy-pro',
  'gizzi-brawl',
  'grok-carry',
  'codex-carry',
  'gizzi-family',
] as const;

export function isShippedAvatarPack(packId: string): boolean {
  return (SHIPPED_AVATAR_PACK_IDS as readonly string[]).includes(packId);
}

/** Path-convention lives here only — a change is one line. */
export function packSpritePortraitUrl(
  pack: Pick<AvatarPack, 'id'>,
  sprite: Pick<AvatarPackSprite, 'id'>,
): string {
  return `${AVATAR_PACK_ASSET_ROOT}/${pack.id}/${sprite.id}.webp`;
}

/** Path-convention lives here only — a change is one line. */
export function packSpriteSheetUrl(
  pack: Pick<AvatarPack, 'id'>,
  sprite: Pick<AvatarPackSprite, 'id'>,
): string {
  return `${AVATAR_PACK_ASSET_ROOT}/${pack.id}/${sprite.id}-sheet.webp`;
}

/** Sprite declaration before URLs are resolved — see withPackUrls. */
type AvatarPackSpriteDecl = Pick<AvatarPackSprite, 'id' | 'name'> & { animated: boolean };

function sprite(id: string, name: string, animated: boolean): AvatarPackSpriteDecl {
  return { id, name, animated };
}

/** Resolve the shared path convention for every sprite in a pack. */
function withPackUrls(packId: string, sprites: AvatarPackSpriteDecl[]): AvatarPackSprite[] {
  const pack = { id: packId };
  return sprites.map((s) => ({
    id: s.id,
    name: s.name,
    portraitUrl: packSpritePortraitUrl(pack, s),
    ...(s.animated ? { sheetUrl: packSpriteSheetUrl(pack, s) } : {}),
  }));
}

export const AVATAR_PACKS: AvatarPack[] = [
  {
    id: 'alloy-classic',
    name: 'Alloy Classic',
    description: 'Rounded metal bots with antennae and expressive screen faces.',
    themes: ['bot', 'robot', 'classic'],
    sprites: withPackUrls('alloy-classic', [
      sprite('atlas', 'Atlas', true),
      sprite('bolt', 'Bolt', true),
      sprite('clank', 'Clank', true),
      sprite('dial', 'Dial', true),
      sprite('echo-unit', 'Echo', true),
      sprite('fable', 'Fable', true),
      sprite('gasket', 'Gasket', true),
      sprite('hertz', 'Hertz', true),
    ]),
  },
  {
    id: 'alloy-pro',
    name: 'Alloy Pro',
    description: 'Sleeker professional robot rigs — industrial design bots built for serious work.',
    themes: ['bot', 'robot', 'professional'],
    sprites: withPackUrls('alloy-pro', [
      sprite('vantage', 'Vantage', false),
      sprite('caliber', 'Caliber', false),
      sprite('signal', 'Signal', false),
      sprite('monolith', 'Monolith', false),
      sprite('circuit', 'Circuit', false),
      sprite('drift', 'Drift', false),
      sprite('keystone', 'Keystone', false),
      sprite('vector', 'Vector', false),
    ]),
  },
  {
    id: 'gizzi-brawl',
    name: 'Gizzi Brawl',
    description: 'Gizzi Kombat fighter roster — true-front portraits and 8×9 emotion sheets for each agent mascot.',
    themes: ['mascot', 'fighter', 'gizzi'],
    sprites: withPackUrls('gizzi-brawl', [
      sprite('gizzi', 'Gizzi', true),
      sprite('clawd', 'Clawd', true),
      sprite('opencode', 'OpenCode', true),
      sprite('kimi', 'Kimi', true),
      sprite('qwen', 'Qwen', true),
      sprite('deepseek', 'DeepSeek', true),
      sprite('gemini', 'Gemini', true),
      sprite('openclaw', 'OpenClaw', true),
      sprite('hermes', 'Hermes', true),
      sprite('husk', 'Husk', true),
      sprite('nemotron', 'Nemotron', true),
      sprite('muse', 'Muse', true),
      sprite('glm', 'GLM', true),
      sprite('ollama', 'Ollama', true),
      sprite('omp', 'OMP', true),
      sprite('codex', 'Codex', true),
      sprite('grok', 'Grok', true),
    ]),
  },
  {
    id: 'grok-carry',
    name: 'Grok Carry',
    description: 'Grok-style floating-head companions — hovering, luminous, a little unhinged.',
    themes: ['bot', 'companion', 'floating'],
    sprites: withPackUrls('grok-carry', [
      sprite('orbik', 'Orbik', true),
      sprite('lumen', 'Lumen', true),
      sprite('flare', 'Flare', true),
      sprite('muse', 'Muse', true),
      sprite('prism', 'Prism', true),
      sprite('quark', 'Quark', true),
      sprite('rogue', 'Rogue', true),
      sprite('zest', 'Zest', true),
    ]),
  },
  {
    id: 'codex-carry',
    name: 'Codex Carry',
    description: 'Codex-carry-style pocket pets — small creature companions that live in your sidebar.',
    themes: ['pet', 'companion', 'cute'],
    sprites: withPackUrls('codex-carry', [
      sprite('nib', 'Nib', false),
      sprite('pico', 'Pico', false),
      sprite('wisp', 'Wisp', false),
      sprite('mochi', 'Mochi', false),
      sprite('bean', 'Bean', false),
      sprite('tumble', 'Tumble', false),
      sprite('pip', 'Pip', false),
      sprite('sprocket', 'Sprocket', false),
    ]),
  },
  {
    id: 'gizzi-family',
    name: 'Gizzi Family',
    description: 'Gizzi mascot variants — different builds and moods of the house gizzi character.',
    themes: ['mascot', 'pet', 'gizzi'],
    sprites: withPackUrls('gizzi-family', [
      sprite('gizzi', 'Gizzi', false),
      sprite('gizzi-bright', 'Gizzi Bright', false),
      sprite('gizzi-calm', 'Gizzi Calm', false),
      sprite('gizzi-bold', 'Gizzi Bold', false),
      sprite('gizzi-dreamy', 'Gizzi Dreamy', false),
      sprite('gizzi-grit', 'Gizzi Grit', false),
      sprite('gizzi-jolt', 'Gizzi Jolt', false),
      sprite('gizzi-sage', 'Gizzi Sage', false),
    ]),
  },
  {
    id: 'orbs',
    name: 'Orbs',
    description: 'Energy orbs and spheres, each with a distinct inner effect — plasma, ember, frost, void.',
    themes: ['energy', 'abstract', 'minimal'],
    sprites: withPackUrls('orbs', [
      sprite('plasma', 'Plasma', true),
      sprite('ember', 'Ember', true),
      sprite('frost', 'Frost', true),
      sprite('void', 'Void', true),
      sprite('aurum', 'Aurum', false),
      sprite('tide', 'Tide', false),
      sprite('spore', 'Spore', false),
      sprite('volt', 'Volt', false),
    ]),
  },
  {
    id: 'creatures',
    name: 'Creatures',
    description: 'Friendly small creatures — original fox, cat, owl, and axolotl-like designs.',
    themes: ['pet', 'animal', 'cute'],
    sprites: withPackUrls('creatures', [
      sprite('fern', 'Fern the Fox', true),
      sprite('milo', 'Milo the Cat', true),
      sprite('otis', 'Otis the Owl', true),
      sprite('axi', 'Axi the Axolotl', true),
      sprite('bramble', 'Bramble the Hedgehog', false),
      sprite('cleo', 'Cleo the Chameleon', false),
      sprite('dusty', 'Dusty the Moth', false),
      sprite('reeds', 'Reeds the Heron', false),
    ]),
  },
  {
    id: 'mecha',
    name: 'Mecha',
    description: 'Mecha and anime-robot heads — angular armor, glowing visors, big-machine energy.',
    themes: ['bot', 'robot', 'anime'],
    sprites: withPackUrls('mecha', [
      sprite('riker', 'Riker', true),
      sprite('kaizen', 'Kaizen', true),
      sprite('blitz', 'Blitz', true),
      sprite('seraph', 'Seraph', true),
      sprite('titan-9', 'Titan-9', false),
      sprite('vanguard', 'Vanguard', false),
      sprite('yoroi', 'Yoroi', false),
      sprite('zerog', 'Zero-G', false),
    ]),
  },
  {
    id: 'minimals',
    name: 'Minimals',
    description: 'Ultra-minimal geometric marks for serious, enterprise-grade bots.',
    themes: ['minimal', 'enterprise', 'abstract'],
    sprites: withPackUrls('minimals', [
      sprite('mark-alpha', 'Mark Alpha', false),
      sprite('mark-beta', 'Mark Beta', false),
      sprite('mark-gamma', 'Mark Gamma', false),
      sprite('mark-delta', 'Mark Delta', false),
      sprite('mark-sigma', 'Mark Sigma', true),
      sprite('mark-omega', 'Mark Omega', true),
      sprite('mark-kappa', 'Mark Kappa', false),
      sprite('mark-lambda', 'Mark Lambda', false),
    ]),
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Cyberpunk neon heads — chrome, cables, and glow for bots that live after dark.',
    themes: ['bot', 'neon', 'cyberpunk'],
    sprites: withPackUrls('cyber', [
      sprite('neon-district', 'Neon District', true),
      sprite('chrome-riot', 'Chrome Riot', true),
      sprite('ghostline', 'Ghostline', true),
      sprite('synth', 'Synth', true),
      sprite('wire', 'Wire', false),
      sprite('pulse', 'Pulse', false),
      sprite('glitch', 'Glitch', false),
      sprite('halo', 'Halo', false),
    ]),
  },
  {
    id: 'magic',
    name: 'Magic',
    description: 'Fantasy familiars — sprite wisps, small dragons, and gentle golems.',
    themes: ['fantasy', 'creature', 'magic'],
    sprites: withPackUrls('magic', [
      sprite('wisp-lantern', 'Wisp Lantern', true),
      sprite('emberwhelp', 'Emberwhelp', true),
      sprite('moss-golem', 'Moss Golem', true),
      sprite('runefox', 'Runefox', true),
      sprite('tide-sprite', 'Tide Sprite', false),
      sprite('cinderling', 'Cinderling', false),
      sprite('gale-drift', 'Gale Drift', false),
      sprite('thistle-imp', 'Thistle Imp', false),
    ]),
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Nature spirits — leaf, golem, stone, and ember beings.',
    themes: ['nature', 'creature', 'elemental'],
    sprites: withPackUrls('nature', [
      sprite('leafheart', 'Leafheart', true),
      sprite('stonefather', 'Stonefather', true),
      sprite('emberkin', 'Emberkin', true),
      sprite('riverstone', 'Riverstone', true),
      sprite('bloom', 'Bloom', false),
      sprite('fungal-king', 'Fungal King', false),
      sprite('windwalker', 'Windwalker', false),
      sprite('deep-root', 'Deep Root', false),
    ]),
  },
  {
    id: 'retro-pixel',
    name: 'Retro Pixel',
    description: 'Retro pixel-art bots and pets — 16-color charm for nostalgia-flavored agents.',
    themes: ['pixel', 'retro', 'bot'],
    sprites: withPackUrls('retro-pixel', [
      sprite('bitbuddy', 'BitBuddy', true),
      sprite('chips', 'Chips', true),
      sprite('pixel-pete', 'Pixel Pete', true),
      sprite('rolly', 'Rolly', true),
      sprite('glint', 'Glint', true),
      sprite('modem', 'Modem', true),
      sprite('sprite-8', 'Sprite-8', true),
      sprite('crt', 'CRT', true),
    ]),
  },
  {
    id: 'office-professionals',
    name: 'Office Professionals',
    description: 'Character portraits in professional attire — analyst, assistant, engineer, designer.',
    themes: ['human', 'professional', 'portrait'],
    sprites: withPackUrls('office-professionals', [
      sprite('analyst', 'The Analyst', false),
      sprite('assistant', 'The Assistant', false),
      sprite('engineer', 'The Engineer', false),
      sprite('designer', 'The Designer', false),
      sprite('counsel', 'The Counsel', true),
      sprite('strategist', 'The Strategist', true),
      sprite('bookkeeper', 'The Bookkeeper', false),
      sprite('liaison', 'The Liaison', false),
    ]),
  },
  {
    id: 'space-corps',
    name: 'Space Corps',
    description: 'Astronaut and space-explorer bots — mission-ready rigs for frontier work.',
    themes: ['bot', 'space', 'explorer'],
    sprites: withPackUrls('space-corps', [
      sprite('commander', 'Commander', true),
      sprite('navigator', 'Navigator', true),
      sprite('engineer-pod', 'Pod Engineer', true),
      sprite('science-officer', 'Science Officer', true),
      sprite('drone-walker', 'Drone Walker', false),
      sprite('scavenger', 'Scavenger', false),
      sprite('pathfinder', 'Pathfinder', false),
      sprite('comet', 'Comet', false),
    ]),
  },
];
