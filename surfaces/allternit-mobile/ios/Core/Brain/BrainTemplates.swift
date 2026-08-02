import Foundation

/// The canonical brain layout (v1 — Track D), replicated EXACTLY from
/// cmd/gizzi-code/src/cli/commands/brain/lib.ts (lines 49-313) so an
/// iOS-created brain is byte-identical in shape to `gizzi brain init`.
enum BrainTemplates {
    /// One file of the canonical layout: path relative to the brain root +
    /// full content.
    typealias CanonicalFile = (path: String, content: String)

    /// The 7 canonical files. `now` stamps brain.yaml `created:` and the
    /// decisions template `date:`; `remote` is the hosted clone URL, written
    /// as `remote: "<url>"` (the shape lib.ts's `remote` command writes —
    /// brainYaml() itself emits `remote: null` until one is configured).
    static func canonicalFiles(now: Date, remote: String) -> [CanonicalFile] {
        let iso = ISO8601DateFormatter().string(from: now)
        let date = String(iso.prefix(10))
        // Swift multiline literals drop the newline before the closing
        // delimiter; lib.ts's template literals keep it, so each content
        // gets its single trailing newline restored here for byte-parity.
        return [
            (path: "brain.yaml", content: brainYaml(created: iso, remote: remote) + "\n"),
            (path: "identity.md", content: identityTemplate() + "\n"),
            (path: "MEMORY.md", content: memoryMd() + "\n"),
            (path: "domains/_template.md", content: domainTemplate() + "\n"),
            (path: "decisions/_template.md", content: decisionTemplate(date: date) + "\n"),
            (path: "runbooks/_template.md", content: runbookTemplate() + "\n"),
            (path: "ideas/_template.md", content: ideaTemplate() + "\n"),
        ]
    }

    private static func identityTemplate() -> String {
        """
        ---
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
        """
    }

    private static func domainTemplate() -> String {
        """
        ---
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
        """
    }

    private static func decisionTemplate(date: String) -> String {
        """
        ---
        type: decision
        status: active
        domain: meta
        date: \(date)
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
        """
    }

    private static func runbookTemplate() -> String {
        """
        ---
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
        """
    }

    private static func ideaTemplate() -> String {
        """
        ---
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
        """
    }

    private static func brainYaml(created: String, remote: String) -> String {
        """
        # Second-brain metadata (canonical layout v1 — Track D).
        # schema_version lets future tooling migrate the layout safely.
        schema_version: 1
        owner: ""
        created: "\(created)"
        # Platform remote (D2 hosted brain). Also recorded as git remote "origin".
        remote: "\(remote)"
        """
    }

    private static func memoryMd() -> String {
        """
        # MEMORY — the user's second brain

        This repository is the user's **second brain**: a local-first git repo of
        markdown pages with YAML frontmatter, created by `gizzi brain init`. It is
        the system of record for who the user is, what they care about, and what
        they have decided. Any hosted remote is only a mirror — losing it loses
        nothing, because every clone has full history.

        ## For agents: how to read this brain

        1. Read `identity.md` first — who the user is, their roles, goals, and
           working preferences. Let it shape tone, priorities, and defaults.
        2. Scan `domains/` to learn the user's areas of work and life. When a task
           touches a domain, read that domain's page before acting.
        3. Respect `decisions/` — pages with `status: active` are settled; do not
           re-litigate them. `status: superseded` pages explain history.
        4. Use `runbooks/` for repeatable procedures; follow the steps as written
           and report where reality diverged from them.
        5. Treat `ideas/` as intake, not commitments: `status: new` means
           unevaluated. Never present an idea as the user's settled intent.

        ## Frontmatter convention

        Every corpus page starts with YAML frontmatter following the Track-C2
        convention (`type`, `status`, `domain`), so the taste engine's wiki
        connector can ingest this brain with zero adapter work:

        | path          | `type`          | `status`                                  | extra fields            |
        | ------------- | ----------------- | ------------------------------------------- | ----------------------- |
        | `identity.md` | `identity`      | `active`                                    |                         |
        | `domains/`    | `domain`        | `active` / `archived`                       | `domain` = page slug    |
        | `decisions/`  | `decision`      | `active` / `superseded`                     | `date` (YYYY-MM-DD)   |
        | `runbooks/`   | `runbook`       | `active` / `archived`                       | `domain`                |
        | `ideas/`      | `idea` / `pain` | `new` / `reviewing` / `rejected` / `built` | `domain`                |

        `brain.yaml` carries repo metadata (`schema_version`, `owner`,
        `created`, `remote`). Files named `_template.md` are copy-me templates,
        not content — never summarize them as facts about the user.

        ## For agents: how to write

        - Only add or edit pages when the user asks (or an onboarding flow directs
          it). Never silently rewrite identity or decisions.
        - New pages: copy the directory's `_template.md`, keep the frontmatter
          convention, use lowercase-slug filenames (e.g.
          `decisions/0002-use-sqlite.md`).
        - Commit every change with a plain message, then `gizzi brain sync` pushes
          it when a remote is configured.

        ## Layout

        | path          | what lives there                                |
        | ------------- | ----------------------------------------------- |
        | `brain.yaml`  | schema_version, owner, created, platform remote |
        | `identity.md` | who the user is: roles, goals, working style    |
        | `domains/`    | ongoing areas of work/life                      |
        | `decisions/`  | dated decisions and what superseded them        |
        | `runbooks/`   | repeatable procedures                           |
        | `ideas/`      | ideas and pains — intake for the taste engine   |

        Sync is plain git: `gizzi brain sync` runs pull --rebase then push.
        Conflicts are surfaced for the human to resolve, never auto-merged.
        """
    }
}
