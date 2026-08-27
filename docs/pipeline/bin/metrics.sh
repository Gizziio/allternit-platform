#!/usr/bin/env bash
# metrics.sh — learning metrics harness (M5). Computes the learning system's
# quality signals from EXISTING logs (read-only — never mutates any input):
#
#   .steering/state/consults.log   gate/stop consult lines written by
#                                  .steering/bin/steer-common.sh steer_log:
#                                    TS session=SID gate=1 cmd="..." verdict=V
#                                    TS session=SID hash=H verdict=V
#   docs/pipeline/learn/events.jsonl   {ts, kind, refs, summary} (learn-event.sh)
#   docs/pipeline/outcomes.jsonl       {ts, slug, outcome, note}; outcome in
#                                  merged|reverted|rejected|failed
#                                  (record-outcome.sh) plus "adopted"
#                                  (audit-proposal.sh linkage, M2-R4)
#   git history                    commit timestamps (commits per ISO week)
#
# Metrics (R1), all per ISO week where applicable:
#   (a) first_pass_rate      — % of gated commits approved on first attempt.
#                              A gated commit = one gate cmd= group with an
#                              APPROVE; first-pass = its first verdict was
#                              APPROVE; attributed to the week of first attempt.
#   (b) gate_block_rate      — STEER share of gate consults per week.
#   (c) verdict_distribution — APPROVE/STEER/REJECT/CONSULT_FAILED counts over
#                              all consult lines (gate + stop).
#   (d) stall_signals        — nudge events in events.jsonl (kind contains
#                              "nudge"; none emitted yet — wired for when they
#                              appear) + gate STEER -> same-cmd APPROVE gaps
#                              strictly > 10 min, attributed to the STEER week.
#   (e) outcome_linkage      — % of adopted proposals (outcomes.jsonl
#                              outcome="adopted") with a recorded real outcome
#                              (merged|reverted|rejected|failed).
#
# Honesty (R3): a metric with < 3 relevant events reports insufficient_data —
# never a fake number. Idempotency (R4): latest.* are overwritten every run;
# history.jsonl is appended only when the metric values changed.
#
# Outputs (R2): docs/pipeline/metrics/latest.json (machine), latest.md (human,
# one paragraph per metric with a trend arrow), and the summary is ingested
# to memory as an insight — advisory: memory down = log + continue.
#
# Overrides (tests): METRICS_PIPELINE_DIR, METRICS_STEERING_DIR,
# METRICS_MEMORY_URL, METRICS_GIT_LOG_FILE (file of ISO commit timestamps
# replacing `git log`).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PIPELINE_DIR="${METRICS_PIPELINE_DIR:-$ROOT/.pipeline}"
STEERING_DIR="${METRICS_STEERING_DIR:-$ROOT/.steering}"
CONSULTS="$STEERING_DIR/state/consults.log"
EVENTS="$PIPELINE_DIR/learn/events.jsonl"
OUTCOMES="$PIPELINE_DIR/outcomes.jsonl"
METRICS_DIR="$PIPELINE_DIR/metrics"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
MEMORY_URL="${METRICS_MEMORY_URL:-http://localhost:3201/api/ingest}"
GIT_LOG_FILE="${METRICS_GIT_LOG_FILE:-}"

mkdir -p "$METRICS_DIR"

GIT_TS_TMP="$(mktemp -t metrics-git-ts)"
trap 'rm -f "$GIT_TS_TMP"' EXIT
if [ -n "$GIT_LOG_FILE" ]; then
  [ -f "$GIT_LOG_FILE" ] && cat "$GIT_LOG_FILE" > "$GIT_TS_TMP" || true
else
  git -C "$ROOT" log --format=%aI > "$GIT_TS_TMP" 2>/dev/null || true
fi

python3 - "$CONSULTS" "$EVENTS" "$OUTCOMES" "$METRICS_DIR" "$GIT_TS_TMP" <<'PY'
import datetime
import json
import os
import re
import sys

CONSULTS, EVENTS, OUTCOMES, METRICS_DIR, GIT_TS = sys.argv[1:6]

MIN_EVENTS = 3          # R3: fewer relevant events than this -> insufficient_data
STALL_GAP_S = 600       # strictly greater than 10 minutes is a stall
EPS = 0.001             # trend flat band for rates

NOW = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(s):
    s = s.strip()
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            return dt.astimezone(datetime.timezone.utc)
        except ValueError:
            pass
    return None


def iso_week(dt):
    y, w, _ = dt.isocalendar()
    return "%04d-W%02d" % (y, w)


def trend(weekly):
    """weekly: {week: value|None}. Compare the two most recent weeks WITH data."""
    vals = [(w, v) for w, v in sorted(weekly.items()) if v is not None]
    if len(vals) < 2:
        return "n/a"
    d = vals[-1][1] - vals[-2][1]
    if d > EPS:
        return "up"
    if d < -EPS:
        return "down"
    return "flat"


