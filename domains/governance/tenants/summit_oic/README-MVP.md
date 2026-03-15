# Summit OIC — Tenant Overlay Pack (MVP)

## Quick Start

1. Copy `secrets/.env.example` to `secrets/.env` and fill in your Canvas credentials:
   ```
   CANVAS_BASE_URL=https://yourdistrict.instructure.com
   CANVAS_API_TOKEN=your_token_here
   ```

2. Run the smoke test:
   ```bash
   # Plan-only (no Canvas token needed)
   cd tenants/summit_oic
   tsx tests/mvp_smoke_test.ts --plan-only

   # Full execution (requires Canvas token)
   source secrets/.env
   tsx tests/mvp_smoke_test.ts
   ```

## What's In The Pack

### Skills (4)
| Skill | Description |
|-------|-------------|
| `summit.canvas.module_builder` | Build Canvas modules with pages + assignments |
| `summit.canvas.course_ingestor` | Read and index existing Canvas courses |
| `summit.office.excel_editor` | Read/patch Excel gradebooks and rosters |
| `summit.desktop.cowork_portal_runner` | Automate legacy desktop portals via visual grounding |

### Tools (19)
- **Canvas** (9): list_courses, search_course, list_modules, create_module, create_page, add_module_item, create_assignment, publish_module, upload_file
- **Office** (4): xlsx_read, xlsx_write, docx_read, docx_write
- **Desktop** (6): cowork_connect, screenshot, click, type, wait, hotkey

### Architecture
```
tenant.json          ← Canvas URL + auth config
policies/policy.json ← Tool ACL (default deny, conditional allow on confirmed plans)
pack.lock.json       ← Model pins + registry hashes (enforcement: strict)
forms/               ← JSON Schema input forms per skill
skills/              ← Skill definitions (.skill.md)
tools/               ← Tool schemas + implementations
memory/              ← Teacher profiles, receipt schemas, sample receipts
tests/               ← Golden fixtures + MVP smoke test
```

### MVP Capabilities Proven
1. Teacher triggers `module_builder` → deterministic plan
2. Plan is byte-for-byte reproducible across runs
3. Confirmed plan executes Canvas API calls in correct sequence with receipts
4. Office agent reads + writes Excel with hash-verified patches
5. Desktop agent connects and requires confirmation before actions

### Policy Enforcement
- Default mode: **deny**
- Read tools (list_courses, xlsx_read, docx_read): always allowed
- Write tools: require `plan.confirmed == true`
- Desktop actions: require confirmed steps + active session + authorized user
- Max 50 desktop steps per run, 15-minute session timeout

### Model Lock
- Planner: `claude-3-7-sonnet-20250219` @ temp 0.0
- Summarizer: `gemini-2.0-flash` @ temp 0.2
