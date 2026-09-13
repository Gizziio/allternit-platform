# A:// Studio — Design & Artifacts

**A:// Studio** is Allternit's design surface: a mode where you describe what you want, watch the agent build it as a live HTML artifact, refine it by clicking the parts you want changed, and keep the result as a versioned, addressable artifact you can share, publish, or send to another gateway.

It runs in three places:

- the **platform web app** (Design in the rail)
- the **Allternit Desktop app** (same surface, bundled)
- the **gizzi-code terminal** — `/design [prompt]` opens the studio with your prompt pre-loaded

## The two pages

| Page | Covers |
|------|--------|
| [Design mode](design-mode.md) | Generating, surgical editing, edit-in-place, critique, gallery, self-verification, the `/design` command |
| [Artifacts](artifacts.md) | The `a://artifact/<id>` system: gateway API, versions, file trees, CLI, publish to Cloudflare Pages, org relay, sandbox security |

## The model in one paragraph

A design session produces a **self-contained HTML artifact**. Artifacts render in a sandboxed iframe (strict CSP, no network), so generated code can never phone home. Saving an artifact mints an `a://artifact/<id>` address on your local gateway and stores immutable versions (capped at 50, oldest pruned). You can publish a version snapshot to a per-user route on Cloudflare Pages, or relay the artifact to another gateway over the org mesh — the receiving side gets a new local id and a provenance chain, never silent overwrites.

## Honest limits

- **Local-first.** One gateway is one machine. Cross-machine access is via relay or publish, not sync — two machines can hold different artifacts with the same origin, and there is no conflict-resolution story for that yet.
- **Publish keeps history.** Unpublishing removes the route, but Pages deployments are immutable — a previously published URL that someone saved stays live. Publish only what you intend to be public.
- **The sandbox is the spec.** Artifacts can't fetch, can't persist, can't escape their iframe. If a generated page "needs" network access, it can't be published (the publish gate rejects it) and it won't work as an artifact.
