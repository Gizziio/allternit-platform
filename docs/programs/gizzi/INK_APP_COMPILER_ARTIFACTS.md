# gizzi-code ink-app: React Compiler artifacts, detection, and the de-compile plan

> **STATUS:** Gate doc — decision ratified, tooling conventions landed, zero `.tsx` conversions.
>
> **LAST UPDATED:** 2026-09-18

## 1. Decision

**ADOPT-AS-SOURCE** (owner-approved 2026-09-18). The ~360 `.tsx` files under
`cmd/gizzi-code/src/cli/ui/ink-app/` are React Compiler build output committed as
canonical source. There is no pre-compiler source to recover (see §3), so the only
path to ordinary, hand-editable TSX is to **de-compile the artifacts in place**,
incrementally, in 8–12 per-subtree PRs — followed by one final PR that deletes the
stub machinery (§6). This document is the reference for that codemod: what the
artifacts are, how to detect them, why the runtime stub exists, the transformation
rules, and how the work interacts with the ts-nocheck burn-down.

## 2. What the artifacts are

These are files produced by piping handwritten TSX through React Compiler (memoization
pass) plus a build step, then committing the result as if it were source. They are
machine-generated text with a stable fingerprint:

- **Primary:** `import { c as _c } from "react/compiler-runtime"` — the
  compiler-injected memo-cache hook import.
- **Secondary:** `$[n]` cache-slot accesses (e.g. `$[0]`, `$[12]`), where slot `n`
  holds memoized values for hook/cache entry `n`.

**Scale (verified 2026-09-18, main @ 0f324019e):** exactly **360** `.tsx` files under
`cmd/gizzi-code/src/cli/ui/ink-app/` carry the fingerprint; zero `.ts` files. Of the
360, **348** live outside the vendored subtrees; **12** live under `ink/` (the
vendored ink-rendering core — for the burn-down they are double-excluded, matching
both `VENDORED_SUBTREES` and the artifact fingerprints); **0** under `vim/`. All 360
are in scope for the codemod regardless of burn-down exclusion status.

**Detection:**

```bash
# The 360-file artifact set:
grep -rl "react/compiler-runtime" cmd/gizzi-code/src/cli/ui/ink-app --include='*.tsx'

# Is THIS file an artifact?
grep -l "react/compiler-runtime" path/to/File.tsx
```

The burn-down queue builder uses the same three fingerprints
(`COMPILER_ARTIFACT_FINGERPRINTS` in
`cmd/gizzi-code/script/typecheck-burndown/build-queue.mjs:60-64`): the runtime import,
`c as _c`, and `$[0]`.

## 3. Provenance verdict: no source recovery possible

The artifacts are canonical from the repository's **root commit** — this is proven,
not inferred:

```bash
git show 2bda61382:cmd/gizzi-code/src/cli/ui/ink-app/components/Spinner.tsx
# → line 2: import { c as _c } from "react/compiler-runtime";
```

There is no earlier state in this repo's history to restore. The original handwritten
source lived in an Anthropic-internal upstream that was never published and is not
recoverable. Any plan that starts from "get the original source" is dead on arrival;
the codemod starts from the committed text.

## 4. Runtime-stub machinery inventory (what the final PR deletes)

The compiled code is **incompatible with React 19.2's real `react/compiler-runtime`**
(§5), so the repo keeps it bundlable/typecheckable via a hand-written stub wired in
five places:

| # | Location | Role |
|---|----------|------|
| 1 | `cmd/gizzi-code/src/vendor/react-compiler-runtime.ts` | The vendored stub module implementing `c`/`useMemoCache` with the old sentinel contract (34 lines, `// @ts-nocheck`). |
| 2 | `cmd/gizzi-code/tsconfig.json:139-141` | `paths` mapping `"react/compiler-runtime"` → `./src/vendor/react-compiler-runtime.ts` (tsc / editor resolution). |
| 3 | `cmd/gizzi-code/tsconfig.base.json:45-47` | Same `paths` mapping for configs extending the base. |
| 4 | `cmd/gizzi-code/src/cli/ui/ink-app/tsconfig.json:63-65` | Same `paths` mapping for the ink-app subtree config. |
| 5 | `cmd/gizzi-code/script/build-production.js:105-127` | Inline copy of the identical stub (`REACT_COMPILER_RUNTIME_NS` / `REACT_COMPILER_RUNTIME_STUB`, lines 109-127) — Bun.build does not apply tsconfig `paths`, so the production bundle redirects the import in-plugin. |
| 6 | `cmd/gizzi-code/script/build-production.js:342-350` | The `build.onResolve`/`build.onLoad` redirect hooking `react/compiler-runtime` to the inline stub. |
| 7 | `cmd/gizzi-code/src/types/react.d.ts:12` | `declare module 'react/compiler-runtime'` — repo-local type augmentation (loose, matching the stub) since `@types/react` does not declare the subpath. |

The final codemod PR removes all seven once no importer of `react/compiler-runtime`
remains (verify with the §2 grep returning zero before deleting).

## 5. Incompatibility warning: never let the real runtime load

The compiled artifacts were produced by a React Compiler version whose cache-miss
guard is `Symbol.for("react.memo_cache_sentinel")`. **React 19.2's built-in
`react/compiler-runtime` fills the memo cache with
`Symbol.for("react.compiler_cache_miss")` instead.** Every first-render guard in the
compiled output (`$[n] === Symbol.for("react.memo_cache_sentinel")`) then silently
misses against the real runtime and **yields the sentinel itself as a value** — the
observed failure was `useMailbox()` returning a Symbol. There is no error, no crash,
just wrong data flowing through the UI.

Consequences:

- Removing any of the stub mappings (§4) before the codemod is complete will let the
  real runtime resolve and will break the TUI in non-obvious ways.
- Do not "upgrade" the stub to the new sentinel, do not add the real
  `react/compiler-runtime` as a dependency, and do not let an editor/bundler resolve
  the bare specifier.
- After the codemod, the artifacts no longer reference the runtime at all, so the
  incompatibility becomes moot — that is the point of deleting the stub machinery last.

## 6. The adopted-as-source plan

### 6.1 Per-subtree codemod PRs (8–12 PRs, ~one subtree each)

Each PR converts one coherent subtree of `ink-app/` (e.g. `components/`,
`screens/…`, `hooks/`, …) and nothing else. Transformation rules, applied to the
**current committed text** (not a compiler re-run):

1. **Inline `$[k]` cache slots as plain `const`s at first use**, preserving the exact
   evaluation order of the compiled body. The memo-cache reads become ordinary
   expressions; the cache-write slots (`$[k] = …`) become ordinary assignments to
   those consts' computation, i.e. plain code with no cache at all.
2. **Drop `_c`** — remove the `import { c as _c } from "react/compiler-runtime"` line
   and every `_c(N)` call, replacing each with nothing (the cache array it created is
   gone after rule 1).
3. **Rename `t0`-style generated params back to Props destructuring** where a `Props`
   type exists in the file (the compiler flattened `function C({ a, b }: Props)` into
   `function C(t0) { const { a, b } = t0; … }`).
4. **Keep hoisted `_tempN` helpers** as-is (module-scope temporaries the compiler
   lifted out of JSX); they are ordinary functions once `$[k]` is inlined.
5. **Headers:** strip the `// @ts-nocheck` header where the converted file typechecks
   clean; where it does not, keep `@ts-nocheck` and add `TODO(types)` markers per the
   burn-down conventions (the file then enters the ordinary burn queue — §7).
6. Preserve hand patches inside the compiled idiom — see the FuzzyPicker note in §8.
   The codemod operates on current text, so any manual edits already in the file are
   carried through as long as rules 1–2 are applied to the text that is actually there.

Each PR must pass: `bun run typecheck` in `cmd/gizzi-code`, the ts-nocheck guard
(`bash script/check-ts-nocheck.sh`), a TUI smoke (launch `gizzi`, exercise the
affected screen), and the burn-down bookkeeping of §7.

### 6.2 Final PR: delete the stub machinery

Only after the §2 grep returns **zero** files:

- Delete `cmd/gizzi-code/src/vendor/react-compiler-runtime.ts`.
- Remove the three tsconfig `paths` entries (§4 #2–4).
- Remove the inline stub + redirect from `cmd/gizzi-code/script/build-production.js`
  (§4 #5–6).
- Remove the `declare module 'react/compiler-runtime'` augmentation from
  `cmd/gizzi-code/src/types/react.d.ts`.
- Regenerate the burn-down queue and baseline per §7.

## 7. Interaction with the ts-nocheck burn-down

The artifact files are **queue-excluded**: `build-queue.mjs` skips any nocheck file
matching a compiler fingerprint (`isCompilerArtifact`, build-queue.mjs:197-201), so
the 360 artifacts appear in `script/ts-nocheck-baseline.txt`'s nocheck count but not
in `queue.json`'s burnable queue. Conversion changes that status, so **every
conversion PR must update the burn-down bookkeeping in the same PR**:

- Converted files that **drop `@ts-nocheck`** lower the live nocheck count →
  regenerate the baseline (`bash script/check-ts-nocheck.sh --update` from
  `cmd/gizzi-code`) in the same commit, per the ratchet rule (count may never exceed
  the baseline; lowering is expected).
- Converted files that **keep `@ts-nocheck`** no longer fingerprint-match → they flow
  into the burn queue as ordinary entries → regenerate
  `script/typecheck-burndown/queue.json` (`node script/typecheck-burndown/build-queue.mjs`)
  in the same commit, and treat them as ordinary queue items going forward (burn,
  allowlist via `test/ts-nocheck-allowlist.txt`, or fix).
- The artifact-exclusion constants themselves
  (`COMPILER_ARTIFACT_FINGERPRINTS`) only become dead once **no file anywhere**
  matches — leave them in place until the final PR, then delete with the stub
  machinery (§6.2) rather than silently editing queue semantics mid-codemod.

## 8. Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **Hook-order shifts around early returns.** The compiled code restructures conditionals so cache slots are read before branch points; naive inlining can move a hook call across a return and change hook order between renders (React invariant). | High if inlined naively | The inline-const strategy (rule 1: declare at first use, preserve evaluation order) keeps each hook call exactly where the compiled body evaluates it; `bun run typecheck` plus a TUI smoke of the affected screen gates every PR. |
| **Hand patches inside compiled idiom get clobbered** (precedent: FuzzyPicker-style edits made inside the compiled structure after it was committed). | Medium | The codemod operates on the **current text**, not a regeneration; any hand edits present in the file are transformed by the same rules and preserved. Review each converted file diff for semantic (not just mechanical) changes. |
| **A conversion PR silently changes burn-down semantics** (artifact exits the exclusion without queue/baseline update). | Medium | Guard test `test/ts-nocheck-guard.test.ts` + `check-ts-nocheck.sh` fail when the bookkeeping identity (live nocheck + recorded burns = baseline) breaks; §7 makes the regeneration part of the same PR. |
| **Sentinel leak: real `react/compiler-runtime` resolves** (stub mapping removed early, dependency added, bundler config drift). | Low, catastrophic | §5: never touch §4 machinery before the final PR; the final PR's precondition is the §2 grep returning zero. |
| **Codemod PRs collide with concurrent burn-down batches** touching the same ink-app files. | Medium | Convert one subtree per PR and rebase onto latest `origin/main` immediately before merge; burn batches skip fingerprint-matched files so overlap is limited to already-converted (ordinary) files, which follow normal merge discipline. |

## 9. Tooling conventions (landed with this doc)

- **ESLint:** the artifact set is ignored in root `eslint.config.js` (computed at
  config load by scanning the ink-app subtree for the §2 fingerprint — the same
  detection the burn-down uses). Before this change, root eslint linted the
  machine-generated files and reported problems on them (e.g. 2 errors + 5 warnings
  on `components/Spinner.tsx`); linting compiler output is noise, and the files are
  already `@ts-nocheck`. This ignore affects eslint only — not the tsc burn-down.
- **Pointer comment:** `cmd/gizzi-code/src/vendor/react-compiler-runtime.ts` carries a
  one-line reference to this document at the top of the stub.
