# Avatar Pack Asset Generation — Handoff Spec

**Status:** four packs shipped 2026-09-15 (Alloy Classic, Alloy Pro portraits, Gizzi Brawl, Grok Carry). Remaining packs still need art.
**Read this whole file first. It is self-contained — you will not be given any other context.**

---

## 1. Mission

Generate the complete set of HD sprite assets declared in `avatar-packs.ts` (same folder as this file). That file is the single source of truth for **which packs exist, which sprites exist, and which sprites need animated sheets**.

Assets land in:

```
surfaces/ai.allternit.com/public/avatar-packs/<pack-id>/<sprite-id>.webp
surfaces/ai.allternit.com/public/avatar-packs/<pack-id>/<sprite-id>-sheet.webp
```

The web surface serves that public dir at `/avatar-packs/...`, which is exactly what the URLs in `avatar-packs.ts` resolve to (`AVATAR_PACK_ASSET_ROOT = '/avatar-packs'`). The desktop app bundles this static dir too — a mirroring/build step handled elsewhere, **not your job**. Your only job: produce the files, at the exact paths, at the exact specs below.

## 2. File inventory

Totals: **16 packs**, **137 sprites**, **137 portraits + 89 sheets = 226 files**.
Shipped on disk: Alloy Classic (16), Alloy Pro portraits only (8), Gizzi Brawl (34), Grok Carry (16). Alloy Pro sheets were cancelled — portraits only.

Full list (paths are relative to `surfaces/ai.allternit.com/public/`):

<!-- INVENTORY:BEGIN -->

### `alloy-classic` — Alloy Classic

- `avatar-packs/alloy-classic/atlas.webp`
- `avatar-packs/alloy-classic/atlas-sheet.webp`
- `avatar-packs/alloy-classic/bolt.webp`
- `avatar-packs/alloy-classic/bolt-sheet.webp`
- `avatar-packs/alloy-classic/clank.webp`
- `avatar-packs/alloy-classic/clank-sheet.webp`
- `avatar-packs/alloy-classic/dial.webp`
- `avatar-packs/alloy-classic/dial-sheet.webp`
- `avatar-packs/alloy-classic/echo-unit.webp`
- `avatar-packs/alloy-classic/echo-unit-sheet.webp`
- `avatar-packs/alloy-classic/fable.webp`
- `avatar-packs/alloy-classic/fable-sheet.webp`
- `avatar-packs/alloy-classic/gasket.webp`
- `avatar-packs/alloy-classic/gasket-sheet.webp`
- `avatar-packs/alloy-classic/hertz.webp`
- `avatar-packs/alloy-classic/hertz-sheet.webp`

### `alloy-pro` — Alloy Pro (portraits only; sheets cancelled)

- `avatar-packs/alloy-pro/vantage.webp`
- `avatar-packs/alloy-pro/caliber.webp`
- `avatar-packs/alloy-pro/signal.webp`
- `avatar-packs/alloy-pro/monolith.webp`
- `avatar-packs/alloy-pro/circuit.webp`
- `avatar-packs/alloy-pro/drift.webp`
- `avatar-packs/alloy-pro/keystone.webp`
- `avatar-packs/alloy-pro/vector.webp`

### `gizzi-brawl` — Gizzi Brawl

- `avatar-packs/gizzi-brawl/gizzi.webp`
- `avatar-packs/gizzi-brawl/gizzi-sheet.webp`
- `avatar-packs/gizzi-brawl/clawd.webp`
- `avatar-packs/gizzi-brawl/clawd-sheet.webp`
- `avatar-packs/gizzi-brawl/opencode.webp`
- `avatar-packs/gizzi-brawl/opencode-sheet.webp`
- `avatar-packs/gizzi-brawl/kimi.webp`
- `avatar-packs/gizzi-brawl/kimi-sheet.webp`
- `avatar-packs/gizzi-brawl/qwen.webp`
- `avatar-packs/gizzi-brawl/qwen-sheet.webp`
- `avatar-packs/gizzi-brawl/deepseek.webp`
- `avatar-packs/gizzi-brawl/deepseek-sheet.webp`
- `avatar-packs/gizzi-brawl/gemini.webp`
- `avatar-packs/gizzi-brawl/gemini-sheet.webp`
- `avatar-packs/gizzi-brawl/openclaw.webp`
- `avatar-packs/gizzi-brawl/openclaw-sheet.webp`
- `avatar-packs/gizzi-brawl/hermes.webp`
- `avatar-packs/gizzi-brawl/hermes-sheet.webp`
- `avatar-packs/gizzi-brawl/husk.webp`
- `avatar-packs/gizzi-brawl/husk-sheet.webp`
- `avatar-packs/gizzi-brawl/nemotron.webp`
- `avatar-packs/gizzi-brawl/nemotron-sheet.webp`
- `avatar-packs/gizzi-brawl/muse.webp`
- `avatar-packs/gizzi-brawl/muse-sheet.webp`
- `avatar-packs/gizzi-brawl/glm.webp`
- `avatar-packs/gizzi-brawl/glm-sheet.webp`
- `avatar-packs/gizzi-brawl/ollama.webp`
- `avatar-packs/gizzi-brawl/ollama-sheet.webp`
- `avatar-packs/gizzi-brawl/omp.webp`
- `avatar-packs/gizzi-brawl/omp-sheet.webp`
- `avatar-packs/gizzi-brawl/codex.webp`
- `avatar-packs/gizzi-brawl/codex-sheet.webp`
- `avatar-packs/gizzi-brawl/grok.webp`
- `avatar-packs/gizzi-brawl/grok-sheet.webp`

