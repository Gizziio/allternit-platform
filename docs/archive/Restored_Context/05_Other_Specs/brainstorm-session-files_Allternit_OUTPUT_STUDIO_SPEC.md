# Allternit Output Studio Spec (v0.1)

**Date:** 2026-02-18  
**Scope:** This spec defines the **Output Studio** layer and the **Marketplace** surfaces that extend it.  
**Explicit exclusions (non-goals):** Agent Studio (agent creation), agent swarm orchestration, agent lifecycle, planning/execution kernels.

---

## 0. Problem Statement

Allternit needs a dedicated layer where **agent outputs** (text, images, audio, video fragments, datasets, diagrams) can be:
- inspected,
- refined,
- composed,
- rendered,
- exported/published,

…using a plugin ecosystem that provides multimodal transforms and publishing connectors.

This layer must remain **strictly output-side** to avoid conflating:
- **Agent Studio** (build agents)
- **Swarm orchestration** (coordinate agents)
with **Output Studio** (polish + publish outputs).

---

## 1. Definitions

### 1.1 Output Studio
A user-facing environment for **post-processing and composition** of artifacts produced by agents (or humans).

### 1.2 Asset
A typed unit of content: `text`, `markdown`, `image`, `audio`, `video`, `dataset`, `chart`, `diagram`, `layout`, `template`, `receipt`.

### 1.3 Transform
A bounded operation producing a new asset from one or more input assets.

### 1.4 Pipeline Graph
A DAG of Assets + Transforms defining a reproducible output flow (NOT an agent plan).

### 1.5 Extension / Plugin
A Marketplace-distributed package that can add:
- transforms,
- panels,
- export targets,
- render backends,
- template packs,
- inspectors/overlays.

---

## 2. Non-Goals (Hard Boundaries)

Output Studio MUST NOT include:
- Agent creation tools (Agent Studio is separate).
- Multi-agent coordination / swarm management.
- Long-running background agents.
- Tool-loop arbitration or policy routing for agents.
- Autonomous execution scheduling.

Output Studio MAY integrate with those systems only via **import/export interfaces** (artifact exchange).

---

## 3. Core User Flows

### 3.1 Import Agent Output
- User receives artifacts from agents (or a job system) and imports into Output Studio as Assets.
- Studio creates a Project and places Assets into the library.

### 3.2 Compose
- User drags Assets into:
  - Canvas (layout),
  - Timeline (sequencing),
  - Graph (pipeline view, optional).

### 3.3 Enhance via Plugins
- Apply transforms (captioning, voice cleanup, storyboard extraction, slide generation, charting, etc.).
- Insert plugin panels (style pack chooser, citation overlay, export settings).

### 3.4 Render / Export
- Render jobs run via configured Render Backends.
- Exports generate **Render Receipts** for traceability and reproducibility.

### 3.5 Publish
- Push finished outputs to configured targets (S3, YouTube, CMS, Notion, PDF, LMS, etc.) using connectors.

---

## 4. System Architecture

### 4.1 High-Level Components

- **Output Studio UI (5-ui)**
  - Project browser
  - Asset library
  - Canvas editor
  - Timeline editor
  - Properties inspector
  - Plugin panels (embedded)
  - Export/Publish hub

- **Studio Service (services)**
  - Project/Asset metadata APIs
  - Transform execution (bounded jobs)
  - Render job submission + progress
  - Receipt generation
  - Template management

- **Object Storage**
  - Asset blobs (media files, datasets)
  - Render outputs

- **Job Queue**
  - Transform jobs
  - Render jobs
  - Publish jobs

- **Marketplace Registry**
  - Plugins, template packs, render backends, connectors
  - Capability graph + metadata

### 4.2 Separation Guarantees
- Studio service never schedules agent swarms.
- Studio jobs are **bounded** transforms/renders/publishes.
- Agent outputs enter Studio as immutable Assets; edits produce **derived** Assets with provenance.

---

## 5. Data Model (Minimum Viable)

### 5.1 Tables

#### `studio_projects`
- `id` (uuid)
- `owner_id`
- `name`
- `created_at`
- `updated_at`
- `thumbnail_asset_id` (nullable)
- `status` (active|archived)

#### `studio_assets`
- `id` (uuid)
- `project_id`
- `type` (text|markdown|image|audio|video|dataset|chart|diagram|layout|template|receipt)
- `uri` (object storage path)
- `hash` (sha256 of blob)
- `metadata_json` (duration, dimensions, codec, schema version, etc.)
- `created_at`
- `derived_from_asset_ids` (array or edge table)
- `source` (agent|user|plugin|import)
- `tags` (array)

