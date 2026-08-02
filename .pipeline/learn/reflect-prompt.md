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
