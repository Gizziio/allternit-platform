# A2rchitech Session Summary — Skill Discovery (2026-01-26)

## What makes “one command install” work (first-principles)
Vercel’s approach collapses 4 hard problems into a single UX:

1) **Single distribution surface + deterministic command**  
- `npx skills add <package>` gives “works anywhere Node exists” ergonomics, no preinstall friction. citeturn0search0turn0search1

2) **Strict skill packaging contract (installer stays dumb + reliable)**  
- A skill is a predictable artifact (e.g., `SKILL.md` + metadata). Once the contract is stable, install becomes a mechanical transform: fetch → place → register. citeturn0search0turn0search1

3) **Agent-target autodetection (no user config)**  
- The installer detects common agent config paths and picks install destinations automatically (or prompts). Community notes confirm `add-skill` auto-detects many agent locations. citeturn0search9turn0search16

4) **Centralized discovery + leaderboard + usage stats**  
- `skills.sh` is a directory/leaderboard that enables search/ranking and tracks installs/usage stats across the ecosystem. citeturn0search0turn0search1

### Telemetry (why it works)
- Telemetry is enabled by default for leaderboard ranking; opt-out is explicit via environment variable (no personal/device info claimed in docs). citeturn0search1


## Cloudflare’s decentralized discovery (.well-known RFC)
Cloudflare proposes a decentralized discovery mechanism using `/.well-known/…` as a predictable origin-controlled location for skills discovery (referencing RFC 8615). citeturn0search2

**Structural difference**
- **Vercel (centralized):** best global search/ranking/telemetry; value capture via the index network effects. citeturn0search0turn0search1  
- **Cloudflare (decentralized):** publisher-controlled discovery; no single registry gate; harder global ranking unless crawled/aggregated. citeturn0search2


## Cold recommendation: middleware adapter first, then selectively copy primitives
**Best strategy:** implement a *multi-source resolver + installer middleware* first, and only “copy” the parts that are engineering primitives (not the network effects).

### What “middleware” means in A2rchitech
Build a **Skill Resolver** that can install from:
1) **Central registry IDs** (skills.sh-style)
2) **Decentralized `.well-known`** origin discovery
3) **Git URLs / local folders**

This preserves modularity while gaining immediate breadth by being compatible with existing ecosystems.

### What to copy (good engineering primitives)
- **Agent autodetection + per-agent adapters** (no-config install pathing). citeturn0search9turn0search16
- **Minimal, strict skill spec** (frontmatter + required fields + versioning).
- **Telemetry with opt-out** to improve reliability + discovery ranking. citeturn0search1

### What not to copy early
- A full centralized global directory with leaderboards/ranking as your first move (that’s a compounding product with distribution/network effects).

### Dual discovery model (A2rchitech-aligned)
- **Default:** decentralized `.well-known` ingestion citeturn0search2  
- **Optional:** curated index (your own), possibly ingesting external public references as sources


---

# Implementation Artifacts (drop-in spec)

## A) Skill Package Contract
### Required files
```
<skill-root>/
  SKILL.md
  skill.json            (optional but recommended)
  files/…               (optional supporting files)
```

### SKILL.md (required) — example frontmatter
```md
---
id: pdf-processor
name: PDF Processor
version: 1.0.0
description: Extract text/tables from PDFs and produce structured JSON.
license: MIT
tags: [pdf, etl, parsing]
compatibility:
  agents: [claude-code, codex-cli, cursor]
install:
  layout: "md-only"
telemetry:
  allow: true
  events: [install, uninstall, run]
---
# PDF Processor Skill
…instructions…
```

### skill.json (optional) — example
```json
{
  "schema_version": "1.0.0",
  "id": "pdf-processor",
  "name": "PDF Processor",
  "version": "1.0.0",
  "description": "Extract text/tables from PDFs and produce structured JSON.",
  "license": "MIT",
  "tags": ["pdf", "etl", "parsing"],
  "entrypoints": [{ "kind": "prompt", "path": "SKILL.md" }]
}
```