#### `studio_transforms`
- `id`
- `name`
- `plugin_id`
- `version`
- `determinism` (deterministic|seeded|nondeterministic)
- `formats_in` (array)
- `formats_out` (array)
- `capabilities` (array)
- `default_params_json`

#### `studio_jobs`
- `id`
- `project_id`
- `job_type` (transform|render|publish)
- `status` (queued|running|succeeded|failed|canceled)
- `progress` (0..1)
- `input_asset_ids` (array)
- `output_asset_ids` (array)
- `transform_id` (nullable)
- `render_backend_id` (nullable)
- `connector_id` (nullable)
- `params_json`
- `logs_uri` (nullable)
- `created_at`
- `updated_at`

#### `studio_templates`
- `id`
- `name`
- `category`
- `preview_asset_id`
- `template_json` (graph/canvas/timeline descriptors)
- `plugin_id` (nullable)
- `version`

#### `studio_render_receipts`
- `id`
- `project_id`
- `job_id`
- `receipt_json`
- `created_at`

---

## 6. Pipeline Graph Model

### 6.1 Representation
Store project graph as JSON:
- nodes: assets, transforms, exports
- edges: dependencies
- parameters: transform params, export settings

Minimal schema:
```json
{
  "schema_version": "0.1",
  "nodes": [
    {"id":"a1","kind":"asset","asset_id":"..."},
    {"id":"t1","kind":"transform","transform_id":"...","params":{}},
    {"id":"e1","kind":"export","target":"pdf","params":{}}
  ],
  "edges": [
    {"from":"a1","to":"t1"},
    {"from":"t1","to":"e1"}
  ]
}
```

### 6.2 Guarantees
- Graph is **declarative**; execution is via Studio jobs only.
- Graph compilation never triggers agent actions.

---

## 7. Plugin & Extension System

### 7.1 Plugin Types
- **Transform Plugin**: adds one or more transforms
- **Panel Plugin**: embeds a UI panel (webview/iframe)
- **Template Pack**: ships templates + style packs
- **Render Backend**: adds render target/engine
- **Publishing Connector**: adds export/publish destination
- **Inspector Overlay**: adds analysis layer (captions QC, audio levels, citation overlay)

### 7.2 Plugin Manifest (Allternit-PM v0.1)
`allternit.plugin.json`:
```json
{
  "name": "com.vendor.captioner",
  "version": "1.2.0",
  "type": ["transform","panel"],
  "author": "Vendor",
  "description": "Caption generator + editor panel",
  "capabilities": ["captioning","subtitle_export"],
  "formats_in": ["audio","video"],
  "formats_out": ["srt","vtt"],
  "ui": {
    "panels": [
      {
        "id": "captioner.panel",
        "title": "Captions",
        "entry": "https://plugin.local/panel.html",
        "permissions": ["read_assets","write_assets"]
      }
    ]
  },
  "transforms": [
    {
      "id": "captioner.generate",
      "determinism": "seeded",
      "params_schema": {}
    }
  ]
}
```

### 7.3 Capability Graph
Marketplace indexes:
- `capabilities[]`
- `formats_in/out`
- `requires[]` (other plugins, render engines)
- `conflicts[]`

Used for:
- discovery,
- pipeline suggestions,
- compatibility warnings.

---

## 8. Security Model (Studio-Scoped)

### 8.1 Sandboxing
- Plugins run in isolated environments (process/container/wasm depending on deployment).
- UI panels run in sandboxed webviews/iframes with a strict message bridge.

### 8.2 Permissions (Least Privilege)
Example permissions:
- `read_assets`
- `write_assets` (produces derived assets only)
- `read_metadata`
- `write_metadata`
- `network_outbound` (connectors only; gated)
- `publish_external` (connectors only; gated)
- `gpu_render` (render backends only; gated)

### 8.3 Connector Gating
Publishing connectors require explicit user approval per:
- workspace
- destination
- scope (project vs global)

### 8.4 Content Integrity
- Asset blobs are content-addressed with hashes.
- Derived assets must record provenance edges.

---

## 9. Render Receipts (Traceability)

### 9.1 Receipt Contents
A render/export produces a receipt:
```json
{
  "receipt_version": "0.1",
  "project_id": "...",
  "job_id": "...",
  "created_at": "...",
  "inputs": [
    {"asset_id":"...","hash":"sha256:..."}
  ],
  "pipeline_graph_hash": "sha256:...",
  "plugins": [
    {"name":"com.vendor.captioner","version":"1.2.0"}
  ],
  "render_backend": {"id":"ffmpeg","version":"6.x"},
  "params": {},
  "seeds": {"captioner.generate": 12345},
  "outputs": [
    {"asset_id":"...","hash":"sha256:...","format":"mp4"}
  ]
}
```