ARROW = {"up": "↑", "down": "↓", "flat": "→", "n/a": "·"}

# ─── parse consults.log ─────────────────────────────────────────────────────

line_re = re.compile(r"^(\S+)\s+session=\S+\s+(.*)$")
gate_re = re.compile(r'gate=1\s+cmd="([^"]*)"\s+verdict=(\w+)')
stop_re = re.compile(r"hash=\S+\s+verdict=(\w+)")
VERDICTS = ["APPROVE", "STEER", "REJECT", "CONSULT_FAILED"]

gate = []                      # {ts, week, cmd, verdict}
verdict_counts = {v: 0 for v in VERDICTS}
verdict_weeks = {}             # week -> {verdict: n}

try:
    with open(CONSULTS, encoding="utf-8", errors="replace") as f:
        consult_lines = f.read().splitlines()
except OSError:
    consult_lines = []

for line in consult_lines:
    m = line_re.match(line)
    if not m:
        continue
    dt = parse_ts(m.group(1))
    if dt is None:
        continue
    week = iso_week(dt)
    g = gate_re.search(m.group(2))
    s = stop_re.search(m.group(2))
    verdict = g.group(2) if g else (s.group(1) if s else None)
    if verdict in verdict_counts:
        verdict_counts[verdict] += 1
        vw = verdict_weeks.setdefault(week, {v: 0 for v in VERDICTS})
        vw[verdict] += 1
    if g:
        gate.append({"ts": dt, "week": week, "cmd": g.group(1), "verdict": g.group(2)})

gate.sort(key=lambda e: e["ts"])

# ─── (a) first-pass rate ────────────────────────────────────────────────────

groups = {}
for e in gate:
    groups.setdefault(e["cmd"], []).append(e)

resolved = []                  # (week_of_first_attempt, first_pass_bool)
for cmd, attempts in groups.items():
    if any(a["verdict"] == "APPROVE" for a in attempts):
        resolved.append((attempts[0]["week"], attempts[0]["verdict"] == "APPROVE"))

fp_week_resolved = {}
for week, passed in resolved:
    fp_week_resolved.setdefault(week, []).append(passed)

fp_per_week = {}
for week in sorted({e["week"] for e in gate}):
    rs = fp_week_resolved.get(week, [])
    fp_per_week[week] = (sum(rs) / len(rs)) if len(rs) >= MIN_EVENTS else None

fp_total = len(resolved)
fp_pass = sum(1 for _, p in resolved if p)
first_pass_rate = {
    "status": "ok" if fp_total >= MIN_EVENTS else "insufficient_data",
    "value": (fp_pass / fp_total) if fp_total >= MIN_EVENTS else None,
    "resolved_gated_commits": fp_total,
    "first_pass": fp_pass,
    "per_week": fp_per_week,
    "trend": trend(fp_per_week),
}

# ─── (b) gate block rate ────────────────────────────────────────────────────

gate_weeks = {}
for e in gate:
    gw = gate_weeks.setdefault(e["week"], {"total": 0, "steer": 0})
    gw["total"] += 1
    if e["verdict"] == "STEER":
        gw["steer"] += 1

block_per_week = {
    w: (gw["steer"] / gw["total"] if gw["total"] >= MIN_EVENTS else None)
    for w, gw in sorted(gate_weeks.items())
}
gate_total = len(gate)
steer_total = sum(1 for e in gate if e["verdict"] == "STEER")
gate_block_rate = {
    "status": "ok" if gate_total >= MIN_EVENTS else "insufficient_data",
    "value": (steer_total / gate_total) if gate_total >= MIN_EVENTS else None,
    "gate_consults": gate_total,
    "blocked": steer_total,
    "per_week": block_per_week,
    "trend": trend(block_per_week),
}

# ─── (c) reviewer verdict distribution ──────────────────────────────────────

verdict_total = sum(verdict_counts.values())
share_per_week = {}
for w, vw in verdict_weeks.items():
    tot = sum(vw.values())
    share_per_week[w] = (vw["APPROVE"] / tot) if tot else None
verdict_distribution = {
    "status": "ok" if verdict_total >= MIN_EVENTS else "insufficient_data",
    "counts": verdict_counts,
    "total": verdict_total,
    "approve_share_per_week": share_per_week,
    "trend": trend(share_per_week),
}

# ─── (d) stall signals ──────────────────────────────────────────────────────