### `grok-carry` — Grok Carry

- `avatar-packs/grok-carry/orbik.webp`
- `avatar-packs/grok-carry/orbik-sheet.webp`
- `avatar-packs/grok-carry/lumen.webp`
- `avatar-packs/grok-carry/lumen-sheet.webp`
- `avatar-packs/grok-carry/flare.webp`
- `avatar-packs/grok-carry/flare-sheet.webp`
- `avatar-packs/grok-carry/muse.webp`
- `avatar-packs/grok-carry/muse-sheet.webp`
- `avatar-packs/grok-carry/prism.webp`
- `avatar-packs/grok-carry/prism-sheet.webp`
- `avatar-packs/grok-carry/quark.webp`
- `avatar-packs/grok-carry/quark-sheet.webp`
- `avatar-packs/grok-carry/rogue.webp`
- `avatar-packs/grok-carry/rogue-sheet.webp`
- `avatar-packs/grok-carry/zest.webp`
- `avatar-packs/grok-carry/zest-sheet.webp`

### `codex-carry` — Codex Carry

- `avatar-packs/codex-carry/nib.webp`
- `avatar-packs/codex-carry/nib-sheet.webp`
- `avatar-packs/codex-carry/pico.webp`
- `avatar-packs/codex-carry/pico-sheet.webp`
- `avatar-packs/codex-carry/wisp.webp`
- `avatar-packs/codex-carry/wisp-sheet.webp`
- `avatar-packs/codex-carry/mochi.webp`
- `avatar-packs/codex-carry/mochi-sheet.webp`
- `avatar-packs/codex-carry/bean.webp`
- `avatar-packs/codex-carry/bean-sheet.webp`
- `avatar-packs/codex-carry/tumble.webp`
- `avatar-packs/codex-carry/tumble-sheet.webp`
- `avatar-packs/codex-carry/pip.webp`
- `avatar-packs/codex-carry/pip-sheet.webp`
- `avatar-packs/codex-carry/sprocket.webp`
- `avatar-packs/codex-carry/sprocket-sheet.webp`

### `gizzi-family` — Gizzi Family

- `avatar-packs/gizzi-family/gizzi.webp`
- `avatar-packs/gizzi-family/gizzi-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-bright.webp`
- `avatar-packs/gizzi-family/gizzi-bright-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-calm.webp`
- `avatar-packs/gizzi-family/gizzi-calm-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-bold.webp`
- `avatar-packs/gizzi-family/gizzi-bold-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-dreamy.webp`
- `avatar-packs/gizzi-family/gizzi-dreamy-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-grit.webp`
- `avatar-packs/gizzi-family/gizzi-grit-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-jolt.webp`
- `avatar-packs/gizzi-family/gizzi-jolt-sheet.webp`
- `avatar-packs/gizzi-family/gizzi-sage.webp`
- `avatar-packs/gizzi-family/gizzi-sage-sheet.webp`

### `orbs` — Orbs

- `avatar-packs/orbs/plasma.webp`
- `avatar-packs/orbs/plasma-sheet.webp`
- `avatar-packs/orbs/ember.webp`
- `avatar-packs/orbs/ember-sheet.webp`
- `avatar-packs/orbs/frost.webp`
- `avatar-packs/orbs/frost-sheet.webp`
- `avatar-packs/orbs/void.webp`
- `avatar-packs/orbs/void-sheet.webp`
- `avatar-packs/orbs/aurum.webp`
- `avatar-packs/orbs/tide.webp`
- `avatar-packs/orbs/spore.webp`
- `avatar-packs/orbs/volt.webp`

### `creatures` — Creatures

- `avatar-packs/creatures/fern.webp`
- `avatar-packs/creatures/fern-sheet.webp`
- `avatar-packs/creatures/milo.webp`
- `avatar-packs/creatures/milo-sheet.webp`
- `avatar-packs/creatures/otis.webp`
- `avatar-packs/creatures/otis-sheet.webp`
- `avatar-packs/creatures/axi.webp`
- `avatar-packs/creatures/axi-sheet.webp`
- `avatar-packs/creatures/bramble.webp`
- `avatar-packs/creatures/cleo.webp`
- `avatar-packs/creatures/dusty.webp`
- `avatar-packs/creatures/reeds.webp`

### `mecha` — Mecha

- `avatar-packs/mecha/riker.webp`
- `avatar-packs/mecha/riker-sheet.webp`
- `avatar-packs/mecha/kaizen.webp`
- `avatar-packs/mecha/kaizen-sheet.webp`
- `avatar-packs/mecha/blitz.webp`
- `avatar-packs/mecha/blitz-sheet.webp`
- `avatar-packs/mecha/seraph.webp`
- `avatar-packs/mecha/seraph-sheet.webp`
- `avatar-packs/mecha/titan-9.webp`
- `avatar-packs/mecha/vanguard.webp`
- `avatar-packs/mecha/yoroi.webp`
- `avatar-packs/mecha/zerog.webp`

### `minimals` — Minimals

- `avatar-packs/minimals/mark-alpha.webp`
- `avatar-packs/minimals/mark-beta.webp`
- `avatar-packs/minimals/mark-gamma.webp`
- `avatar-packs/minimals/mark-delta.webp`
- `avatar-packs/minimals/mark-sigma.webp`
- `avatar-packs/minimals/mark-sigma-sheet.webp`
- `avatar-packs/minimals/mark-omega.webp`
- `avatar-packs/minimals/mark-omega-sheet.webp`
- `avatar-packs/minimals/mark-kappa.webp`
- `avatar-packs/minimals/mark-lambda.webp`

