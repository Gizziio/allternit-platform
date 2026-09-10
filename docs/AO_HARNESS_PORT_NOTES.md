# AO Harness Port Notes — P4 (ao v3 runtime build)

Date: 2026-09-10
Branch: `ao/harness-port` (session worktree `allternit-ao-harness-port`)
Spec: `Allternit Brain/Research/specs/ao-harness-port.md` (binding)
Port map: `Allternit Brain/Research/drafts/prep-p4-harness-port.md` (wins on disagreement)
JS sources (READ-ONLY, intentionally NOT deleted — see Retirement below):
`Allternit Brain/Ops/harness-sync.js`, `Allternit Brain/Ops/harness-sync/lib.js`,
`Allternit Brain/Ops/harness-sync/drivers/*.js`, `Allternit Brain/Ops/harness.json`

## What was implemented

`ao harness status|sync|uninstall|describe` — a byte-parity Rust port of the
Allternit ops harness-sync JS implementation, covering all **16 tools** of the
live manifest (`harness.json`): agy, antigravity, claude, codebuddy, codex,
cursor, dsh, gizzi, grok, hermes, kimi, openclaw, opencode, qoder, qwen,
workbuddy. (The older plan doc said six; the live manifest's 16 is the contract
per the P4 brief, and parity was proven across all 16.)

Per the port map, the module lives in the `ao` crate (crate name `herdr`,
binary `ao`) under `src/ao/harness/`; the spec's `ao-core` name does not exist.
Engine crate internals untouched — the only engine-tree files changed are the
new `src/ao/harness/` module, the one-line `pub(crate) mod harness;` in
`src/ao/mod.rs`, and the dispatch arm in `src/cli.rs`.

### File map

| File | Role |
|------|------|
| `infrastructure/executor/ao-engine/src/ao/harness/mod.rs` (778 lines) | Manifest serde (camelCase rename, all-optional fields), 16-entry driver table, fs helpers, CLI arg dispatch, padded status table, `describe()` |
| `.../harness/harness.json` | Verbatim embedded copy of `Ops/harness.json` (`cmp`-verified byte-identical); overridable via `AO_HARNESS_MANIFEST` for fixture-based parity testing |
| `.../harness/json_val.rs` (550) | Order-preserving strict JSON parse + JS-exact pretty (`JSON.stringify(x,null,2)`) and compact printers. Hand-rolled instead of enabling `serde_json/preserve_order` globally, which would alter engine-internal JSON rewrites (forbidden by port map) |
| `.../harness/collate.rs` (139) | `localeCompare` replica used for the synced-state hash |
| `.../harness/skills.rs` (479) | `.agents/skills` writer (frontmatter, `skillsFormat` flat+nest, cursor frontmatter variant, commented `.jsonc`, symlinked sources) |
| `.../harness/rules.rs` (249) | Rules-file append/remove with JS-exact newline behavior |
| `.../harness/mcp_json.rs` (292) | JSON-config-body tool writer |
| `.../harness/mcp_toml.rs` (246) | TOML-config-body tool writer (compact args, pretty-otherwise) |
| `.../harness/mcp_cli.rs` (106) | CLI-wrapper tool installer |
| `infrastructure/executor/ao-engine/tests/ao_harness_parity/run.sh` (636) | Byte-parity harness: builds one fixture tree, clones it, runs the REAL JS against one clone and `ao harness` against the other under identical HOME/PATH/LC_ALL, diffs stdout/stderr/exit-code/full trees |
| `.../tests/ao_harness_parity/drivers.tsv` | key/label/installed() driver expectations for the 16 tools |
| `src/ao/mod.rs`, `src/cli.rs` | Wiring only (1 line each) |

Only key/label/installed() were ported from `harness-sync/drivers/*.js`, per
the brief — not the config bodies (those are data in `harness.json`).

## Test evidence (exact commands + results)

Unit tests (run from repo root):

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test -p herdr --bin ao harness::
test result: ok. 33 passed; 0 failed; 2936 filtered out
```

Full crate suite:

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test -p herdr
2456 tests passed, then the `ao` test binary died with:
  signal: 13, SIGPIPE: write on a pipe with no one to read
```

