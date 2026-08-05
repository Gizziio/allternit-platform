/**
 * Core logic for `gizzi brain` (Track D / phase D1).
 *
 * The brain is a local-first git repo of frontmatter markdown — the user's
 * second brain. This module is deliberately free of CLI/UI/settings imports
 * so it can be driven directly from bun tests. Sync is plain git: no bespoke
 * merge logic anywhere.
 */
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

export class BrainError extends Error {}

export const DEFAULT_BRAIN_PATH = join(homedir(), "brain")

export function expandBrainPath(p: string): string {
  if (p === "~") return homedir()
  if (p.startsWith("~/")) return join(homedir(), p.slice(2))
  return resolve(p)
}

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

async function git(dir: string, args: string[]): Promise<GitResult> {
  try {
    const proc = Bun.spawn(["git", "-C", dir, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (e) {
    throw new BrainError(
      `failed to run git — is git installed and on PATH? (${e instanceof Error ? e.message : String(e)})`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Templates (canonical layout v1 — see .steering/spec.md Track D)            */
/* -------------------------------------------------------------------------- */

export interface BrainTemplate {
  /** path relative to the brain root */
  path: string
  content: string
}

function identityTemplate(): string {
  return `---
type: identity
status: active
domain: meta
---

# Identity

> Who you are, for the agents that work on your behalf. Fill every section in
> your own words — short concrete sentences beat adjectives. Agents read this
> page first (see MEMORY.md).

## Name & context

- Name:
- Location / timezone:
- Primary role:

## Roles

<!-- The hats you wear (e.g. founder, staff engineer, parent). Agents use
     these to decide which domain a note or task belongs to. -->

-

## Current goals

<!-- 1-5 active goals. Keep this list small and current; when a goal
     concludes, record the outcome in decisions/ and remove it here. -->

1.

## How I work

<!-- Preferences agents should honor: communication style, tools you love or
     avoid, meetings vs async, depth vs speed, working hours. -->

-

## What agents should never assume

<!-- Correct the common wrong guesses about you here. -->

-
`
}

function domainTemplate(): string {
  return `---
type: domain
status: active
domain: example
---

# Domain: <name>

<!-- A domain is an ongoing area of work or life (e.g. "allternit",
     "health", "finances"). Copy this file to domains/<slug>.md, set the
     domain: field above to the same slug, and fill it in. Runbooks and
     ideas point back at this slug in their own domain: field. -->

## Why this domain matters

## Current state

## Key people / systems / links

## Open loops

<!-- Things in flight that an agent should know about before acting here. -->
`
}

function decisionTemplate(date: string): string {
  return `---
type: decision
status: active
domain: meta
date: ${date}
---

# Decision: <the choice that was made, as a sentence>

<!-- Filename convention: decisions/NNNN-short-slug.md (e.g.
     0001-use-sqlite.md). status: is active or superseded. When a decision
     is replaced, set status: superseded and link the replacement below —
     never delete a decision. -->

## Context

<!-- What forced the decision. Facts, constraints, deadlines. -->

## Decision

<!-- What was decided, unambiguously. -->

## Consequences

<!-- What this rules in, what it rules out, what it costs. -->

## Superseded by

<!-- optional: decisions/NNNN-....md -->
`
}

function runbookTemplate(): string {
  return `---
type: runbook
status: active
domain: example
---

# Runbook: <task>

<!-- A runbook is a repeatable procedure you (or an agent) can execute
     without rediscovering it. Write the steps so a tired future-you
     succeeds. -->

## When to use

## Preconditions

<!-- Access, tools, and state that must be true before step 1. -->

## Steps

1.

## If it goes wrong

<!-- Rollback or escalation. -->

## Last verified

<!-- Date you last ran this end to end. -->
`
}

function ideaTemplate(): string {
  return `---
type: idea
status: new
domain: meta
---

# <Idea or pain point>

<!-- Ideas and pains are intake for the taste engine: pages here are
     ingested as unverified candidates. type: pain = something that
     repeatedly costs you time or annoyance; type: idea = something you
     might build. status: moves new -> reviewing -> rejected | built
     (link where it shipped). -->

## The observation

<!-- What you saw, in one paragraph. -->

## Why it matters

## Sketch / next step
`
}

function brainYaml(now: Date): string {
  return `# Second-brain metadata (canonical layout v1 — Track D).
# schema_version lets future tooling migrate the layout safely.
schema_version: 1
owner: ""
created: "${now.toISOString()}"
# Platform remote (D2 hosted brain). Also recorded as git remote "origin".
remote: null
`
}

function memoryMd(): string {
  return `# MEMORY — the user's second brain

This repository is the user's **second brain**: a local-first git repo of
markdown pages with YAML frontmatter, created by \`gizzi brain init\`. It is
the system of record for who the user is, what they care about, and what
they have decided. Any hosted remote is only a mirror — losing it loses
nothing, because every clone has full history.

## For agents: how to read this brain

1. Read \`identity.md\` first — who the user is, their roles, goals, and
   working preferences. Let it shape tone, priorities, and defaults.
2. Scan \`domains/\` to learn the user's areas of work and life. When a task
   touches a domain, read that domain's page before acting.
3. Respect \`decisions/\` — pages with \`status: active\` are settled; do not
   re-litigate them. \`status: superseded\` pages explain history.
4. Use \`runbooks/\` for repeatable procedures; follow the steps as written
   and report where reality diverged from them.
5. Treat \`ideas/\` as intake, not commitments: \`status: new\` means
   unevaluated. Never present an idea as the user's settled intent.

## Frontmatter convention

Every corpus page starts with YAML frontmatter following the Track-C2
convention (\`type\`, \`status\`, \`domain\`), so the taste engine's wiki
connector can ingest this brain with zero adapter work:

| path          | \`type\`          | \`status\`                                  | extra fields            |
| ------------- | ----------------- | ------------------------------------------- | ----------------------- |
| \`identity.md\` | \`identity\`      | \`active\`                                    |                         |
| \`domains/\`    | \`domain\`        | \`active\` / \`archived\`                       | \`domain\` = page slug    |
| \`decisions/\`  | \`decision\`      | \`active\` / \`superseded\`                     | \`date\` (YYYY-MM-DD)   |
| \`runbooks/\`   | \`runbook\`       | \`active\` / \`archived\`                       | \`domain\`                |
| \`ideas/\`      | \`idea\` / \`pain\` | \`new\` / \`reviewing\` / \`rejected\` / \`built\` | \`domain\`                |

\`brain.yaml\` carries repo metadata (\`schema_version\`, \`owner\`,
\`created\`, \`remote\`). Files named \`_template.md\` are copy-me templates,
not content — never summarize them as facts about the user.

## For agents: how to write

- Only add or edit pages when the user asks (or an onboarding flow directs
  it). Never silently rewrite identity or decisions.
- New pages: copy the directory's \`_template.md\`, keep the frontmatter
  convention, use lowercase-slug filenames (e.g.
  \`decisions/0002-use-sqlite.md\`).
- Commit every change with a plain message, then \`gizzi brain sync\` pushes
  it when a remote is configured.

## Layout

| path          | what lives there                                |
| ------------- | ----------------------------------------------- |
| \`brain.yaml\`  | schema_version, owner, created, platform remote |
| \`identity.md\` | who the user is: roles, goals, working style    |
| \`domains/\`    | ongoing areas of work/life                      |
| \`decisions/\`  | dated decisions and what superseded them        |
| \`runbooks/\`   | repeatable procedures                           |
| \`ideas/\`      | ideas and pains — intake for the taste engine   |

Sync is plain git: \`gizzi brain sync\` runs pull --rebase then push.
Conflicts are surfaced for the human to resolve, never auto-merged.
`
}

/**
 * Folders that hold Vault-synced/generated content once Vault and Brain
 * share a storage root — never the user's own authored notes, so never
 * git-tracked. Exported so `ensureVaultStructure` (src/vault/io.ts) can
 * idempotently top up an existing brain's .gitignore with the same list.
 */
export const BRAIN_GITIGNORE_ENTRIES = ["Topics/", "profile/", ".allternit/"]

function brainGitignore(): string {
  return `# Auto-synced/generated content — never the user's own authored notes.
# Kept out of git so \`gizzi brain status\`/\`sync\` stay meaningful once
# Lens (vault sync) shares this repo. See BRAIN_GITIGNORE_ENTRIES in
# cli/commands/brain/lib.ts.
${BRAIN_GITIGNORE_ENTRIES.join("\n")}
`
}

/** The canonical brain layout (v1). `now` is injectable for tests. */
export function brainTemplates(now: Date = new Date()): BrainTemplate[] {
  const date = now.toISOString().slice(0, 10)
  return [
    { path: "brain.yaml", content: brainYaml(now) },
    { path: ".gitignore", content: brainGitignore() },
    { path: "identity.md", content: identityTemplate() },
    { path: "MEMORY.md", content: memoryMd() },
    { path: join("domains", "_template.md"), content: domainTemplate() },
    { path: join("decisions", "_template.md"), content: decisionTemplate(date) },
    { path: join("runbooks", "_template.md"), content: runbookTemplate() },
    { path: join("ideas", "_template.md"), content: ideaTemplate() },
  ]
}

/* -------------------------------------------------------------------------- */
/* init                                                                       */
/* -------------------------------------------------------------------------- */

export interface InitBrainResult {
  path: string
  files: string[]
  commit: string
}

/**
 * Create the canonical brain structure at `dir`, git-init it, and make the
 * first commit. Refuses to overwrite a non-empty directory unless force.
 */
export async function initBrain(
  dir: string,
  opts: { force?: boolean } = {},
): Promise<InitBrainResult> {
  const path = expandBrainPath(dir)

  if (existsSync(path)) {
    const entries = await readdir(path)
    if (entries.length > 0 && !opts.force) {
      throw new BrainError(
        `refusing to overwrite non-empty directory: ${path} (use --force to reinitialize in place)`,
      )
    }
  }
  await mkdir(path, { recursive: true })

  const files: string[] = []
  for (const tpl of brainTemplates()) {
    const target = join(path, tpl.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, tpl.content, "utf8")
    files.push(tpl.path)
  }

  if (!existsSync(join(path, ".git"))) {
    const init = await git(path, ["init"])
    if (init.code !== 0) {
      throw new BrainError(`git init failed: ${init.stderr}`)
    }
  }

  // A commit needs an identity. Only set a local fallback when neither the
  // repo nor the global config provides one — never clobber the user's.
  const identity = await git(path, ["config", "user.email"])
  if (!identity.stdout) {
    await git(path, ["config", "user.name", "Gizzi Brain"])
    await git(path, ["config", "user.email", "brain@gizzi.local"])
  }

  const add = await git(path, ["add", "-A"])
  if (add.code !== 0) throw new BrainError(`git add failed: ${add.stderr}`)
  const commit = await git(path, [
    "commit",
    "-m",
    "Initialize second brain (gizzi brain init)",
  ])
  if (commit.code !== 0) {
    throw new BrainError(`git commit failed: ${commit.stderr || commit.stdout}`)
  }
  const head = await git(path, ["rev-parse", "--short", "HEAD"])

  return { path, files, commit: head.stdout }
}

/* -------------------------------------------------------------------------- */
/* status                                                                     */
/* -------------------------------------------------------------------------- */

export interface BrainStatus {
  path: string
  /** directory exists and looks like a brain (brain.yaml or .git present) */
  exists: boolean
  isRepo: boolean
  remote: string | null
  /** git status --porcelain lines */
  uncommitted: string[]
  /**
   * Commits not yet on the remote. null when no remote is configured (or no
   * commits exist) — "unpushed" is meaningless without somewhere to push to.
   */
  unpushed: number | null
  clean: boolean
}

export async function getBrainStatus(dir: string): Promise<BrainStatus> {
  const path = expandBrainPath(dir)
  const looksLikeBrain =
    existsSync(join(path, "brain.yaml")) || existsSync(join(path, ".git"))
  if (!looksLikeBrain) {
    return {
      path,
      exists: false,
      isRepo: false,
      remote: null,
      uncommitted: [],
      unpushed: null,
      clean: false,
    }
  }

  const remoteRes = await git(path, ["remote", "get-url", "origin"])
  const remote = remoteRes.code === 0 && remoteRes.stdout ? remoteRes.stdout : null

  const porcelain = await git(path, ["status", "--porcelain"])
  const uncommitted = porcelain.stdout
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  let unpushed: number | null = null
  if (remote) {
    const upstream = await git(path, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ])
    const range =
      upstream.code === 0 && upstream.stdout ? `${upstream.stdout}..HEAD` : "HEAD"
    const count = await git(path, ["rev-list", "--count", range])
    if (count.code === 0) unpushed = Number.parseInt(count.stdout, 10) || 0
  }

  return {
    path,
    exists: true,
    isRepo: existsSync(join(path, ".git")),
    remote,
    uncommitted,
    unpushed,
    clean: uncommitted.length === 0 && (unpushed ?? 0) === 0,
  }
}

/* -------------------------------------------------------------------------- */
/* sync                                                                       */
/* -------------------------------------------------------------------------- */

export type SyncResult =
  | { kind: "no-brain"; path: string }
  | { kind: "no-remote"; path: string }
  | { kind: "dirty"; path: string; files: string[] }
  | { kind: "conflict"; path: string; output: string }
  | { kind: "pull-failed"; path: string; output: string }
  | { kind: "push-failed"; path: string; output: string }
  | { kind: "ok"; path: string; upToDate: boolean }

/**
 * git pull --rebase, then push. Conflicts and failures are reported for the
 * caller to surface as plain instructions — never auto-resolved.
 */
export async function syncBrain(dir: string): Promise<SyncResult> {
  const path = expandBrainPath(dir)
  const status = await getBrainStatus(path)
  if (!status.exists) return { kind: "no-brain", path }
  if (!status.remote) return { kind: "no-remote", path }
  if (status.uncommitted.length > 0) {
    return { kind: "dirty", path, files: status.uncommitted }
  }

  const pull = await git(path, ["pull", "--rebase"])
  if (pull.code !== 0) {
    const rebaseInProgress =
      existsSync(join(path, ".git", "rebase-merge")) ||
      existsSync(join(path, ".git", "rebase-apply"))
    const output = [pull.stdout, pull.stderr].filter(Boolean).join("\n")
    return rebaseInProgress
      ? { kind: "conflict", path, output }
      : { kind: "pull-failed", path, output }
  }

  const push = await git(path, ["push"])
  if (push.code !== 0) {
    return {
      kind: "push-failed",
      path,
      output: [push.stdout, push.stderr].filter(Boolean).join("\n"),
    }
  }

  const upToDate = /already up[ -]to[ -]date/i.test(pull.stdout)
  return { kind: "ok", path, upToDate }
}

/* -------------------------------------------------------------------------- */
/* remote                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Point the brain's origin at `url`, record it in brain.yaml, and commit
 * that metadata change so the repo stays clean for `sync`.
 */
export async function setBrainRemote(dir: string, url: string): Promise<void> {
  const path = expandBrainPath(dir)
  const status = await getBrainStatus(path)
  if (!status.exists) {
    throw new BrainError(`no brain found at ${path} — run \`gizzi brain init\` first`)
  }

  const op = status.remote
    ? await git(path, ["remote", "set-url", "origin", url])
    : await git(path, ["remote", "add", "origin", url])
  if (op.code !== 0) throw new BrainError(`git remote failed: ${op.stderr}`)

  const yamlPath = join(path, "brain.yaml")
  if (existsSync(yamlPath)) {
    const yaml = await readFile(yamlPath, "utf8")
    const line = `remote: "${url}"`
    const next = /^remote:.*$/m.test(yaml)
      ? yaml.replace(/^remote:.*$/m, line)
      : yaml.replace(/\n?$/, `\n${line}\n`)
    await writeFile(yamlPath, next, "utf8")
    await git(path, ["add", "brain.yaml"])
    await git(path, ["commit", "-m", "Set brain remote"])
  }
}