### `cyber` — Cyber

- `avatar-packs/cyber/neon-district.webp`
- `avatar-packs/cyber/neon-district-sheet.webp`
- `avatar-packs/cyber/chrome-riot.webp`
- `avatar-packs/cyber/chrome-riot-sheet.webp`
- `avatar-packs/cyber/ghostline.webp`
- `avatar-packs/cyber/ghostline-sheet.webp`
- `avatar-packs/cyber/synth.webp`
- `avatar-packs/cyber/synth-sheet.webp`
- `avatar-packs/cyber/wire.webp`
- `avatar-packs/cyber/pulse.webp`
- `avatar-packs/cyber/glitch.webp`
- `avatar-packs/cyber/halo.webp`

### `magic` — Magic

- `avatar-packs/magic/wisp-lantern.webp`
- `avatar-packs/magic/wisp-lantern-sheet.webp`
- `avatar-packs/magic/emberwhelp.webp`
- `avatar-packs/magic/emberwhelp-sheet.webp`
- `avatar-packs/magic/moss-golem.webp`
- `avatar-packs/magic/moss-golem-sheet.webp`
- `avatar-packs/magic/runefox.webp`
- `avatar-packs/magic/runefox-sheet.webp`
- `avatar-packs/magic/tide-sprite.webp`
- `avatar-packs/magic/cinderling.webp`
- `avatar-packs/magic/gale-drift.webp`
- `avatar-packs/magic/thistle-imp.webp`

### `nature` — Nature

- `avatar-packs/nature/leafheart.webp`
- `avatar-packs/nature/leafheart-sheet.webp`
- `avatar-packs/nature/stonefather.webp`
- `avatar-packs/nature/stonefather-sheet.webp`
- `avatar-packs/nature/emberkin.webp`
- `avatar-packs/nature/emberkin-sheet.webp`
- `avatar-packs/nature/riverstone.webp`
- `avatar-packs/nature/riverstone-sheet.webp`
- `avatar-packs/nature/bloom.webp`
- `avatar-packs/nature/fungal-king.webp`
- `avatar-packs/nature/windwalker.webp`
- `avatar-packs/nature/deep-root.webp`

### `retro-pixel` — Retro Pixel

- `avatar-packs/retro-pixel/bitbuddy.webp`
- `avatar-packs/retro-pixel/bitbuddy-sheet.webp`
- `avatar-packs/retro-pixel/chips.webp`
- `avatar-packs/retro-pixel/chips-sheet.webp`
- `avatar-packs/retro-pixel/pixel-pete.webp`
- `avatar-packs/retro-pixel/pixel-pete-sheet.webp`
- `avatar-packs/retro-pixel/rolly.webp`
- `avatar-packs/retro-pixel/rolly-sheet.webp`
- `avatar-packs/retro-pixel/glint.webp`
- `avatar-packs/retro-pixel/glint-sheet.webp`
- `avatar-packs/retro-pixel/modem.webp`
- `avatar-packs/retro-pixel/modem-sheet.webp`
- `avatar-packs/retro-pixel/sprite-8.webp`
- `avatar-packs/retro-pixel/sprite-8-sheet.webp`
- `avatar-packs/retro-pixel/crt.webp`
- `avatar-packs/retro-pixel/crt-sheet.webp`

### `office-professionals` — Office Professionals

- `avatar-packs/office-professionals/analyst.webp`
- `avatar-packs/office-professionals/assistant.webp`
- `avatar-packs/office-professionals/engineer.webp`
- `avatar-packs/office-professionals/designer.webp`
- `avatar-packs/office-professionals/counsel.webp`
- `avatar-packs/office-professionals/counsel-sheet.webp`
- `avatar-packs/office-professionals/strategist.webp`
- `avatar-packs/office-professionals/strategist-sheet.webp`
- `avatar-packs/office-professionals/bookkeeper.webp`
- `avatar-packs/office-professionals/liaison.webp`

### `space-corps` — Space Corps

- `avatar-packs/space-corps/commander.webp`
- `avatar-packs/space-corps/commander-sheet.webp`
- `avatar-packs/space-corps/navigator.webp`
- `avatar-packs/space-corps/navigator-sheet.webp`
- `avatar-packs/space-corps/engineer-pod.webp`
- `avatar-packs/space-corps/engineer-pod-sheet.webp`
- `avatar-packs/space-corps/science-officer.webp`
- `avatar-packs/space-corps/science-officer-sheet.webp`
- `avatar-packs/space-corps/drone-walker.webp`
- `avatar-packs/space-corps/scavenger.webp`
- `avatar-packs/space-corps/pathfinder.webp`
- `avatar-packs/space-corps/comet.webp`

<!-- INVENTORY:END -->

Every `<sprite>.webp` is a **portrait**: 512×512 WebP, transparent background where the design allows (see consistency rules). Every `<sprite>-sheet.webp` is an **animated spritesheet**: exactly **1536×1872 px** total, a grid of **8 columns × 9 rows** of **192×208 px** frames, WebP.

## 3. Global consistency rules (apply to every pack, no exceptions)