Classification of the SIGPIPE death: **pre-existing upstream flake, no
regression** — explicitly anticipated by the spec's Verify section ("excluding
the two documented pre-existing flake classes: SIGPIPE harness death"). Prior
sessions recorded the identical failure mode at 2164 passed (P1) and 2409
passed (P2); this run got to 2456 passed (including all 33 new harness tests)
before the abort. The point of death moves between runs (persist::restore,
server::client_transport) and is independent of piping — reproduced with output
redirected to a file. Out of P4 scope to fix; flagged, not papered over.

Parity harness (JS reference vs Rust port):

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" \
  bash infrastructure/executor/ao-engine/tests/ao_harness_parity/run.sh
== ao harness parity: 21 passed, 0 failed ==
```

(final clean run; log `/tmp/ao-harness-final-run.log`)

## Byte-parity evidence — 16/16 tools

The 21 checks cover every emitted artifact and every verb for all 16 tools:

1. cold `sync` — full tree diff of every file written (skills, rules, JSON/TOML/CLI config bodies) — byte-identical
2. warm `status` — stdout byte-identical (padded table, all 16 rows)
3. re-`sync` idempotence + `diff -r` tree identity
4. `sync --dry-run` — stdout byte-identical, zero writes
5. `uninstall` + tree identity (all 16 tools' artifacts removed)
6. `uninstall --dry-run` — byte-identical, zero writes
7. `--tools` filter (subset selection)
8. absent tools — skipped rows identical (status and sync)
9. pre-seeded drift/broken state recovery (status and sync)
10. cursor frontmatter, commented `.jsonc`, symlinked source skill
11. localeCompare-order hash collisions
12. flat `skillsFormat`
13. three error-exit checks (unknown command, bad args — stderr + exit 1 identical)
14. two conformance gates (status summary / synced-state semantics)
15. live smoke gate: `status` on the real `$HOME` — byte-identical, 16 tools
16. live smoke gate: `sync --dry-run` on the real `$HOME` — byte-identical, 16 tools

Diff methodology: both sides run against cloned scratch HOME trees under
identical `HOME`/`PATH`/`LC_ALL=en_US.UTF-8`; the parity script copies the real
`harness-sync.js` **unmodified** next to a fixture manifest whose only change
is scratch-absolute source paths (all tool cfg paths are `~`-relative and
resolve against scratch HOME). `syncedAt` timestamps are normalized out of tree
diffs; the scratch-tree path prefix on stdout is normalized identically on both
sides. Everything else is a raw byte diff.

## Documented deviations (no config in the manifest exercises them)

- **Number lexemes** are preserved verbatim in JSON output; JS normalizes them
  (`1.0` → `1`). No config body in the 16-tool manifest contains a number, so
  parity holds on the real manifest; noted for future manifest edits.
- **Non-ASCII tool names**: collation falls back to code-point order instead of
  full ICU `localeCompare`. All 16 tool keys are ASCII.
- **CLI-kind spawn failure**: exit code 1 identical; stderr is a Rust io error
  line rather than a JS stack trace (text differs, failure semantics identical).
- **`syncedAt`** is timestamp output; normalized out of tree diffs by design.

## Incidents

- Two port bugs were caught by unit tests before any parity run: TOML args were
  printed pretty instead of compact `JSON.stringify`; rules/TOML appends dropped
  the blank-line separator. Both fixed; expectations verified against the real
  JS with node probes (update leaves a trailing `\n`; remove leaves 4 internal
  newlines — both JS-faithful).
- Repeated full-suite SIGPIPE aborts (see classification above) cost several
  long rebuild cycles; final classification is evidence-backed from the ledger.

## Retirement note (spec hard gate #4)

With byte-parity proven, `Allternit Brain/Ops/harness-sync.js` is **retired in
favor of `ao harness`** as of this port. Per the brief and spec, retirement is
a docs/status change only: the JS files are **intentionally left in place** and
were not edited or deleted.

## Honest deferrals

- The pre-existing upstream SIGPIPE full-suite flake and `detect::` parallel
  flakes remain (spec-sanctioned exclusions; no new failures introduced).
- Engine crate internals: untouched by design (port map).
- No PR opened — orchestrator reviews and opens it (per brief).
