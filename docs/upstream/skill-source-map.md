# Skill source and growth contract

This is the behavioral contract for the canonical runtime skill catalog.

## Source precedence

| Priority | Source | Typical roots | Collision behavior |
| ---: | --- | --- | --- |
| 30 | project | `.gizzi/skills`, `.claude/skills`, `.agents/skills`, `.openclaw/skills` | Wins by normalized skill name |
| 20 | user | global Gizzi and compatible user roots | Wins over configured, remote, and built-in definitions |
| 10 | extra / remote | `skills.paths`, downloaded indexes | Wins over built-ins; first declared equal-priority root wins |
| 0 | built-in | `builtin://` | Safe fallback; always shadowable |

All candidates retain source, priority, root, and location. `GET /skill/catalog`
returns winners and shadowed definitions. Equal-priority resolution follows declared
root order, then lexical path order. Names compare case-insensitively.

Directory bundles use `SKILL.md`; flat top-level Markdown skills are accepted.
Discovery stops after eight nested levels. A nested bundle is only discoverable when
its nearest parent declares `has-sub-skill: true` (or `hasSubSkill: true`). Its name is
qualified as `parent.child`.

## Governed growth

Agent-authored skills do not become active merely because they were generated. The
lifecycle is `proposed -> evaluated -> approved -> active -> rolled_back`.

- Proposals are inert, versioned, content-addressed records.
- Evaluation records a 0–1 score and report.
- Approval requires a score of at least 0.70 and a permission decision.
- Activation snapshots the prior target before an atomic write.
- Rollback restores that snapshot only when the active file is unchanged, so later
  human edits are never overwritten.

Tools: `skill_propose`, `skill_evaluate`, `skill_decide`, `skill_activate`, and
`skill_rollback`.

## Claude Code / Codex import

`skill_import_preview` produces a durable exact-path plan. `skill_import_apply`
requires permission and re-hashes sources before copying. It never overwrites skill
targets, rejects symlinks, omits hidden/cache and `node_modules` payloads, backs up
instruction targets, and marks imported blocks. MCP declarations remain review-only
because importing one can spawn a command or disclose data to a remote service.

## Upstream basis

The explicit hierarchy, built-in shadowing, eight-level bound, opt-in sub-skills, and
conservative import flow were adapted from Moonshot AI `kimi-code` commit `3086e47`
(MIT). The implementation is independent TypeScript fitted to Allternit's runtime.