1. **Framing:** subject centered horizontally, anchored near the bottom-center of the frame; subject fills ~80% of frame height (sheets: 80% of each 192×208 cell, anchored bottom-center of the cell).
2. **Eye-line:** all sprites in a pack share the same eye-line/camera angle (front or near-front, consistent per pack).
3. **Background:** transparent (`RGBA` WebP) where the design allows; otherwise a single simple dark backdrop (`#101014`–`#17171c` gradient). Never busy backgrounds, never scenery, never shadows cast onto a floor.
4. **Legibility:** must read clearly at **48×48 px** (bot list avatar) and **96×96 px** (wizard preview). Test by downscaling — if the silhouette collapses into mush, regenerate with a bolder silhouette and fewer internal details.
5. **Light & dark UI:** the subject must have enough internal contrast (rim light, outline, or glow) to be legible on both `#ffffff` and `#0b0b0c` backgrounds. Transparent-background sprites need a subtle outer rim/stroke.
6. **One art direction per pack.** Never mix rendering styles inside a pack. If you regenerate one sprite in a pack, match the others exactly (same palette, same lighting, same line weight).
7. **No text anywhere** in the art — no letters, no numbers, no logos, no UI chrome. (Screen-faces on robots display abstract expressions only: eyes, mouth shapes, waveform bars — never glyphs.)
8. **Original designs only.** These are original characters for Allternit; do not copy any existing copyrighted character. "Grok-style" and "Codex-carry-style" describe an *art direction* (silhouette language, rendering style), not a character to reproduce.

## 4. Sheets — frame layout spec (all packs, exact)

Every sheet is **1536×1872 px**, an **8 × 9 grid of 192 × 208 px cells** (72 frames). The character is **anchored bottom-center of every cell** and stays inside the cell bounds in all frames. **Row 1 = idle.** Standard frame map, so every pack animates identically in the existing pet renderer:

| Row | Frames (8 per row) | Purpose |
|-----|--------------------|---------|
| 1 | 1–8 | **Idle** — subtle breathing/hover loop, loop point of the animation |
| 2 | 9–16 | **Blink / idle-alt** — eye blink or alternate idle pose; frames 9 and 16 should match frame 1's pose for clean looping |
| 3 | 17–24 | **Walk** — full walk/hop cycle, left-to-right implied, loops seamlessly |
| 4 | 25–32 | **Run** — faster cycle, more body lean/energy, loops seamlessly |
| 5 | 33–40 | **Happy / jump** — an excited hop or celebration, peaks mid-row |
| 6 | 41–48 | **Sad** — droop/deflate, lowest point near row end |
| 7 | 49–56 | **Sleep** — eyes closed, slow rise/fall; first and last frame match for a sleep loop |
| 8 | 57–64 | **Eat / action** — an interaction gesture (eating, scanning, waving — whatever fits the character) |
| 9 | 65–72 | **Special** — signature move unique to the character (spin, flare, summon, power-up) |

Rules for sheets:

- **Pose consistency across frames** matters more than per-frame polish. Generate the whole row in one pass; do not stitch frames from separate generations.
- The character's **feet/base (or hover shadow anchor) must touch the same bottom-center point in every frame** — the renderer does no per-frame repositioning.
- Keep internal detail lower than in the portrait: at 192×208 per frame displayed at ~96–192 px, fine texture moirés. Favor clean silhouettes and clear expression shapes.
- Sheets must loop where the table says "loops seamlessly" — check first-to-last frame continuity.

## 5. Per-pack art direction

Palette hex values are the pack's core palette — stay inside them. Each pack lists a rendering style, silhouette language, prompt templates (replace `{{NAME}}` and `{{PERSONALITY}}`), and the shared negative prompt applies to all.

**Shared negative prompt (append to every generation):**
`text, letters, numbers, watermark, signature, logo, extra limbs, deformed anatomy, busy background, scenery, floor shadow, frame, border, multiple characters, cropped subject, photorealistic human face`

---

### 5.1 `alloy-classic` — Alloy Classic (8 sprites + 8 sheets)
Rounded metal bots with antennae and expressive screens-for-faces. Friendly, approachable, slightly retro.

- **Mood:** warm, curious, handmade.
- **Palette:** `#c8ccd4` (brushed aluminum), `#8a93a3` (shadow metal), `#3fd0c9` (teal screen glow), `#ffb347` (amber accent), `#2b2f36` (dark joints).
- **Rendering:** soft 3D render, studio lighting, octane-style; rounded matte-metal surfaces.
- **Silhouette:** pill/rounded-rect body, one or two antennae with ball tips, screen face occupying the upper third.
- **Prompts:**
  1. `Cute rounded retro robot "{{NAME}}", {{PERSONALITY}} personality, brushed matte aluminum body, single antenna with ball tip, expressive glowing screen face showing curious eyes, teal and amber accents, soft 3D render, studio lighting, octane style, full body centered, transparent background, character fills 80% of frame`
  2. `Small friendly robot companion "{{NAME}}", {{PERSONALITY}}, pill-shaped metal body on two stubby legs, screen-for-face with happy expression, antennae, soft studio 3D render, clean silhouette, isolated on transparent background`
  3. `Adorable robot pet "{{NAME}}" in the style of a classic desktop robot toy, {{PERSONALITY}} mood, rounded corners everywhere, glowing cyan screen face, warm amber indicator lights, 3D character render, centered, transparent background`

### 5.2 `alloy-pro` — Alloy Pro (8 portraits, no sheets)
Sleeker professional robot rigs — industrial design bots. The grown-up sibling of Alloy Classic: same family, sharper suit.

