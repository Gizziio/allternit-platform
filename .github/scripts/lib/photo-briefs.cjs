#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Photo Brief Writer
 *
 * Writes the six image briefs for a photo edition. When KIMI_API_KEY is
 * available, briefs are written by the model FROM THE ARTICLE ITSELF —
 * subjects, scenes, and moods grounded in the actual stories — with a
 * deterministic template fallback when the key is missing or the call fails.
 *
 * Output per slot: a single prompt string ready for the Codex image tool.
 */

const { callKimi } = require('./pipeline.cjs');

// ─── Art direction ──────────────────────────────────────────────────────────
// One shared style per edition so the generated shots read as a single
// photoshoot. Per-type palette nods at the publication accent.

const EDITION_STYLE = {
  signal:
    'Editorial newsroom documentary: working press / newsroom energy, ' +
    'practical fluorescent-and-window light, warm coral-leaning tones.',
  feature:
    'Cinematic magazine editorial: deliberate compositions, directional ' +
    'natural light, deep shadows, cool indigo-leaning grade.',
  blog:
    'Intimate workshop still-life and craft documentary: soft window ' +
    'light, warm emerald-leaning tones, tactile surfaces.',
};

const PHOTO_RULES =
  'Photograph, not illustration or 3D render — no glossy CGI look, no ' +
  'plastic skin. Natural lens perspective (35mm or 50mm), shallow depth of ' +
  'field where appropriate. No text, no captions, no logos, no watermarks, ' +
  'no visible brand marks. No one looking into the camera.';

// What each slot needs compositionally — the LLM briefs must honor these.
const SLOT_SPECS = {
  'cover-hero':
    'Wide establishing shot (landscape). Generous negative space on one ' +
    'side for headline type. The single image that could carry the cover.',
  'cover-inset-a':
    'Tight detail or macro shot — hands, tools, a screen edge, a texture. ' +
    'Reads clearly at small size.',
  'cover-inset-b':
    'Quiet candid moment: a person absorbed in work, seen from behind or ' +
    'the side. Reads clearly at small size.',
  'bleed-quote':
    'Atmospheric full-frame scene for a full-bleed page. IMPORTANT: a ' +
    'large, dark, low-detail region in the lower-left third — white serif ' +
    'text will be overlaid there.',
  'pair-a':
    'Over-the-shoulder working scene; will sit stacked with a second ' +
    'image, so it must hold up as a wide half-page band.',
  'pair-b':
    'Still-life of the tools of the work (notebook, terminal glow, ' +
    'coffee, hardware); complements pair-a without repeating it.',
};

// ─── Deterministic fallback (previous behavior, upgraded style) ─────────────

function themeOf(publication) {
  return String(publication.title || '')
    .replace(/—.*$/, '')
    .replace(/\((?:ISO )?week[^)]*\)/i, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildBriefsDeterministic(publication) {
  const kind = publication.contentType || publication.type || 'blog';
  const style = `${EDITION_STYLE[kind] || EDITION_STYLE.blog} ${PHOTO_RULES}`;
  const theme = themeOf(publication) || 'technology and the people building it';
  const keywords = (publication.keywords || []).slice(0, 4).join(', ');
  const tags = (publication.tags || []).slice(0, 3).join(', ');
  return {
    'cover-hero':
      `Wide cinematic photograph that captures the idea of "${theme}". ` +
      `A human moment at the center, workspace atmosphere. ${SLOT_SPECS['cover-hero']} ${style}`,
    'cover-inset-a':
      `Intimate detail photograph related to ${keywords || theme}. ` +
      `Hands, tools, and screens at work. ${SLOT_SPECS['cover-inset-a']} ${style}`,
    'cover-inset-b':
      `Quiet portrait-style photograph of a person absorbed in their craft, ` +
      `evoking ${tags || theme}. ${SLOT_SPECS['cover-inset-b']} ${style}`,
    'bleed-quote':
      `Atmospheric full-frame scene evoking "${theme}" — moody and spacious. ` +
      `${SLOT_SPECS['bleed-quote']} ${style}`,
    'pair-a':
      `Over-the-shoulder photograph of focused work connected to ` +
      `${keywords || theme}. ${SLOT_SPECS['pair-a']} ${style}`,
    'pair-b':
      `Still-life photograph of the tools of modern work — notebook, ` +
      `terminal glow, coffee — tied to ${tags || theme}. ${SLOT_SPECS['pair-b']} ${style}`,
  };
}

// ─── LLM-driven briefs ──────────────────────────────────────────────────────

function buildBriefWriterPrompt(publication, kind) {
  const specs = Object.entries(SLOT_SPECS)
    .map(([slot, spec]) => `- "${slot}": ${spec}`)
    .join('\n');
  const markdown = (publication.content && publication.content.markdown) || '';

  return `You are the photo editor of a printed technology magazine. Read the article below and write image briefs for a photoshoot that illustrates it.

ARTICLE TITLE: ${publication.title || ''}
ARTICLE:
${markdown.slice(0, 6000)}

Write one brief per slot. Each brief must:
- Depict a scene GROUNDED IN THE ARTICLE'S ACTUAL SUBJECT MATTER (name the real machines, places, objects, activities from the article — never generic "person at computer" filler)
- Be one or two sentences describing subject, action, setting, and light
- Honor its slot's compositional requirement:
${specs}

Also write one shared "style" line (max 20 words) giving the whole shoot a single coherent art direction: lighting, palette, mood.

Return ONLY valid JSON, no markdown fences:
{"style": "...", "cover-hero": "...", "cover-inset-a": "...", "cover-inset-b": "...", "bleed-quote": "...", "pair-a": "...", "pair-b": "..."}`;
}

async function buildBriefsViaLlm(publication) {
  const kind = publication.contentType || publication.type || 'blog';
  const prompt = buildBriefWriterPrompt(publication, kind);
  const raw = await callKimi(
    [
      {
        role: 'system',
        content:
          'You are a magazine photo editor. Return only valid JSON. No planning, no commentary.',
      },
      { role: 'user', content: prompt },
    ],
    8000,
  );
  const parsed = JSON.parse(String(raw || '').replace(/^```json\s*|\s*```$/g, ''));
  const briefs = {};
  const base = `${parsed.style || EDITION_STYLE[kind] || EDITION_STYLE.blog} ${PHOTO_RULES}`;
  for (const slot of Object.keys(SLOT_SPECS)) {
    if (!parsed[slot] || typeof parsed[slot] !== 'string') {
      throw new Error(`LLM brief missing slot "${slot}"`);
    }
    briefs[slot] = `${parsed[slot]} ${SLOT_SPECS[slot]} ${base}`;
  }
  return briefs;
}

/**
 * Six image briefs for a publication. LLM-written from the article when
 * KIMI_API_KEY is set; deterministic templates otherwise.
 */
async function buildPhotoBriefs(publication, { log = () => {} } = {}) {
  if (process.env.KIMI_API_KEY) {
    try {
      const briefs = await buildBriefsViaLlm(publication);
      log('  briefs written from the article (Kimi)');
      return briefs;
    } catch (err) {
      log(`  LLM briefs failed (${err && err.message ? err.message : err}); using templates`);
    }
  }
  return buildBriefsDeterministic(publication);
}

module.exports = { buildPhotoBriefs, buildBriefsDeterministic, SLOT_SPECS };
