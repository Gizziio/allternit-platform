# P1-B: REAL TOOL IMPLEMENTATION
## Giving the System Actual IO Capabilities

**Target**: Replace mock tools with working Rust implementations.
**Goal**:
1. `note hello` -> Creates a real file in `workspace/`.
2. `search cats` -> Performs a real HTTP request (e.g. to DuckDuckGo html).

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #15: P1-K** | Tools Crate | `BACKLOG/Tool Registry.md` | Create `crates/tools` with `FsTool` and `HttpTool`. |
| **PR #16: P1-L** | Registration | `BACKLOG/Tool Registry.md` | Register tools in `services/kernel` and update Frameworks. |

---

## 📦 PR #15: P1-K — TOOLS CRATE

**Purpose**: Modular, safe implementations of core tools.

#### Task K1: Create Crate
**Location**: `crates/tools/`
**Details**:
- `cargo new --lib tools` inside `crates/`.
- Add deps: `reqwest`, `scraper` (for search), `tokio`, `serde`, `anyhow`.

#### Task K2: Implement FsTool
**Location**: `crates/tools/src/fs.rs`
**Details**:
- `FsTool::new(root_path: PathBuf)`
- `write(path, content)`: Enforce `root_path` sandbox.
- `read(path)`: Enforce sandbox.
- `list(path)`: Enforce sandbox.

#### Task K3: Implement SearchTool
**Location**: `crates/tools/src/search.rs`
**Details**:
- `SearchTool::search(query)`
- Use `reqwest` to hit `html.duckduckgo.com/html?q={query}`.
- Parse results with `scraper`.
- Return structured `Vec<SearchResult>`.

---

## 📦 PR #16: P1-L — REGISTRATION & WIRING

**Purpose**: Connect the new crate to the Kernel.

#### Task L1: Update Kernel
**Location**: `services/kernel/src/main.rs`, `services/kernel/src/tool_executor.rs`
**Details**:
- Import `allternit_tools`.
- Initialize `FsTool` (mapped to `./workspace`).
- Initialize `SearchTool`.
- Register in `ToolGateway`.

#### Task L2: Update Frameworks
**Location**: `services/framework/src/templates.rs`
**Details**:
- `fwk_search` -> requires `web.search`.
- `fwk_note` -> requires `fs.write`.

---

## 🎯 ACCEPTANCE: REAL IO DEMO

1. **User** types `note buy milk`.
2. **System** creates `workspace/note_<ts>.md`.
3. **User** checks file system (it exists!).
4. **User** types `search rust lang`.
5. **System** returns real search results from the web.