- **Mood:** competent, calm, premium.
- **Palette:** `#e8eaee` (pearl white), `#9aa3b2` (cool gray), `#2563eb` (signal blue), `#0f172a` (graphite), `#22d3ee` (status cyan).
- **Rendering:** soft 3D render, studio lighting, octane-style; brushed + anodized metal, subtle panel lines.
- **Silhouette:** leaner wedge/trim bodies, fin or visor elements, fewer antennae (one max, usually a sleek sensor fin).
- **Prompts:**
  1. `Sleek professional service robot "{{NAME}}", {{PERSONALITY}} demeanor, pearl-white anodized chassis with graphite panel lines, single visor-like screen face with calm blue eye bar, minimal sensor fin, industrial design, soft 3D studio render, octane style, centered full body, transparent background`
  2. `Modern design-bot "{{NAME}}", {{PERSONALITY}}, slim angular metal body, cool gray and signal blue palette, narrow glowing status strip for a face, premium product-render quality, studio lighting, isolated character on transparent background`
  3. `Futuristic office assistant robot "{{NAME}}", {{PERSONALITY}} posture, brushed aluminum and white ceramic surfaces, subtle cyan status lights, elegant restrained silhouette, 3D render, centered, transparent background`

### 5.3 `grok-carry` — Grok Carry (8 sprites + 8 sheets)
Grok-style floating-head companions: hovering luminous orbs/heads with no body, trailing light.

- **Mood:** witty, energetic, a little unhinged.
- **Palette:** `#f5f5f4` (hot white), `#000000` (void black for inner effects), `#e11d48` (flare red), `#fbbf24` (spark amber), `#67e8f9` (electric cyan).
- **Rendering:** soft 3D render with strong inner glow and rim light; particle sparks allowed inside the head volume.
- **Silhouette:** sphere/teardrop floating head, no limbs, expression = inner light shapes (eyes/flames) + halo ring.
- **Prompts:**
  1. `Floating spherical AI companion head "{{NAME}}", {{PERSONALITY}} expression made of glowing light shapes inside a translucent white orb, black inner void, red and amber energy sparks, thin cyan halo ring, hovering, soft 3D render, dramatic rim light, centered, transparent background`
  2. `Luminous floating orb character "{{NAME}}", {{PERSONALITY}} mood, swirling plasma inside a glass sphere, two bright eyes formed from the plasma, small orbiting sparks, no body, soft 3D render, studio lighting, transparent background`
  3. `Hovering energy head companion "{{NAME}}", {{PERSONALITY}}, teardrop-shaped glow orb with mischievous flaming eyes, subtle light trail below, white-hot core fading to cyan edge, 3D render, centered on transparent background`

### 5.4 `codex-carry` — Codex Carry (8 sprites + 8 sheets)
Codex-carry-style pocket pets: small creature companions designed to live in a sidebar and be carried around.

- **Mood:** cozy, playful, loyal.
- **Palette:** `#a7f3d0` (mint), `#f9a8d4` (blossom pink), `#93c5fd` (sky blue), `#fef3c7` (cream), `#334155` (soft slate for outlines).
- **Rendering:** soft 3D render, plush/toy-like subsurface scattering, big glossy eyes, octane-style.
- **Silhouette:** small chibi creature, big head (50%+ of body), tiny limbs, rounded everything.
- **Prompts:**
  1. `Tiny pocket pet creature "{{NAME}}", {{PERSONALITY}} personality, chibi proportions with huge glossy eyes, soft plush 3D render, mint and cream palette, small rounded ears, tiny stubby limbs, full body centered, transparent background, toy-like subsurface scattering`
  2. `Adorable small companion pet "{{NAME}}", {{PERSONALITY}}, big-head round creature, pastel pink and blue gradient body, soft studio 3D render, kawaii but not saccharine, clean silhouette, transparent background`
  3. `Little carry-along creature "{{NAME}}", {{PERSONALITY}} expression, bean-shaped body with tiny feet and big eyes, soft matte 3D toy render, warm cream tones with sky-blue accent, centered, transparent background`

### 5.5 `gizzi-family` — Gizzi Family (8 sprites + 8 sheets)
Gizzi mascot variants: different builds and moods of the house gizzi character. One character, eight coherent variants.

- **Mood:** brand mascot — friendly, versatile, unmistakably the same being in all 8.
- **Palette:** `#22d3ee` (gizzi cyan), `#0ea5e9` (deep cyan), `#f8fafc` (white), `#0b0b0c` (outline dark), `#fbbf24` (accent amber, sparing).
- **Rendering:** soft 3D render, studio lighting, octane-style; consistent body plan across variants (same head shape, same eye style) with build/mood differences.
- **Silhouette:** one locked base silhouette per family — variants differ by color temperature, posture, accessories (visor, scarf, headset), never by species.
- **Prompts:**
  1. `Mascot character "gizzi" variant "{{NAME}}", {{PERSONALITY}} mood, cyan rounded creature with large white expressive eyes and dark outline, soft 3D render, studio lighting, consistent mascot design, full body centered, transparent background`
  2. `Brand mascot "{{NAME}}", {{PERSONALITY}}, same cyan blob-like creature design as a family of variants, white belly, big friendly eyes, small accessory suggesting {{PERSONALITY}}, soft 3D toy render, transparent background`
  3. `Cheerful cyan mascot character "{{NAME}}", {{PERSONALITY}} energy, rounded soft body, white eye patches, subtle amber accent detail, consistent character design across a set, 3D render, centered, transparent background`

### 5.6 `orbs` — Orbs (8 sprites, 4 with sheets)
Energy orbs/spheres, each with a distinct inner effect.

