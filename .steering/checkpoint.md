# Steering checkpoint

Goal: Hotfix gizzi-code 2.0.5 TUI crash (`TypeError: new ColorDiff(...).render is not a function`) triggered by any surface rendering `<StructuredDiff>` with highlighting enabled — confirmed on `/theme`; file-edit permission diffs share the same component.

Just did: Follow-up on the same branch — the vendored color-diff TS port now implements real rendering instead of falling back: new `syntax.ts` (regex tokenizer for ts/js/py/go/rust/java/c/shell/json/css/html/markdown/config/sql/ruby/php, language detection by extension + shebang, theme palettes mirroring theme.ts diff backgrounds, width-wrapping ANSI emitter). `ColorDiff.render()` emits guttered diff lines (marker + line numbers + tinted added/removed backgrounds + syntax-colored tokens, wrapped); `ColorFile.render()` fixes the same class of latent crash in HighlightedCode (file-write permission previews) and returns guttered highlighted file lines; `getSyntaxTheme()` maps TUI theme names (dark/light/daltonized/ansi) to built-in palettes. 17/17 tests, tsc clean, rebuilt binary verified via pty: /theme picker shows real syntax colors (dark-plus token palette) and stays alive.

Next: Owner review; merge to main and cut gizzi-code v2.0.6 (release flow + homebrew tap bump). Known gap: word-level intra-line highlights are not emitted by the TS render (the React fallback does word diffs); consider porting that later if users miss it.

Open questions: Ship the fallback-only highlight as 2.0.6 now, or bundle a real TS highlighter first? (Recommend: ship now — crash is P0; highlighting parity is cosmetic.)