stall_weeks = {}               # week -> count
long_gaps = 0
for cmd, attempts in groups.items():
    for i, a in enumerate(attempts):
        if a["verdict"] != "STEER":
            continue
        nxt = next((b for b in attempts[i + 1:] if b["verdict"] == "APPROVE"), None)
        if nxt and (nxt["ts"] - a["ts"]).total_seconds() > STALL_GAP_S:
            long_gaps += 1
            stall_weeks[a["week"]] = stall_weeks.get(a["week"], 0) + 1

nudges = 0
events_total = 0
try:
    with open(EVENTS, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            events_total += 1
            if "nudge" in str(ev.get("kind", "")).lower():
                nudges += 1
                dt = parse_ts(str(ev.get("ts", "")))
                if dt is not None:
                    w = iso_week(dt)
                    stall_weeks[w] = stall_weeks.get(w, 0) + 1
except OSError:
    pass

stall_per_week = {w: stall_weeks.get(w, 0) for w in sorted(set(gate_weeks) | set(stall_weeks))}
stall_signals = {
    "status": "ok" if gate_total >= MIN_EVENTS else "insufficient_data",
    "total": long_gaps + nudges,
    "long_gaps": long_gaps,
    "nudges": nudges,
    "per_week": stall_per_week,
    "trend": trend(stall_per_week),
}

# ─── (e) outcome linkage coverage ───────────────────────────────────────────

adopted = set()
final_outcomes = set()
FINAL = {"merged", "reverted", "rejected", "failed"}
try:
    with open(OUTCOMES, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            slug = str(o.get("slug", ""))
            oc = str(o.get("outcome", ""))
            if oc == "adopted":
                adopted.add(slug)
            elif oc in FINAL:
                final_outcomes.add(slug)
except OSError:
    pass

linked = adopted & final_outcomes
outcome_linkage = {
    "status": "ok" if len(adopted) >= MIN_EVENTS else "insufficient_data",
    "value": (len(linked) / len(adopted)) if len(adopted) >= MIN_EVENTS else None,
    "adopted": len(adopted),
    "linked": len(linked),
    "trend": "n/a",
}

# ─── git history: commits per ISO week ──────────────────────────────────────

commits_per_week = {}
try:
    with open(GIT_TS, encoding="utf-8", errors="replace") as f:
        git_lines = f.read().splitlines()
except OSError:
    git_lines = []
for line in git_lines:
    dt = parse_ts(line)
    if dt is None:
        continue
    w = iso_week(dt)
    commits_per_week[w] = commits_per_week.get(w, 0) + 1
commits_per_week = dict(sorted(commits_per_week.items()))

# ─── latest.json ────────────────────────────────────────────────────────────

metrics = {
    "first_pass_rate": first_pass_rate,
    "gate_block_rate": gate_block_rate,
    "verdict_distribution": verdict_distribution,
    "stall_signals": stall_signals,
    "outcome_linkage": outcome_linkage,
}
latest = {
    "schema_version": 1,
    "generated_at": NOW,
    "sources": {
        "consults_log": CONSULTS,
        "events_jsonl": EVENTS,
        "outcomes_jsonl": OUTCOMES,
        "git_history": "git log --format=%aI",
    },
    "metrics": metrics,
    "commits_per_week": commits_per_week,
}

latest_json_path = os.path.join(METRICS_DIR, "latest.json")
with open(latest_json_path, "w", encoding="utf-8") as f:
    json.dump(latest, f, indent=2, sort_keys=True)
    f.write("\n")

# ─── latest.md ──────────────────────────────────────────────────────────────

def pct(x):
    return "insufficient_data" if x is None else "%d%%" % round(100 * x)


def weekly_str(per_week):
    parts = [
        "%s %s" % (w, pct(v) if isinstance(v, float) or v is None else str(v))
        for w, v in sorted(per_week.items())
    ]
    return "; ".join(parts) if parts else "no weeks"


md = []
md.append("# Learning metrics — latest")
md.append("")
md.append(
    "Generated %s from `.steering/state/consults.log`, "
    "`docs/pipeline/learn/events.jsonl`, `docs/pipeline/outcomes.jsonl`, and git "
    "history. Metrics with < 3 relevant events report `insufficient_data` "
    "(no fake numbers)." % NOW
)
md.append("")

m = first_pass_rate
if m["status"] == "ok":
    md.append(
        "**First-pass rate** (%s): %s of gated commits were approved by the "
        "commit gate on the first attempt (%d/%d resolved gated commits). Per "
        "week: %s. Git history shows %s commit(s) in the window."
        % (
            ARROW[m["trend"]], pct(m["value"]), m["first_pass"],
            m["resolved_gated_commits"], weekly_str(m["per_week"]),
            sum(commits_per_week.values()),
        )
    )
else:
    md.append(
        "**First-pass rate** (·): insufficient_data — only %d resolved gated "
        "commit(s) (< %d), so no rate is reported."
        % (m["resolved_gated_commits"], MIN_EVENTS)
    )
md.append("")

m = gate_block_rate
if m["status"] == "ok":
    md.append(
        "**Gate block rate** (%s): %s of gate consults returned STEER and "
        "blocked the commit (%d/%d). Per week: %s."
        % (ARROW[m["trend"]], pct(m["value"]), m["blocked"],
           m["gate_consults"], weekly_str(m["per_week"]))
    )
else:
    md.append(
        "**Gate block rate** (·): insufficient_data — only %d gate "
        "consult(s) (< %d)." % (m["gate_consults"], MIN_EVENTS)
    )
md.append("")

m = verdict_distribution
if m["status"] == "ok":
    md.append(
        "**Reviewer verdict distribution** (%s): %s across %d consults "
        "(gate + checkpoint). Trend tracks the weekly APPROVE share."
        % (
            ARROW[m["trend"]],
            ", ".join("%s %d" % (v, m["counts"][v]) for v in VERDICTS),
            m["total"],
        )
    )
else:
    md.append(
        "**Reviewer verdict distribution** (·): insufficient_data — only %d "
        "consult verdict(s) (< %d)." % (m["total"], MIN_EVENTS)
    )
md.append("")

m = stall_signals
if m["status"] == "ok":
    md.append(
        "**Executor stall signals** (%s): %d total — %d long gate gap(s) "
        "(STEER → same-cmd APPROVE > 10 min) + %d nudge event(s). Per week: "
        "%s."
        % (
            ARROW[m["trend"]], m["total"], m["long_gaps"], m["nudges"],
            "; ".join("%s %d" % (w, v) for w, v in sorted(m["per_week"].items()))
            or "no weeks",
        )
    )
else:
    md.append(
        "**Executor stall signals** (·): insufficient_data — only %d gate "
        "consult(s) (< %d), so gaps cannot be judged."
        % (gate_total, MIN_EVENTS)
    )
md.append("")

m = outcome_linkage
if m["status"] == "ok":
    md.append(
        "**Outcome linkage coverage** (%s): %s of adopted proposals have a "
        "recorded outcome (%d/%d linked in outcomes.jsonl)."
        % (ARROW[m["trend"]], pct(m["value"]), m["linked"], m["adopted"])
    )
else:
    md.append(
        "**Outcome linkage coverage** (·): insufficient_data — only %d "
        "adopted proposal(s) (< %d)." % (m["adopted"], MIN_EVENTS)
    )
md.append("")

latest_md = "\n".join(md)
latest_md_path = os.path.join(METRICS_DIR, "latest.md")
with open(latest_md_path, "w", encoding="utf-8") as f:
    f.write(latest_md)

# ─── history.jsonl: append only on change (R4) ──────────────────────────────

digest = json.dumps(
    {"metrics": metrics, "commits_per_week": commits_per_week},
    sort_keys=True,
)
history_path = os.path.join(METRICS_DIR, "history.jsonl")
last = None
try:
    with open(history_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if line:
                last = line
except OSError:
    pass
if last is not None:
    try:
        last_digest = json.dumps(
            {k: json.loads(last)[k] for k in ("metrics", "commits_per_week")},
            sort_keys=True,
        )
    except (ValueError, KeyError):
        last_digest = None
else:
    last_digest = None
appended = False
if last_digest != digest:
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": NOW,
            "metrics": metrics,
            "commits_per_week": commits_per_week,
        }, sort_keys=True) + "\n")
    appended = True