### 9.2 Purpose
- auditability,
- reproducibility,
- debugging,
- enterprise compliance.

Not used for agent replay.

---

## 10. Public APIs (v1)

### 10.1 Projects
- `POST /api/v1/studio/projects`
- `GET /api/v1/studio/projects`
- `GET /api/v1/studio/projects/{id}`
- `PUT /api/v1/studio/projects/{id}`
- `DELETE /api/v1/studio/projects/{id}` (soft delete)

### 10.2 Assets
- `POST /api/v1/studio/assets/upload`
- `GET /api/v1/studio/assets?project_id=...`
- `GET /api/v1/studio/assets/{id}/download`
- `POST /api/v1/studio/assets/{id}/derive` (server-side derive metadata)

### 10.3 Jobs
- `POST /api/v1/studio/jobs/transform`
- `POST /api/v1/studio/jobs/render`
- `POST /api/v1/studio/jobs/publish`
- `GET /api/v1/studio/jobs/{id}`
- `GET /api/v1/studio/jobs/{id}/logs`

### 10.4 Templates
- `GET /api/v1/studio/templates`
- `POST /api/v1/studio/templates` (create custom)
- `POST /api/v1/studio/projects/{id}/apply_template/{template_id}`

### 10.5 Marketplace Integration
- `GET /api/v1/marketplace/items?type=transform|panel|template|connector|render_backend`
- `POST /api/v1/marketplace/install`
- `GET /api/v1/marketplace/installed`

---

## 11. UI Surfaces

### 11.1 Views
- Marketplace
- Output Studio (Projects)
- Output Studio (Editor)

### 11.2 Editor Layout
- Left: Asset library + plugin panels
- Center: Canvas + Preview
- Bottom: Timeline
- Right: Properties inspector + job status

### 11.3 Embedded Panels
- Panel host provides:
  - `postMessage` bridge
  - capability-scoped API
  - no direct DOM access outside iframe

---

## 12. Marketplace: Product Scope (Output-Focused)

### 12.1 Categories (v1)
- Output Processing
- Multimodal Transformers
- Visualization Engines
- Template Packs
- Render Backends
- Publishing Connectors
- Compliance/Audit Exporters
- Inspector Overlays

### 12.2 Discovery Features (v1)
- search
- tags
- compatibility filters (formats/capabilities)
- “works with” recommendations (capability graph)

### 12.3 Management (v1)
- install/update/disable/uninstall
- version pinning (optional v1.1)
- conflict detection (v1.1)

---

## 13. Monetization (Optional v1.1+)

- Paid template packs
- Render credits (GPU minutes)
- Connector subscriptions
- Export bundles (PDF/LMS)
- Team licensing

Schema stubs:
- `marketplace_pricing`
- `usage_metering`
- `invoices`
- `creator_payouts`

---

## 14. Observability

### 14.1 Metrics
- job success rate
- render time by backend
- asset sizes + storage
- plugin usage frequency
- export targets frequency
- failure reasons

### 14.2 Logs/Traces
- per-job logs stored + linked
- plugin crash reports with redaction
- receipt hash references

---

## 15. Acceptance Tests (Definition of Done)

### 15.1 Studio
- Import assets (text/image/audio/video) → view in library
- Apply template → canvas/timeline updated
- Run transform job → derived asset created + provenance edge
- Render mp4/pdf → output asset + receipt generated
- Publish to a mocked connector → success + audit event

### 15.2 Marketplace
- Install plugin → transforms/panels appear in studio
- Disable plugin → transforms removed from UI, existing assets remain
- Compatibility filter → only plugins matching selected formats/capabilities show

### 15.3 Security
- Panel cannot access ungranted APIs
- Connector requires explicit approval
- Plugin cannot mutate original assets (only derive new)

---

## 16. Roadmap

### v0.1 (MVP)
- Projects, assets, basic canvas/timeline
- Transform jobs + render jobs
- Receipts
- Marketplace install + capability indexing
- 2-3 core plugins (captioning, pdf export, simple slide generator)

### v0.2
- Better template system
- More connectors
- Conflict detection
- Graph view UI

### v0.3
- Monetization primitives
- Enterprise policy controls for connectors
- Advanced observability

---

## Appendix A: File/Folder Targets (Suggested)

- `services/allternit-operator/src/output_studio/*`
- `services/allternit-operator/src/marketplace/*`
- `5-ui/allternit-platform/src/views/OutputStudio/*`
- `5-ui/allternit-platform/src/components/studio/*`
- `5-ui/allternit-platform/src/components/marketplace/*`
