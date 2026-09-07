# 2026-09-06 — session/gc-hotfix — kimi — gizzi-code 2.0.6: /theme TUI crash fix + real TS syntax highlighting

## What was done

Fixed the gizzi-code 2.0.5 crash reported by the owner: choosing the
`/theme` slash command (and any surface rendering a syntax-highlighted
diff, e.g. file-edit permission previews) hard-crashed the TUI with

    TypeError: new ColorDiff2(patch, firstLine, filePath, fileContent).render is not a function

Root cause: the vendored pure-TS port of `color-diff-napi`
(`cmd/gizzi-code/src/vendor/color-diff-napi/index.ts`) implemented only
the color-math API (`diff`/`similar`/`closest`/`map`), while
`StructuredDiff`'s fast path and `HighlightedCode` call `render()` APIs
from the original Rust NAPI binding that the port never implemented.

## How it works

Phase 1 (crash fix, commit `457c3f3e3`):
- `ColorDiff` accepts the diff-render constructor `(patch, firstLine,
  filePath, fileContent)`; `render()` returns null so callers use the
  existing React fallback renderer.
- `renderColorDiff` in both `StructuredDiff.tsx` copies guards the call —
  missing/throwing `render()` degrades instead of crashing.
- Regression tests: `cmd/gizzi-code/test/vendor/color-diff-napi.test.ts`.

Phase 2 (real highlighting, commit `132848239`):
- New `syntax.ts`: sticky-regex tokenizer (ts/js/py/go/rust/java/c/ruby/
  php/shell/json/css/html/markdown/config/sql/text), extension + shebang
  language detection, theme palettes mirroring `theme.ts` diff
  backgrounds (incl. daltonized/ansi variants), width-wrapping ANSI span
  emitter.
- `ColorDiff.render()` emits guttered diff lines (marker + right-aligned
  line numbers padded to the consumer's gutterWidth, tinted added/removed
  backgrounds padded full-width, syntax-colored tokens, wrapped
  continuation rows).
- `ColorFile.render()` fixes the same latent crash class in
  `HighlightedCode` (file-write permission previews); constructor takes
  `(code, filePath)`, render returns guttered highlighted lines matching
  the component's `digits+2` gutter split.
- `getSyntaxTheme()` maps TUI theme names onto built-in palettes for the
  theme picker footer.

Release (commit `c2e0d543c`, tag `gizzi-code/v2.0.6`): version bump across
package.json ×2, install/gizzi.rb, deb control, rpm spec + CHANGELOG.

## Verification

- 17/17 unit tests; `tsc --noEmit` clean.
- pty driver reproduced the exact TypeError on installed v2.0.5 when
  opening `/theme`; the fixed darwin-arm64 build renders the picker and
  stays alive, with dark-plus token colors (`#569cd6`, `#ce9178`) present
  in the preview — proof the fast path renders, not the fallback.
- Also verified the onboarding "local CLI brain" path on this machine:
  the saved `kimi-cli` `subprocess_cmd` in `~/.config/gizzi-code/config.json`
  was missing `-p` (provider test failed with exit 1); fixed to
  `/Users/joe/.kimi-code/bin/kimi -p` — `gizzi provider test kimi-cli`
  passes and `gizzi exec --model kimi-cli/kimi-for-coding` round-trips.

## Shipped

- Merged `session/gc-hotfix` → `main` (fast-forward, `c2e0d543c`).
- Pushed tag `gizzi-code/v2.0.6`; publish CI
  (`Publish Gizzi Code to NPM`, run 34076386791) builds all platforms and
  publishes GitHub release assets + npm.
- Homebrew tap formula update with fresh sha256s: pending CI asset
  availability (tracked below).

## Unfinished / deferred

- Homebrew tap (`gizziio/homebrew-tap` Formula/gizzi-code.rb) still pins
  2.0.5 sha256s; update after the release assets land, then
  `brew upgrade gizzi-code`.
- Word-level intra-line highlights are not emitted by the TS renderer
  (the React fallback does word diffs); cosmetic, port later if missed.
- Owner follow-up: default brain `aliyun-qwen/qwen3.7-max` fails auth
  (stored key rejected) — re-key via `gizzi provider add aliyun-qwen` or
  switch default to `kimi-cli/kimi-for-coding`.
