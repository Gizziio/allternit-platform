# gizzi-tui-parity P7 — settings hooks bridge + .gizzi user-scope dirs (FINAL PHASE)

- Session: session/gizzi-tui-parity (dag_625298 / n_2847 / wih_8397)
- PR: #752 — merged 952777dc6 (commit e2b0b209c)

## Content
1. `src/runtime/hooks/settings-bridge.ts` (new): settings.json `hooks` on the runtime
   dispatch path. Loads user (`<GIZZI_CONFIG_DIR ?? ~/.gizzi>/settings.json`) + project
   (`.gizzi` → `.claude` fallback, plus `settings.local.json`) hook configs; command-type
   PreToolUse/PostToolUse/PostToolUseFailure executed with the Claude Code stdin contract
   (`{session_id, cwd, hook_event_name, tool_name, tool_input, tool_response?/error?}`),
   `GIZZI_HOOK_EVENT`/`GIZZI_HOOK_SESSION_ID` env, per-hook timeout (default 60s, kill on
   expiry). Exit 2 → deny (stderr = reason); exit-0 JSON honors `decision:"block"` and
   `hookSpecificOutput.permissionDecision:"deny"`; other non-zero fails open with warning;
   any deny wins. Matcher port: empty/`*` all, `A|B` lists, regex fallback, simple names
   case-insensitive so Claude-style `Bash`/`Write|Edit` matchers hit lowercase runtime ids.
   Parsed config cached on (path, mtime, size); `disableAllHooks` honored;
   `GIZZI_SETTINGS_HOOKS=0` kills the bridge. `hooksConfigSnapshot.ts` was not importable
   from runtime (probe import hung — graph pulls bootstrap/plugin state), so the contained
   resolution logic is reimplemented mirroring the ink-app settings resolution.
2. `src/runtime/tools/dispatch.ts`: bridge wired into `executeInitialized` after the
   existing gizzi-config `HookDispatcher` PreToolUse emit and the hard-ban guard; bridge
   deny returns the structured `{denied: true}` precedent and fires PostToolUseFailure
   through both dispatchers. Post/Failure events fire alongside existing emits.
3. `markdownUserDirs.ts` (new leaf module) + both `markdownConfigLoader.ts` copies: user
   scope now merges `~/.gizzi/<subdir>` + `~/.claude/<subdir>` (gizzi first) for
   commands/agents/skills/output-styles, matching the in-repo directory-merge precedent.
   (Project scope already merged both since 70c13d08d — the audit's "zero .gizzi/commands"
   claim was stale; the real gap was user scope.)

## Deferred (documented in module header)
prompt/agent/http settings-hook types, managed/policy hooks, `if` conditions,
`async`/`once` flags, `updatedInput` arg rewriting, `permissionDecision:"ask"`;
`/skills` change-watch/display path for `.gizzi` project dirs (loading is correct).

## Verification
- bun test settings-hooks-bridge (22) + user-markdown-dirs (5) + shared loader + agentHardBans: 47/47
- bun run typecheck (cmd/gizzi-code): clean
- release-preflight.mjs: 52/0
- Headless smoke via real ToolDispatcher.execute + builtin glob/bash tools: allow path
  executes; "Bash" exit-2 hook gates bash with structured denial + stderr reason.
- Pre-existing failures reproduce on pristine tree (runtime cowork-store-boundary,
  ProcessRegistry, test/skill, /status env) — not ours.