## B) `.well-known` Discovery
### Endpoint
`https://<origin>/.well-known/skills/index.json` (exact path/shape per RFC proposal scope). citeturn0search2

### Index example
```json
{
  "schema_version": "1.0.0",
  "publisher": { "name": "Example Org", "url": "https://example.com" },
  "generated_at": "2026-01-25T00:00:00Z",
  "skills": [
    {
      "id": "pdf-processor",
      "name": "PDF Processor",
      "version": "1.0.0",
      "description": "Extract text/tables from PDFs and produce structured JSON.",
      "tags": ["pdf", "etl", "parsing"],
      "license": "MIT",
      "distribution": {
        "kind": "http",
        "base_url": "https://example.com/.well-known/skills/packages/pdf-processor/1.0.0/",
        "files": [
          { "path": "SKILL.md", "sha256": "…", "size": 12345, "media_type": "text/markdown" },
          { "path": "skill.json", "sha256": "…", "size": 456, "media_type": "application/json" }
        ]
      }
    }
  ]
}
```


## C) Reference CLI Spec (A2rchitech-style)
Assume executable name: `a2skills`.

### Discovery
```sh
a2skills search "<query>" [--source central|wellknown|git] [--limit 20] [--json]
a2skills info <skill-ref> [--source ...] [--json]
a2skills sources
```

### Install / Uninstall
```sh
a2skills add <skill-ref> [--agent <id>|--all] [--source central|wellknown|git] [--yes]
a2skills remove <skill-id> [--agent <id>|--all] [--yes]
a2skills list [--agent <id>] [--json]
```

### Well-known ingestion
```sh
a2skills add --wellknown https://example.com pdf-processor --agent claude-code
a2skills crawl --wellknown https://example.com [--cache-dir ...] [--refresh]
```

### Git + local
```sh
a2skills add https://github.com/org/pdf-processor-skill --agent codex-cli
a2skills add ./skills/pdf-processor --agent cursor
```

### Skill reference grammar
- `central:<namespace>/<skill>`
- `wellknown:<origin>/<skill-id>`
- `git:<url>`
- raw URL/path implies `git|local` based on scheme


## D) Installer invariants (MUST)
1. Skill MUST contain `SKILL.md`.
2. Frontmatter MUST include: `id`, `name`, `version`, `description`.
3. If `skill.json` exists, `id/version` MUST match SKILL.md.
4. Hashes in `.well-known` index MUST match downloaded content (`sha256`).
5. Installer MUST refuse path traversal in declared files (`..`, absolute paths).


## E) Agent Adapter Interface (implementation contract)
```ts
type AgentAdapter = {
  id: string;                       // "claude-code" | "codex-cli" | ...
  detect(): Promise<boolean>;       // detect agent installed/configured
  getSkillDir(): Promise<string>;   // destination folder
  install(skill: ResolvedSkill): Promise<void>;
  uninstall(skillId: string): Promise<void>;
  list(): Promise<InstalledSkill[]>;
};
```


## F) Telemetry (opt-out)
- `DISABLE_TELEMETRY=1` should disable all telemetry, matching the ecosystem norm. citeturn0search1

Minimal event payload example:
```json
{
  "schema_version": "1.0.0",
  "event": "install",
  "ts": "2026-01-26T00:00:00Z",
  "skill_id": "pdf-processor",
  "skill_version": "1.0.0",
  "source": "wellknown",
  "origin": "example.com",
  "agent": "claude-code",
  "result": "success",
  "duration_ms": 842
}
```


---

# Primary references (projects / docs)
- Vercel: “Introducing skills, the open agent skills ecosystem” citeturn0search0  
- skills.sh CLI docs (telemetry + opt-out) citeturn0search1  
- Cloudflare: `agent-skills-discovery-rfc` (well-known discovery) citeturn0search2  
- Vercel Labs: `add-skill` (install skills from git; supports many agents) citeturn0search9  
- npm: `skills` package citeturn0search3  

---

## Outcome
A2rchitech should implement **multi-source discovery + installation middleware** now (compat + modularity), and delay any attempt to “replace” centralized discovery until you have enough distribution and telemetry volume to make ranking meaningful.
