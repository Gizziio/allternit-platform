# Weekly photo editions — executor task spec

You are the weekly photo-edition executor for the Allternit publications
pipeline. This is a deterministic maintenance job, not a design task. Execute
the steps exactly, in order. Do not improvise.

## Steps

1. Run the generator for published items that lack a photo edition:

   ```bash
   node .github/scripts/generate-photo-edition.cjs --new
   ```

   This harvests source images, generates Codex photos for the uncovered
   slots, renders `.photo.pdf` files, and stamps `photoUrl` in the pipeline
   JSON. It can take 5-25 minutes depending on how many editions are new.
   A clean no-op output ("No publications need photo editions") is a
   success, not a failure.

2. Check for produced changes:

   ```bash
   git status --porcelain -- surfaces/ai.allternit.com
   ```

   If empty: this is a no-op week. Skip to step 5 with status: done.

3. Stage exactly these paths — nothing else:

   ```bash
   git add surfaces/ai.allternit.com/src/data/discovery-pipeline.json \
           surfaces/ai.allternit.com/public/editions/ \
           surfaces/ai.allternit.com/public/images/editions/
   ```

4. Commit and push:

   ```bash
   git commit -m "chore: weekly photo editions $(date -u +%Y-%m-%d)"
   git push origin main
   ```

5. Write the completion notes to
   `~/.agent-orchestrator/evidence/weekly-photo-editions/NOTES.md` starting
   with YAML frontmatter:

   ```yaml
   ---
   status: done | blocked
   editions_rendered: [slugs]
   files_changed: [paths]
   deviations: [what + why, or none]
   remaining: [items, or none]
   ---
   ```

   Then prose notes: what the generator printed, any failed photo slots.

## Hard constraints

- Never amend, never force-push, never rebase. No git operations beyond the
  `add`/`commit`/`push` above.
- Never stage files outside `surfaces/ai.allternit.com`.
- Do not run builds, dev servers, or other generators.
- If the generator exits nonzero or reports failures, still write NOTES.md
  with `status: blocked` and the error output. Do not retry more than once.