- **Mood:** elemental, calm-powerful.
- **Palette:** per-orb core palettes — plasma `#a855f7`/`#ec4899`, ember `#f97316`/`#ef4444`, frost `#7dd3fc`/`#e0f2fe`, void `#312e81`/`#a78bfa`, aurum `#fbbf24`/`#78350f`, tide `#0ea5e9`/`#67e8f9`, spore `#84cc16`/`#365314`, volt `#facc15`/`#111827`.
- **Rendering:** soft 3D render, glassy/translucent shell with an inner effect (plasma filaments, ember core, frost crystals, void swirl, gold leaf, water, spores, lightning).
- **Silhouette:** perfect circle with a thin outer glow; differentiation comes 100% from the inner effect and rim color.
- **Prompts:**
  1. `Glowing energy orb "{{NAME}}", inner {{PERSONALITY}} effect swirling inside a translucent glass sphere, {{PRIMARY_HEX}} and {{SECONDARY_HEX}} palette, thin bright rim light, soft 3D render, centered on transparent background`
  2. `Elemental sphere artifact "{{NAME}}", {{PERSONALITY}} essence visible through a glossy orb shell, internal glow and particles, clean silhouette, studio 3D render, transparent background`
  3. `Floating magical energy ball "{{NAME}}", {{PERSONALITY}} mood, luminous core with layered inner texture, subtle outer aura, dark-UI-friendly rim glow, 3D render, centered, transparent background`

### 5.7 `creatures` — Creatures (8 sprites, 4 with sheets)
Friendly small creatures — original fox/cat/owl/axolotl-like designs.

- **Mood:** friendly, characterful, storybook.
- **Palette:** base `#f8fafc`/`#334155` outlines, per-creature accents: fox `#f97316`, cat `#a78bfa`, owl `#fbbf24`, axolotl `#f9a8d4`, hedgehog `#a16207`, chameleon `#4ade80`, moth `#e9d5ff`, heron `#93c5fd`.
- **Rendering:** soft 3D render or high-end stylized 2D — pick ONE per creature and keep it; big expressive eyes, soft fur/feather texture.
- **Silhouette:** readable animal silhouette with one exaggerated feature (big tail, ear tufts, gills, crest).
- **Prompts:**
  1. `Friendly {{ANIMAL}} character "{{NAME}}", {{PERSONALITY}} personality, stylized cute design with big expressive eyes, soft 3D render, {{ACCENT_HEX}} accent color, full body centered, transparent background, storybook charm`
  2. `Adorable original creature "{{NAME}}" inspired by a {{ANIMAL}}, {{PERSONALITY}}, one exaggerated feature, soft fur texture, clean silhouette, studio 3D render, transparent background`
  3. `Cute animal companion "{{NAME}}", {{PERSONALITY}} expression, chibi-adjacent proportions, {{ACCENT_HEX}} and cream palette, soft lighting, isolated on transparent background`

### 5.8 `mecha` — Mecha (8 sprites, 4 with sheets)
Mecha/anime-robot heads — angular armor, glowing visors.

- **Mood:** heroic, high-energy, anime.
- **Palette:** `#475569` (gunmetal), `#cbd5e1` (armor white), `#ef4444` (red accent), `#3b82f6` (blue accent), `#22d3ee` (visor glow), `#0f172a` (dark).
- **Rendering:** cel-shaded-anime-inflected 3D render, crisp panel lines, glowing visor slit.
- **Silhouette:** angular head/helmets with fins, horns, or crests; sharp chin, visor eyes. Heads only (bust-up).
- **Prompts:**
  1. `Anime mecha robot head "{{NAME}}", {{PERSONALITY}} expression, angular armored helmet with {{ACCENT}} fin, glowing cyan visor slit, crisp panel lines, cel-shaded 3D render, bust portrait centered, transparent background`
  2. `Giant-robot head unit "{{NAME}}", {{PERSONALITY}} mood, gunmetal and white armor, single glowing mono-eye or visor, sharp heroic silhouette, anime mecha style, 3D render with cel shading, transparent background`
  3. `Mecha helmet "{{NAME}}" with {{PERSONALITY}} energy, layered angular plates, red and blue accent stripes, luminous sensor eyes, clean hard-surface 3D render, centered bust, transparent background`

### 5.9 `minimals` — Minimals (8 sprites, 2 with sheets)
Ultra-minimal geometric marks for serious/enterprise bots.

- **Mood:** precise, trustworthy, quiet.
- **Palette:** one hue per mark at two weights — blues `#2563eb`/`#93c5fd`, greens `#059669`/`#6ee7b7`, violets `#7c3aed`/`#c4b5fd`, slate `#334155`/`#94a3b8`. White `#ffffff` negative space.
- **Rendering:** flat vector, no gradients except one allowed soft tint; pixel-perfect symmetry where the design calls for it.
- **Silhouette:** pure geometry — circles, arcs, squares, single diagonal cuts. Must survive 16×16 favicon-scale reduction.
- **Prompts:**
  1. `Ultra-minimal geometric logo-mark for an AI bot "{{NAME}}", {{PERSONALITY}} feel, flat vector style, single {{HUE}} color on transparent, bold simple geometry, enterprise-grade, centered, generous padding`
  2. `Minimal abstract bot glyph "{{NAME}}", {{PERSONALITY}}, flat vector, circle-and-arc construction, {{HUE}} on transparent background, crisp edges, designed to read at 16px`
  3. `Simple geometric avatar mark "{{NAME}}", {{PERSONALITY}} character, flat vector icon style, one accent hue {{HUE}}, clean negative space, centered in square frame, transparent background`

### 5.10 `cyber` — Cyber (8 sprites, 4 with sheets)
Cyberpunk/neon heads.

