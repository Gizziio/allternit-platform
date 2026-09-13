# Artifacts

An **artifact** is a self-contained piece of generated content — most often HTML — that gets a stable address, immutable versions, and optional routes to the outside world. Saving one mints an `a://artifact/<id>` address on your local gateway.

## Addresses

```
a://artifact/art_9f3c…          this gateway
a://artifact/art_9f3c…@gw-b     read-through to a peer gateway (see Relay)
```

Cowork surfaces resolve `a://` links inline: the card fetches the artifact and renders it in the same sandboxed iframe as the design preview.

## The gateway API

Served by the local gateway (`allternit-api`) under `/api/v1`, user-scoped:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/content-artifacts` | Create (also creates version 1) |
| GET | `/content-artifacts/:id` | Read current version (body inline) |
| GET | `/content-artifacts?type=&project=&q=&limit=&cursor=` | List, cursor-paginated |
| PUT | `/content-artifacts/:id/versions` | Append an immutable version |
| GET | `/content-artifacts/:id/versions` | List versions (no bodies) |
| GET | `/content-artifacts/:id/versions/:n` | Read one version (body inline) |
| DELETE | `/content-artifacts/:id` | Soft delete |
| GET/PUT/DELETE | `/content-artifacts/:id/files[/*path]` | Per-project file tree |

**Idempotency.** Create and version-append accept an idempotency key (header or body). Retries inside the 24-hour window return the original record with `200` instead of creating a duplicate.

**Storage.** Bodies ≤ 256 KB are stored inline; larger versions are file-backed under the gateway data dir. File-tree writes are sha256-checked and path-validated.

**Versions are append-only.** There is no rewrite — every save is a new version. The store caps each artifact at **50 versions** (env `ALLTERNIT_CONTENT_ARTIFACT_MAX_VERSIONS`, admin-configurable) and prunes the oldest beyond the cap, so history is bounded by construction.

## Where artifacts come from

- **Design sessions** save through the API (offline: the local IndexedDB cache holds the save and syncs when the gateway is reachable; the gallery reads gateway-first with a local-only merge).
- **Chat** — "Save to artifacts" on any generated artifact persists it through the API with session provenance (`sourceSessionId`) and shows you the minted `a://` address.
- **CLI** — from gizzi-code:

```
gizzi artifact save <file>     # store a file as an artifact
gizzi artifact list            # your artifacts
gizzi artifact show <id>       # one artifact, current version
```

- **Relay** — sent from another gateway (below).

## Typed renderers

Artifact types render with purpose-built chrome while sharing the same sandbox:

| Type | Renderer |
|------|----------|
| deck | Slide chrome with `slideIndexChanged` postMessage and `#slide-N` hash navigation |
| mobile | 390px device frame |
| prototype | Pinned standard sandbox |
| html / svg / mermaid / react | Direct sandboxed render |

## Publish

Publishing deploys an **immutable version snapshot** to Cloudflare Pages — the version you reviewed is the version that goes live, and later version appends do not change it.

```
POST   /api/v1/content-artifacts/:id/publish    # {version?} — defaults to current
GET    /api/v1/content-artifacts/:id/publish    # status
DELETE /api/v1/content-artifacts/:id/publish    # unpublish
```

Semantics, decided and enforced:

- **Shared project, per-user routes.** One Pages project; each user gets a route prefix `u-<hash>/<artifact_id>`. There are no per-user projects to manage.
- **Snapshot, not live.** Publish pins the resolved version. Appending v2 does not change what the route serves until you publish again.
- **Unpublish removes the route only.** Deployments are immutable — unpublish detaches the route but the underlying deployment URL stays live. Treat publish as public.
- **Sandbox gate.** Artifacts whose sandbox policy requests network access are rejected at publish with `422` and an error naming the policy.
- **Idempotent.** Republishing the same version replays `200` with no redeploy.

The publisher is pluggable via env: `ALLTERNIT_ARTIFACT_PUBLISHER=wrangler` deploys with `npx wrangler pages deploy` to the project named by `ALLTERNIT_ARTIFACT_PAGES_PROJECT`; the default `fs` publisher writes immutable deployments and removable routes under the gateway data dir for dev/test.

## Relay (org mesh)

Relay moves an artifact between gateways — laptop to desktop, you to a teammate — over the org mesh envelope format.

```
POST /api/v1/content-artifacts/:id/relay    # {target: <peer gateway base URL>}
POST /api/v1/content-artifacts/relay/inbox    # receiving endpoint (internal token required)
```

Receiving semantics, decided and enforced:

- **New local id.** The receiving gateway mints a fresh `art_<uuid4>`; the origin id and gateway travel in `provenance.relay`, so a relayed artifact is never silently overwritten onto a local one.
- **Standard sandbox.** Relayed artifacts render under the normal sandbox policy — no stricter "received" mode — but the provenance line is displayed in the gallery so you can see where a thing came from.
- **Idempotent by bundle hash.** Resending the same bundle dedupes to a replay instead of a duplicate.
- **Authenticated.** The inbox rejects unauthenticated or wrongly-tokened posts with `401`; the token is gateway-local config.
- **Addressed reads.** `a://artifact/<id>@<gateway>` resolves locally first, then asks the named peer. Every hop is ledgered as a `ContentArtifactRelayed` event.

## Security model

The API stores and serves; it never executes. Execution happens only in surfaces, inside the sandboxed iframe with the strict CSP documented in [Design mode](design-mode.md#sandbox) — no same-origin, no network, no persistent storage. The sandbox gate at publish exists because a page that needs network can't be made safe by hosting; the honest answer is to refuse it.
