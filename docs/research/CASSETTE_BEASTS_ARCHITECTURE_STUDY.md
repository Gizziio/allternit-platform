# Cassette Beasts — Code Architecture Study (Clean-Room)

> **Provenance:** Compiled 2026-09-04 from public sources only: official Bytten Studio dev blogs, the official modding wiki (written by the game's programmer), the Godot engine showcase interview, MIT-licensed open-source mods, and MIT-licensed community tools that parse the game's data formats.
>
> **Legal posture:** Study of architecture *patterns* for original implementation in Gizzi. No game assets, code, data tables, or text from Cassette Beasts are to be copied. Insights are re-implemented as original code. Class/resource names below are factual identifiers cited for reference, not implementation.
>
> **Status:** Research complete. Verified facts marked ✅; single-source or unverified claims flagged ⚠️.

---

## 1. Correction: "Cassette Beasts 2002"

There is **no free retro companion game**. *Cassette Beasts 2002* is the full sequel (announced June 2026, release window March 2027, PS5/Xbox Series/Switch 2/PC). Reported: 250+ beasts, 57,000+ fusions, a new in-battle "alchemy" mechanic, online multiplayer at launch, save import from CB1. No engine confirmation or technical writeups exist yet. This study covers **Cassette Beasts (2023)**, whose internals are unusually well documented because of its official modding program.

---

## 2. Stack Facts (verified)

| Fact | Detail |
|------|--------|
| Engine | Godot 3.5.1 (later 3.x untested, 4.x incompatible — official mod guide) |
| Language | GDScript exclusively ✅ |
| Team | 2 full-time (1 programmer, 1 artist/designer) + part-time animator/illustrator/composer |
| Ship binary | Customized engine build — patched GridMap performance, thread-safety fixes in resource loading and audio |
| Ports | Third-party (Pineapple Works) on closed Godot 3.x console ports |
| Multiplayer | Lockstep co-op, added post-launch (May 2024) — battle-relevant data is network-protocol-tagged |

The programmer's GitHub history on godotengine/godot (25+ issues/PRs, 2020–2024) is effectively a public production log: alpha-scissor flicker, GridMap visibility bugs, audio "finished" signal never firing headless, locale changes breaking remapped fonts, store_string corruption on Windows, yield/free use-after-frees.

**Lesson for Gizzi:** engine source access was load-bearing. Picking open-source tooling where we can patch the engine/runtime ourselves is a deliberate architecture decision, not a preference.

---

## 3. Data Architecture — the core lesson

The game is aggressively **data-driven**: hot-loaded directories of Godot text resources (`.tres`), one resource per entity, with per-entity behavior scripts attached where logic varies.

### 3.1 Directory layout (recovered from modding docs + MIT mods)

```
res://data/
├── monster_forms/          # one .tres per species ("MonsterForm")
├── battle_moves/           # one .tres per move ("BattleMove") + behavior script
├── battle_move_scripts/    # e.g. GenericAttack.gd — strategy-pattern move logic
├── elemental_types/        # one .tres per type
├── status_effects/
├── sticker_attribute_profiles/
├── attack_vfx/  hit_vfx/
res://battle/backgrounds/battle_backgrounds.tres
res://world/maps/...        # maps are scenes (.tscn)
res://mods/<mod_id>/        # mods mirror the same layout
```

### 3.2 Species resource schema (MonsterForm — parsed field-by-field by the MIT tool cbpickaxe)

- **Base stats:** max_hp, melee_attack, melee_defense, ranged_attack, ranged_defense, speed, accuracy, evasion, max_ap (base-stat totals ~800)
- **Move access:** `move_tags` — tag-based equip restrictions (a creature can only equip moves matching its tags or `"all"`); move learnsets are tag-driven, not per-species lists
- **Progression:** `tape_upgrades` (grants move slots / stickers at tape grades); `evolutions` gated by `required_tape_grade`, in-game clock (`min_hour`/`max_hour`), `required_location`, `specialization`, `is_secret`
- **Identity/palette:** `default_palette`, `emission_palette`, `swap_colors` — recolor support baked into the species resource; a "bootleg" variant is literally a type/palette override on the tape (`TapeConfig.type_override`)
- `exp_yield`, `battle_sprite_path`, `bestiary_index`

**Pattern to adopt:** the species resource is the *single source of truth* for stats, moves access, progression, and recoloring. Variants (shiny/bootleg equivalents) are data overrides, not new assets.

### 3.3 Move resource schema (BattleMove)

Moves are data + an attached GDScript behavior script (strategy pattern — most moves share `GenericAttack.gd`; unusual moves attach their own script). Fields: power, `physicality`, elemental type (empty = typeless/adapts to user), **crit as a numerator/denominator fraction** (1/16, 150% damage), min/max hits, accuracy, priority, cost (AP), category (Melee/Ranged/Misc/Status + active/passive/automated), target type (single/team/self/single ally/all/all-except-self), tags (gate sticker/learnset compatibility), status effects (amount/chance/apply mode), VFX/SFX/camera hooks, `attribute_profile`, `attack_animation`, `attack_duration`.

### 3.4 Types are nearly empty resources

An `ElementalType` `.tres` carries essentially just a **color palette**. Types double as palette/identity data. The damage chart itself lives engine-side (⚠️ location not publicly verified).

### 3.5 File-keyed identity

Species are identified **by filename, not numeric ID**. Bestiary index −1 renders as "#???". This was a deliberate architectural decision so third-party content never needs ID allocation.

**Pattern to adopt:** string/file-keyed entity identity beats integer IDs for any system expected to grow via content packs or mods.

### 3.6 Registry access

A `Datatables` autoload wraps data dirs: `Datatables.load("res://data/battle_moves")` → table wrapper with `.table: Dictionary`; registries like `BattleMoves` expose `by_id`, `by_tag`, stickers-by-tag queries.

---

## 4. Battle System Design

### 4.1 Action Point economy

- Everyone starts at **0 AP**; **+2 AP per round** (fused battlers gain the combined 4 on one character)
- Moves cost **0–10 AP** — deliberately replaces MP/PP/cooldown systems (board-game-inspired)
- Design rationale (dev blog): PP/cooldowns create feel-bad bookkeeping; AP makes every turn a visible economic decision

### 4.2 Stickers = moves as inventory

- Moves are physical "stickers" slotted into tape slots; swappable freely outside battle
- **Passive stickers** with trigger conditions; uncommon/rare variants with bonus effects
- Tag system gates what each creature can equip — the same tags drive learnsets, so one mechanism serves both

### 4.3 Chemistry (type reactions)

Elements don't just deal bonus damage — typed attacks trigger *reactions* on the target's current types (e.g. Air applied to Fire = Extinguish debuff; Fire applied to Air = Updraft wall). Dual-type fusions trigger both reactions from untyped moves. 14 element types.

**Pattern to adopt:** reactions-as-data (typed status transitions) composes far better than a flat damage multiplier table, and makes dual-typing mechanically meaningful rather than just a second lookup.

### 4.4 Capture ("Recording")

Mid-battle action; the recorder returns to vulnerable human form for a turn. Success % modified by tape quality, target HP, and damage dealt/taken that turn. (Design-level only — capture math is not publicly documented ⚠️)

---

## 5. Fusion System

- 120 base species → 120² = **14,400 fusions**, all fully animated (post-DLC: 141 → 19,881; CB2002 claims 57,000+)
- **Core architecture, per the artist's own description:** each monster has a *second, modular animated version*; the fusion engine mix-and-matches parts at runtime and combines stats. Sprites are procedurally composited — fully animated, not static mashups
- Fusion is temporary (one battle; if KO'd, both parents faint), gated by a fusion gauge, and relationship hearts (1–5) scale fusion stat bonuses; max relationship unlocks "Fusion Power" moves
- Supporting art constraint: all monsters share a strict ~20-color palette, making part-swapping/recoloring tractable
- Fusion rendering is a runtime code path — the shipped editor tool `MonsterPreview.tscn` previews "animations, coatings, and fusions"
- **Design stance:** broken/OP fusion outcomes are accepted by design ("you can end up with very broken fusions. However… we're not too worried about that")
- ⚠️ No public doc on part-matching rules, stat-merge formula, or fusion name generation — these internals would require analyzing the shipped binary, which we have not done

**Pattern to adopt:** combinatorial content generation requires (a) modular part rigs designed for recombination, (b) a strict shared palette, and (c) accepting balance chaos as a feature. The fusion *name* generation and stat-merge formulas are the interesting open problems to design originally.

---

## 6. World Tech

- **2.5D**: 3D voxel world, fixed camera, grid terrain designed as if 2D top-down
- Overworld = **16×8 chunks × 32×32 tiles** (≈ 2× A Link to the Past's Hyrule)
- Built with **GridMap** nodes (3D tilemaps); voxel meshlibs authored in Qubicle, exported to Godot
- **Chunk-streaming script** watches player position, loads/instances/adds visible chunks at runtime; partially works in-editor for context previewing
- 2D characters/monsters are **billboarded sprites in the 3D world** with alpha-scissor cutout; rendering relies on the depth prepass being enabled (community-verified)
- Level design workflow: high-level PNG/paper flow-networks (loops, one-way paths) → GridMap shape → puzzles/chests/spawners → decorations last
- Engine GridMap source was patched for their use case — noted as a strength of open-source engines

---

## 7. NPC / Interaction Architecture (from modding guides — MIT-licensed)

- Interactions run through `Interaction.gd`, which looks for a child node named `InteractionBehavior`
- **Behavior trees are node-based, composed in the editor**: base classes `ActionBase` → `Action` / `ActionValue`; `DecoratorAction`, `CompositeAction` → `Sequence`; concrete actions: `Cutscene` (locks player), `FaceTowardsAction`, `MessageDialogAction`, `MenuDialogAction`, `JumpAction`, `WaitAction`; value nodes like `GetPlayer`
- Actions run children in tree order and can succeed/fail — classic composite behavior tree, but built from Godot nodes so non-programmers compose them in-editor
- Quests are scenes (`data/passive_quests/*.tscn`) with a `Quest` class exposing kinds (`QuestKind.PASSIVE`) and map markers

**Pattern to adopt:** node-composed behavior trees give designers a no-code AI/dialogue/cutscene system for free — the editor *is* the behavior-tree editor.

---

## 8. Mod / Save / Multiplayer Architecture

### 8.1 Mod system (built-in, not bolted-on)

- Mods are `.pck` packs loaded via `ProjectSettings.load_resource_pack` at startup; game scans `res://mods/` for `metadata.tres` (`ContentInfo` resource: id, version, author, **save_file_format_tag + version**, **network_protocol_tag**, startup hook)
- Runtime API: `DLC.has_mod(id, version)`, `DLC.mods_by_id`
- **Hard constraints that shape the whole codebase:** no `class_name`, no autoloads in mods (both register via project.godot, which mods never ship); mods "add new resources rather than replace" to avoid conflicts; script patching via `Resource.take_over_path()` + `node.set_script()`
- Consequence: the base game itself favors **data-driven Resources over deep class hierarchies**

### 8.2 Saves

- Format: gzipped JSON (`.json.gz` wrapped) in `user://`
- Version/format tags per mod — documented backwards/forwards compatibility rules
- Extensible save slots (an official example mod adds slots) — evidence saves are content-registered, not hardcoded
- Speedrun integration: many tracked stats exposed to LiveSplit via INI + server

### 8.3 Multiplayer

- Lockstep, network-protocol-sensitive: any change to species/moves/statuses/items affects compatibility; the tag system polices it
- Online cross-platform co-op shipped May 2024

---

## 9. Dev Tooling (shipped in the binary)

In-editor test scenes: `tools/custom_battle/CustomBattle.tscn` (configure any battle), `tools/monster_preview/MonsterPreview.tscn` (preview monsters with coatings/fusions), `tools/battle_vfx_preview/BattleVfxPreview.tscn`. Built-in cheat/debug console (auto-enabled from editor, flags saves). Battle backgrounds registered in a `.tres`.

**Pattern to adopt:** tooling-first. Every core system gets an in-editor test harness; the two-person team credits editor plugins as how they shipped a 30+ hour RPG.

---

## 10. Patterns to Adopt in Gizzi (original implementations)

1. **Resource-per-entity data dirs, hot-loaded.** Species/moves/types/items as data files with schema'd fields; one behavior-script slot for logic variance (strategy pattern).
2. **File/string-keyed identity**, never numeric IDs — mods and content packs never allocate ranges.
3. **Tag-driven move/equip access** — one tag mechanism serves learnsets, equip restrictions, and AI legality checks.
4. **Action-point battle economy** as an alternative to MP/cooldowns; reactions-as-data for elemental interplay.
5. **Node-composed behavior trees** for NPCs/cutscenes (editor doubles as the design tool).
6. **Format/protocol tags on saves and content** from day one — versioning is architecture, not an afterthought.
7. **Shared strict palette** on any recolorable/combinatorial content pipeline.
8. **In-editor harness scenes per system** (custom battle, previewer, VFX lab).
9. **Thin signal-emitting singletons** (`SceneManager`, `SaveState`, `Datatables`) rather than deep global state.
10. **Pick tooling whose engine/runtime source we can patch** — CB's programmer patched GridMap, resource loading, and audio thread-safety in production.

---

## 11. Clean-Room Reference Implementations (open source)

| Tool | License | Use |
|------|---------|-----|
| `ExcaliburZero/cbpickaxe` | MIT | Python parser of CB data formats; the authoritative MonsterForm schema reference |
| `AssistantApps/CassetteBeasts` | MIT | Automated GDRE-decompile pipeline; `.tres` parsing; sprite-sheet slicing from frame-coordinate `.txt` files |
| `Yukitty/CassetteBeasts-qol`, `-modutils` | MIT | Real autoload/API surface usage (`SceneManager`, `SaveState`, `Datatables`, `DLC`) |
| `ninaforce13/CassetteBeasts-StickerModdingGuide`, `CustomPaletteExtender` | MIT | Move/sticker data formats; palette model (15 colors, 3 regions of 5) |
| `pwinckles/cassette-beasts-explorer` | MIT | Queryable species/move dataset; exact stat/move schema |
| Godot official docs (Resources, Autoloads) | CC-BY | `.tres` gotchas: inner classes don't serialize; `.duplicate()` resources before runtime mutation |
| GDQuest FSM guide | free | enum/`match` state machine first; node-based `State`/`StateMachine` when states grow |

For Godot 4 implementation patterns (community consensus, mirrors CB's design): `.tres` resources duplicated at runtime, enum/`match` battle state machine gating all input by phase, thin autoloads, JSON-in-`user://` saves with `version` int + per-object `serialize()`.

---

## 12. Sources (all fetched and cross-checked 2026-09-04)

**Primary (Bytten / official):**
- https://godotengine.org/article/godot-showcase-cassette-beasts/ (engine interview)
- https://www.cassettebeasts.com/2021/08/09/technical-look-the-park/ (world tech)
- https://www.cassettebeasts.com/blog/ (battle, recording, fusion, elements, game modes posts)
- https://www.cassettebeasts.com/fusion/ (official fusion demo)
- https://wiki.cassettebeasts.com/wiki/Modding/Mod_Developer_Guide (programmer-authored)
- https://wiki.cassettebeasts.com/wiki/Modding/Monster_Making_Guide_Part_1

**Mods / tools (MIT, fetched):**
- https://github.com/Yukitty/CassetteBeasts-qol · https://github.com/Yukitty/CassetteBeasts-modutils
- https://github.com/ninaforce13/CassetteBeasts-StickerModdingGuide · https://github.com/ninaforce13/CustomPaletteExtender
- https://github.com/AssistantApps/CassetteBeasts · https://github.com/ExcaliburZero/cbpickaxe
- https://github.com/pwinckles/cassette-beasts-explorer

**Sequel:** https://rawfury.com/raw-fury-reveals-cassette-beasts-2002/ · https://www.gematsu.com/2026/06/cassette-beasts-2002-announced-for-ps5-xbox-series-switch-2-and-pc · https://store.steampowered.com/app/3802140/Cassette_Beasts_2002/

**Godot patterns:** https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html · https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html · https://gdquest.com/tutorial/godot/design-patterns/finite-state-machine/ · https://codingquests.io/blog/how-to-build-a-save-system-in-godot-4

**Not found (would require binary analysis, out of scope):** battle engine class structure, fusion stat-merge formula, capture math, damage chart location, engine patch contents.
