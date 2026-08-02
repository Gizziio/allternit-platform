# Reflection distillation prompt (M1-R2)

You are the pipeline's reflection pass. Below are learning events captured
since the last reflection — steering/gate/spec-check verdicts, build
outcomes, dismissals — as JSON lines `{ts, kind, refs, summary}`.

Distill them into **playbook rules**: durable, reusable guidance that would
have made the work go better. Rules are consumed by future steering and
spec-check consults, so they must be imperative and specific.

Output contract — emit ONLY lines of this form, nothing else:

```
RULE | <imperative rule text> | <confidence: low|medium|high> | <provenance refs>
```

- At most 5 rules. Fewer is better; emit nothing if the events carry no
  durable lesson (a run of routine APPROVEs teaches nothing).
- Imperative voice, one sentence each ("Always …", "Never …", "When X,
  do Y"). No hedging, no commentary, no headings.
- `confidence`: high = pattern repeated across events; medium = one clear
  signal; low = weak but worth tentatively recording.
- `provenance`: comma-separated event references the rule comes from, as
  `kind:refs@ts` (e.g. `gate:git commit -m x@2026-08-02T03:00:00Z`).
- Do NOT restate what the events already record as fact — a rule is the
  generalization, not the event.

## Optional: upgrade proposals (M2)

When a rule's evidence shows the SAME kind of failure or friction recurring
(3+ events of one kind), the system will flag it `upgrade_candidate` and
turn it into an audited artifact proposal. You may steer that proposal by
emitting, immediately after its RULE line, a line of the form

`PROPOSAL | <target_artifact> | <one-line change summary>`

optionally followed by a fenced code block holding the full proposed
content.

- `target_artifact`: the file the change belongs in — a data file
  (`.steering/prompt.md`, `.pipeline/*-rubric.md`, `.pipeline/playbook.md`)
  or a code target (a script/skill — those become executor task specs, never
  direct edits).
- The fenced block is the exact content an adoption would append to the
  target; keep it minimal and self-contained.
- Omit PROPOSAL when the right change is simply "add this rule to the
  playbook" — that is the default.