- **Mood:** nocturnal, edgy, high-voltage.
- **Palette:** `#0b0b0c` (black chrome), `#22d3ee` (cyan neon), `#e879f9` (magenta neon), `#a3e635` (acid green), `#facc15` (warning yellow), `#64748b` (steel).
- **Rendering:** glossy dark 3D render with emissive neon trim, wet-look reflections, dramatic rim light.
- **Silhouette:** humanoid-bot heads with cables, mohawk fins, asymmetrical tech; neon lines trace the silhouette.
- **Prompts:**
  1. `Cyberpunk robot head "{{NAME}}", {{PERSONALITY}} attitude, glossy black chrome with {{NEON_HEX}} neon trim lines, cables and asymmetrical tech details, emissive eyes, dark 3D render, dramatic rim lighting, bust centered, transparent background`
  2. `Neon-drenched android head "{{NAME}}", {{PERSONALITY}} mood, dark metal face with glowing {{NEON_HEX}} circuit tattoos, sleek and edgy, reflective surfaces, cyberpunk aesthetic, 3D render, transparent background`
  3. `Street-tech bot head "{{NAME}}", {{PERSONALITY}} energy, black and steel plating with acid-green and magenta neon accents, visor grin, wet-look highlights, bust portrait, transparent background`

### 5.11 `magic` — Magic (8 sprites, 4 with sheets)
Fantasy familiars — sprite wisps, small dragons, golems.

- **Mood:** whimsical, arcane, gentle.
- **Palette:** `#fbbf24` (enchant gold), `#8b5cf6` (arcane violet), `#34d399` (fae green), `#f472b6` (charm pink), `#78350f` (earth brown), `#e0f2fe` (spirit light).
- **Rendering:** painterly-stylized 3D render or premium fantasy 2D — pick ONE per creature; soft magical glow accents, sparkles restrained.
- **Silhouette:** classic fantasy-readable shapes (wisp = teardrop flame, dragon = small winged, golem = chunky rock body) with one signature detail.
- **Prompts:**
  1. `Fantasy familiar "{{NAME}}", a {{CREATURE_TYPE}} with {{PERSONALITY}} personality, whimsical stylized design, soft magical glow, {{ACCENT_HEX}} accent, full body centered, transparent background, storybook-fantasy quality`
  2. `Small magical creature "{{NAME}}", {{CREATURE_TYPE}}, {{PERSONALITY}} mood, glowing rune markings, gentle sparkles, painterly 3D render, clean silhouette, transparent background`
  3. `Arcane companion "{{NAME}}", {{CREATURE_TYPE}} with {{PERSONALITY}} energy, enchanted gold and violet palette, soft inner light, fantasy character art, centered, transparent background`

### 5.12 `nature` — Nature (8 sprites, 4 with sheets)
Nature spirits — leaf, golem, stone, ember beings.

- **Mood:** grounded, serene, ancient.
- **Palette:** `#22c55e` (leaf), `#65a30d` (moss), `#a8a29e` (stone), `#78716c` (bark), `#f97316` (ember), `#0ea5e9` (water), `#fef3c7` (sunlit cream).
- **Rendering:** stylized 3D render with matte organic textures (leaf veins, rock grain, bark); soft ambient light.
- **Silhouette:** humanoid-plant/elemental forms — leaf-caped figures, chunky rock golems, wispy ember sprites; asymmetry from nature, not chaos.
- **Prompts:**
  1. `Nature spirit "{{NAME}}", a {{ELEMENT}} being with {{PERSONALITY}} presence, body made of {{MATERIAL}}, matte organic texture, soft ambient lighting, full body centered, transparent background, serene fantasy style`
  2. `Elemental nature creature "{{NAME}}", {{ELEMENT}} spirit, {{PERSONALITY}} mood, {{MATERIAL}} body with glowing core detail, stylized 3D render, clean grounded silhouette, transparent background`
  3. `Gentle forest guardian "{{NAME}}", {{ELEMENT}} elemental, {{PERSONALITY}} energy, moss and stone texture, warm dappled light feel, centered full body, transparent background`

### 5.13 `retro-pixel` — Retro Pixel (8 sprites + 8 sheets)
Retro pixel-art bots and pets. All 8 are animated — sheets must read as true pixel art.

- **Mood:** nostalgic, charming, 16-bit honest.
- **Palette:** strict 16-color ramp per sprite; shared system colors: `#0b0b0c` outline, `#f8fafc` highlight, `#22d3ee` screen-glow, `#fbbf24` accent.
- **Rendering:** true pixel art — hard edges, no anti-aliasing, no gradients; draw at 48×48 or 96×96 logical pixels and scale nearest-neighbor up to the frame size. Sheets: each 192×208 cell holds a crisp pixel sprite (~64–96 px tall) with nearest-neighbor scaling.
- **Silhouette:** chunky readable blobs; 1–2 px outline; expression via 2×2/3×3 px eyes.
- **Prompts:**
  1. `16-bit pixel art robot pet "{{NAME}}", {{PERSONALITY}} personality, chunky readable silhouette, 16-color palette with cyan screen glow, hard pixel edges, no anti-aliasing, centered, transparent background, retro game sprite`
  2. `Retro pixel-art bot "{{NAME}}", {{PERSONALITY}}, classic platformer enemy-turned-friend style, bold 1px outline, expressive 3x3 pixel eyes, limited 16-color palette, transparent background`
  3. `Cute pixel creature "{{NAME}}", {{PERSONALITY}} mood, 16-bit console sprite style, clean clusters, high contrast, no gradients, centered on transparent background`