# ─── stdout summary ─────────────────────────────────────────────────────────

for name, m in metrics.items():
    if m["status"] == "ok":
        val = m.get("value")
        shown = pct(val) if val is not None else str(m.get("total"))
    else:
        shown = "insufficient_data"
    print("metrics: %-22s %s (%s)" % (name, shown, m["trend"]))
print("metrics: wrote %s and %s%s" % (
    latest_json_path, latest_md_path,
    "; history appended" if appended else "; history unchanged",
))
PY

# ─── R2: ingest the summary to memory as an insight (advisory) ──────────────

if [ -f "$METRICS_DIR/latest.md" ]; then
  payload=$(python3 -c 'import json,sys
content = open(sys.argv[1], encoding="utf-8", errors="replace").read()
print(json.dumps({
    "content": content,
    "source": "pipeline-metrics",
    "metadata": {
        "source": "pipeline-metrics",
        "trust_tier": "trusted",
        "provenance_ref": "docs/pipeline/metrics/latest.md",
    },
}))' "$METRICS_DIR/latest.md")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  if [[ "$code" != 2* ]]; then
    printf '[%s] %s\n' "$(date -u +%FT%TZ)" \
      "metrics: memory ingest failed (HTTP ${code:-000}) — continuing (advisory)" >> "$ERRORS_LOG"
    echo "metrics: memory unreachable — logged, continuing (advisory)"
  fi
fi
