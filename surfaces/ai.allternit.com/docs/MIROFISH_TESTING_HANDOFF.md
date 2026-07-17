# MiroFish — Testing Handoff

For: an agent with a working browser (Claude Desktop / Claude in Chrome, or a human).
Not for: re-reading — this doc is meant to be actionable standalone, no other context needed.

## What this is

MiroFish is a population-simulation feature: seed material (news/policy/financial/narrative) goes
in, an LLM-generated population of personas reacts to it over several rounds, and you get a
round-by-round report plus the ability to chat with any individual simulated persona afterward.

It's built and merged into `main` already (commit `de38f5de8`, fast-forwarded from branch
`ao/swarm-mirofish`). It is **not** a new top-level mode — it's a nested sub-tab inside the
existing **Agent Swarm** mode, next to the existing "Specialist Team" behavior (which is
untouched).

Full background: `docs/SWARM_MIROFISH_MAP.md` (product context + architecture) and
`docs/SWARM_MIROFISH_PHASE_1_NOTES.md` / `_PHASE_2_NOTES.md` / `_PHASE_3_NOTES.md` (what was
built and verified in each of the three build phases). `docs/SWARM_ADJACENT_FEATURES.md` has
brainstormed follow-on features, not relevant to testing.

## What has and hasn't been verified so far

Verified by static code review + the executor's own test runs (20 unit tests passing across the
swarm scheduler, memory store, and simulation engine) — **but never actually run in a live
browser against a real model.** That's the gap this handoff is for. The previous session had no
working browser automation available to close that gap itself.

## Prerequisites

1. **Repo**: `~/Desktop/allternit-workspace/allternit`, already on `main`, already has the merge.
   No git action needed unless you want to `git pull` in case anything else landed since.
2. **Model access.** RESOLVED for local dev (2026-07-17): `getLanguageModel` in
   `src/lib/ai/providers.ts` honors a dev-only `VITE_LOCAL_AI_BASE_URL` override (set in
   `.env.local`, currently pointing at local Ollama with `qwen2.5:0.5b`) — every built-in mode's
   model calls route there. Just make sure Ollama is running (`ollama pull qwen2.5:0.5b`).
   Background: browser-direct calls to the Vercel AI gateway are CORS-blocked and no
   `AI_GATEWAY_API_KEY` exists locally, so without the override every mode fails identically.
   Remove the two `VITE_LOCAL_AI_*` lines to restore the production gateway path.
3. `E2B_API_KEY` is **not** required to test MiroFish — the simulation engine intentionally uses
   `LocalSwarmProvider` (in-process, no external sandbox), not the E2B-backed tier. E2B only
   matters if you're testing `src/lib/sandbox/swarm/e2b-provider.ts` directly, which is unrelated
   to this feature.
4. Local `allternit-api` gateway service on port 8013 should be running (`curl -s -o /dev/null -w
   '%{http_code}' http://127.0.0.1:8013/health` → expect `200`). It was already up as of this
   handoff; if not, check how the rest of this repo normally starts it.

## Starting the app

```bash
cd ~/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com
pnpm dev
```

This is a Vite SPA (not Next.js despite some leftover `NEXT_PUBLIC_*` env var naming). It wants
port 3013; if that's taken it'll fall back (it fell back to **3014** last time — read the
terminal output for the actual `Local:` URL it prints). Self-hosted mode is on
(`ALLTERNIT_PLATFORM_DISABLE_CLERK=1` in `.env.local`), so you should land straight in the app
with no login screen.

## Steps to reach and test MiroFish

1. Open the app root in a browser.
2. **Enable agent mode first**: on the landing composer, click the **"Agent Off"** pill in the
   bottom dock. The mode dock does not render at all until agent mode is on. (Verified 2026-07-17
   — the original version of these steps skipped this and the Agent Swarm option was nowhere to
   be found.)
3. Select **Agent Swarm** from the mode dock. Note: the mode dock is a **popover**, not a visible
   tab row — click the trigger button (`aria-label` is "Select mode", or "Mode: <current>" once
   one is chosen), then click **Agent Swarm** in the popover list. Careful with automation
   selectors: a name match on /Agent Swarm/i also hits the BottomDock pill, which *toggles agent
   mode off*.
4. A new row appears **below** the composer: a two-option strip, **"Specialist Team"** /
   **"Population Simulation"**. Click **"Population Simulation"**.
5. You should see a panel: a seed-material textarea, a "Kind" dropdown (News/Policy/
   Financial/Narrative/Other), and two number inputs (Population size 1–50, default 12; Rounds
   1–10, default 3).
6. For a first test, keep it cheap: paste in a short seed (a sentence or two of fake news/policy
   is fine), set **Population size to ~5** and **Rounds to 2** — each persona and each round is a
   real model call, so a full 12×3 run is ~48 calls.
7. Click **Run simulation**.

## What to look for / report back

- **Does the "Population Simulation" sub-tab even appear** next to "Specialist Team" when Agent
  Swarm is selected? If not, that's a real bug — screenshot the mode dock area and note what you
  see instead.
- **Does the panel render correctly** (all the fields described above, no visual breakage)?
- **Click Run.** Three possible outcomes, all informative:
  - **It errors immediately** with a message in a red box under the Run button — copy the exact
    text. If it mentions auth/gateway/API key, that's the known credential gap above, not a code
    bug — report it as "confirmed the wiring reaches the model call and fails on missing
    credentials" rather than "broken."
  - **It hangs on "Running…" indefinitely** — check the browser console (`F12` → Console) for
    errors, and check the terminal running `pnpm dev` for server-side stack traces. Report
    whatever shows up in either.
  - **It actually produces personas** — a grid of persona cards (name, short bio, a few trait
    tags) followed by a round-by-round report timeline. If you get this far: click a persona card,
    type a question in the "Ask {name}" box at the bottom, hit Ask or Enter, and confirm you get
    an in-character answer back. This is the "Deep Interaction" step — the actual proof the whole
    feature works end to end.
- Either way, paste back: the exact error text (if any), one example persona (if generated), and
  one round summary (if generated). That's enough for the next session to know exactly where
  things stand without re-deriving it.

## Do not touch

`src/plugins/built-in/swarms/plugin.ts`, `ModeDock.tsx`'s `MODE_TABS`/`SURFACE_MODES`,
`agent-mode-contracts.ts` — all deliberately untouched by this feature (Specialist Team must keep
working exactly as it did before). If testing surfaces a real bug, fix it in the MiroFish-specific
files (`src/lib/mirofish/`, `src/lib/sandbox/swarm/`, `src/plugins/built-in/mirofish/plugin.ts`,
`src/views/chat/components/SwarmSubModeTabs.tsx`, `src/views/chat/panels/MiroFishPanel.tsx`), not
the shared ones.