### 5.14 `office-professionals` — Office Professionals (8 sprites, 2 with sheets)
Character portraits in professional attire — bust portraits, diverse, warm, competent. Portrait-first pack (only `counsel` and `strategist` are animated).

- **Mood:** approachable expertise; a colleague you'd trust with the account.
- **Palette:** clothing `#1e293b`/`#334155`/`#475569` (suits), skin tones varied and natural, accents per role (analyst teal, engineer orange, designer violet), background transparent.
- **Rendering:** modern stylized 3D or premium flat illustration — pick ONE and keep it across all 8; soft studio light, shoulders-up bust.
- **Silhouette:** shoulders-up portrait, head ~55% of frame, consistent camera; differentiation via hair, glasses, attire, expression — never via style shift.
- **Prompts:**
  1. `Professional bust portrait of "{{NAME}}", a {{ROLE}}, {{PERSONALITY}} expression, modern stylized 3D render, business-casual attire with {{ACCENT_HEX}} accent, shoulders-up, centered, transparent background, friendly competent energy`
  2. `Corporate avatar illustration of "{{NAME}}", {{ROLE}}, {{PERSONALITY}}, premium flat illustration style, clean shapes, soft shading, shoulders-up bust, transparent background, consistent series style`
  3. `Friendly professional character "{{NAME}}", a {{ROLE}} with {{PERSONALITY}} demeanor, stylized portrait, subtle role prop (headset, pencil, tablet — no logos), shoulders-up, centered, transparent background`

### 5.15 `space-corps` — Space Corps (8 sprites, 4 with sheets)
Astronaut and space-explorer bots.

- **Mood:** adventurous, mission-ready, optimistic.
- **Palette:** `#f8fafc` (suit white), `#cbd5e1` (suit gray), `#f97316` (safety orange), `#0ea5e9` (mission blue), `#111827` (space black visor), `#22d3ee` (HUD cyan).
- **Rendering:** soft 3D render, studio lighting, octane-style; fabric + matte suit panels + reflective visor.
- **Silhouette:** rounded helmet + backpack unit = strong unified silhouette; role variants differ by visor shape, antenna, and pack details.
- **Prompts:**
  1. `Friendly astronaut robot "{{NAME}}", {{PERSONALITY}} personality, white and gray spacesuit with {{ACCENT_HEX}} mission patches (no flags/logos), reflective dark visor with glowing cyan HUD eyes, soft 3D render, full body or bust centered, transparent background`
  2. `Space explorer bot "{{NAME}}", {{PERSONALITY}} mood, rounded helmet, backpack life-support unit, orange safety accents, clean toy-like 3D render, centered, transparent background`
  3. `Retro-futuristic astronaut character "{{NAME}}", {{PERSONALITY}} energy, bubble helmet, soft studio lighting, white suit with blue trim, 3D render, transparent background`

---

## 6. Naming & QA checklist

Run before you hand off. Every item must pass.

**Naming**
- [ ] Every file exactly matches the inventory in §2 — lowercase slug, `.webp` extension, `-sheet` suffix where declared. No spaces, no `Copy of`, no `-final-final`.
- [ ] Files live under `surfaces/ai.allternit.com/public/avatar-packs/<pack-id>/` (create the dir per pack).

**Dimensions & format**
- [ ] Portraits: exactly 512×512 px, WebP, ≤ 200 KB each.
- [ ] Sheets: exactly 1536×1872 px, WebP, ≤ 1.5 MB each.
- [ ] Portraits/sheets that should be transparent actually have an alpha channel (no accidental white matting).

**Visual QA (every sprite)**
- [ ] Downscale check: legible at 48×48 and 96×96.
- [ ] Legible on white and on `#0b0b0c`.
- [ ] No text, watermarks, extra limbs, busy backgrounds (see negative prompt).
- [ ] Pack coherence: sprite looks like it belongs with its 7 pack-mates (same palette, lighting, style).
- [ ] Sheets: 8×9 grid exact, character anchored bottom-center in all 72 frames, row 1 idle loops, row-to-row pose continuity, no frame spill across cell boundaries.
- [ ] Regenerate any failure — do not patch or hand-edit frames.

## 7. How to validate

From the repo root:

```bash
npx tsx -e "
import { AVATAR_PACKS, AVATAR_PACK_ASSET_ROOT } from './ui/views/agent-view/components/create-bot/avatar-packs';
import fs from 'node:fs';
const root = 'surfaces/ai.allternit.com/public';
let missing = 0, total = 0;
for (const pack of AVATAR_PACKS) {
  const urls = pack.sprites.flatMap((s) => (s.sheetUrl ? [s.portraitUrl, s.sheetUrl] : [s.portraitUrl]));
  for (const u of urls) {
    total++;
    const diskPath = u.replace(AVATAR_PACK_ASSET_ROOT, root);
    if (!fs.existsSync(diskPath)) { missing++; console.log('MISSING', diskPath); }
  }
}
console.log(\`\${total - missing}/\${total} assets present\`);
process.exit(missing ? 1 : 0);
"
```

It imports the real manifest (so the check can never drift from the data), resolves every `portraitUrl`/`sheetUrl` against `surfaces/ai.allternit.com/public/`, and exits non-zero if anything is missing. Run it before handoff; it should print `200/200 assets present`. Add dimension checks with any WebP-capable tool (`ffprobe`, ImageMagick's `identify`, or `npx sharp-cli info`).

---

*When everything on the checklist passes, the assets are ready for the UI pass that renders `avatar-packs.ts`.*
