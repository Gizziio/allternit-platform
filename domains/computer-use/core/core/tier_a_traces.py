"""
Allternit Computer Use — Tier A Labelled Trace Generation

Builds the training data for the Tier A classifier
(core/tier_a_head.py) from the shadow eval harness's scripted tasks
(core/shadow_eval.py). The recorded-LLM transcript IS the distillation
target: each decide step's reference answer is the recorded operation and
target, and the questions/state text are captured by running a recording
head through the real PlanningLoop — so training prompts are byte-identical
to what a head sees at eval time.

Data expansion: the three canonical task templates are parameterized into
many variants (different query/field/control names, phrases, distractors,
cycle shapes) with DYNAMIC observations — the AX tree mutates per step
(status texts appear, dropdown options open, results populate — the same
signals a live page emits). Without per-step observation change the state
text is constant within a task (verified: 1 unique state per canonical
task), and no classifier — trained or zero-shot — can beat the per-task
modal policy. Dynamics make state -> action transitions learnable.

Split discipline: the three canonical eval tasks (search-flow, form-fill,
settings-toggle, 22 steps each = 66) are HELD OUT — never seen in training.
Train/val variants are built from name pools asserted disjoint from every
canonical name, so held-out generalization cannot leak through surface
strings. Phase-0 variant states are structurally identical to the canonical
states (same roles, same row layout, different names only), which is what
lets a policy learned on variants transfer to the canonical eval.

Trace record schema (one JSON object per line):

    {
      "schema_version": 1,
      "trace_id": "<task_id>:s<step>",
      "task_id": "search-v03",
      "template": "search",
      "split": "train" | "val" | "heldout",
      "step": 5,
      "state_text": "<exact shadow-head prompt>",
      "questions": [{"name": "operation", "options": [...]}, ...],
      "gold": {"operation": "fill", "fill_target": "1", ...},
      "llm": {"op": "fill", "target": "Query box", "text": ..., "success": true}
    }

``gold`` carries ONLY questions with a resolved reference answer; any
question missing from the map (speculative target menus for operations the
recorded policy did not choose, unresolvable targets) trains as the abstain
pseudo-option (core/decision_head.ABSTAIN_OPTION).
"""

from __future__ import annotations

import copy
import json
import random
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

from .decision_head import (
    ABSTAIN_OPTION,
    Choice,
    TypedDecision,
)
from .shadow_eval import (
    _LLM_OP_MAP,
    SyntheticTask,
    ScriptedTurn,
    _node,
    _step_trees,
    default_tasks,
    run_task_sync,
)

TRACE_SCHEMA_VERSION = 1
SPLIT_TRAIN = "train"
SPLIT_VAL = "val"
SPLIT_HELDOUT = "heldout"
_SPLITS = (SPLIT_TRAIN, SPLIT_VAL, SPLIT_HELDOUT)

# Name-mixing augmentation: control-row names re-rolled from these pools so
# the model cannot memorize surface strings and must learn structure/
# position policies (the canonical eval uses names the variants must never
# touch — held-out integrity — so transfer rides on structure, not names).
_MIX_ADJECTIVES = [
    "Quick", "Silent", "Bright", "Nimble", "Amber", "Cobalt", "Dusky",
    "Mellow", "Brisk", "Polished", "Quiet", "Sturdy",
]
_MIX_NOUNS = [
    "field", "box", "button", "link", "panel", "input", "control", "entry",
    "switch", "tile", "marker", "slot",
]

CANONICAL_TASK_IDS = ("search-flow", "form-fill", "settings-toggle")

# Name pools — every entry is asserted disjoint from every canonical element
# name and turn target at generation time (held-out integrity).
_SEARCH_QUERIES = ["Query box", "Find field", "Keyword input", "Lookup box", "Search terms"]
_SEARCH_BUTTONS = ["Go", "Find", "Run search", "Seek", "Query"]
_SEARCH_RESULTS = ["Top hit", "Result 1", "First match", "Lead result", "Best match"]
_SEARCH_PANELS = ["Matches", "Findings", "Hit list"]
_SEARCH_PHRASES = [
    "annual budget", "onboarding guide", "sales pipeline", "release notes",
    "vendor invoice", "headcount plan", "uptime report", "design mockups",
]
_FORM_USERS = ["Username", "Email address", "Work email", "Login ID", "Operator email"]
_FORM_SECRETS = ["Passphrase", "PIN", "Access code", "Credential", "Secret key"]
_FORM_SUBMITS = ["Log in", "Sign in", "Continue", "Proceed", "Unlock"]
_FORM_CHECKS = ["Remember this device", "Keep me signed in", "Trust this browser"]
_FORM_LINKS = ["Reset access", "Need help?", "Recover account", "Contact support"]
_FORM_EXTRA_FIELDS = ["Company code", "Team name", "Workspace ID"]
_SETTINGS_TOGGLES = ["Dark mode", "Auto-save", "Two-factor auth", "Weekly digest", "Sound effects"]
_SETTINGS_MENUS = ["Language", "Timezone", "Density", "Region", "Date format"]
_SETTINGS_SAVES = ["Apply", "Update settings", "Confirm changes", "Done"]
_SETTINGS_LINKS = ["Return to dashboard", "Back to account", "Close preferences"]
_SETTINGS_PANELS = ["Preferences pane", "Options panel", "Config drawer"]
_MENU_ITEMS = [["Dark", "Light"], ["English", "German", "Japanese"], ["Compact", "Comfortable"], ["UTC", "PST", "EST"]]
_DISTRACTOR_TEXTS = [
    "Welcome back", "Last synced 2h ago", "3 notifications pending",
    "Session expires soon", "New features available",
]
_PHRASES_EXTRA = ["quarterly metrics", "launch checklist", "budget v2", "roadmap draft"]

_REQUIRED_KEYS = (
    "schema_version", "trace_id", "task_id", "template", "split",
    "step", "state_text", "questions", "gold", "llm",
)


def canonical_names() -> set:
    """Every element name + turn target in the three canonical eval tasks —
    the held-out surface strings variants must never reuse."""
    names = set()
    for task in default_tasks(22):
        def visit(node: Any) -> None:
            if getattr(node, "name", ""):
                names.add(node.name)
            for child in getattr(node, "children", []) or []:
                visit(child)
        visit(task.tree)
        for turn in task.turns:
            if turn.target:
                names.add(turn.target)
    return names


def _check_pool_disjoint() -> None:
    canonical = canonical_names()
    pools = (
        _SEARCH_QUERIES + _SEARCH_BUTTONS + _SEARCH_RESULTS + _SEARCH_PANELS
        + _FORM_USERS + _FORM_SECRETS + _FORM_SUBMITS + _FORM_CHECKS
        + _FORM_LINKS + _FORM_EXTRA_FIELDS
        + _SETTINGS_TOGGLES + _SETTINGS_MENUS + _SETTINGS_SAVES
        + _SETTINGS_LINKS + _SETTINGS_PANELS
    )
    leaked = sorted({name for name in pools if name in canonical})
    if leaked:
        raise ValueError(f"variant name pools leak canonical names: {leaked}")


# ---------------------------------------------------------------------------
# Variant task builders — each returns a SyntheticTask whose step_trees
# mutate per cycle phase (dynamic observations)
# ---------------------------------------------------------------------------

def _search_variant(rng: random.Random, index: int, steps: int) -> SyntheticTask:
    query = rng.choice(_SEARCH_QUERIES)
    button = rng.choice(_SEARCH_BUTTONS)
    result1, result2 = rng.sample(_SEARCH_RESULTS, 2)
    extra1, extra2 = rng.sample(
        [r for r in _SEARCH_RESULTS if r not in (result1, result2)], 2,
    )
    panel = rng.choice(_SEARCH_PANELS)
    phrase = rng.choice(_SEARCH_PHRASES)
    status1 = rng.choice(["Searching…", "Looking up matches…", "Fetching results…"])
    status2 = rng.choice(["Results ready", "Matches found", "Top results loaded"])

    def base() -> Any:
        return _node("AXWindow", "EvalBrowser", [
            _node("AXTextField", query, interactive=True),
            _node("AXButton", button, interactive=True),
            _node("AXScrollArea", panel, [
                _node("AXLink", result1, interactive=True),
                _node("AXLink", result2, interactive=True),
            ], interactive=True),
            _node("AXStaticText", f"Results for: {phrase}"),
        ])

    def searching() -> Any:
        # Clicking search hides the stale results and shows a busy state —
        # a substantial mutation, not a one-row flag (real pages do this;
        # a single extra status row measured as invisible in pooled
        # embeddings: ~0.994 cosine to the base state).
        tree = base()
        tree.children[2].children = []
        tree.children.append(_node("AXStaticText", status1))
        tree.children.append(_node("AXStaticText", f"Query: {phrase}"))
        return tree

    def results_ready() -> Any:
        tree = base()
        tree.children[2].children += [
            _node("AXLink", extra1, interactive=True),
            _node("AXLink", extra2, interactive=True),
        ]
        tree.children.append(_node("AXStaticText", status2))
        return tree

    cycle = [
        (ScriptedTurn("fill", query, text=phrase), base()),
        (ScriptedTurn("click", button), searching()),
        (ScriptedTurn("click", result1), results_ready()),
    ]
    return _from_cycle("search", index, cycle, steps, rng, f"Use {button} to find '{phrase}' and open {result1}")


def _form_variant(rng: random.Random, index: int, steps: int) -> SyntheticTask:
    user = rng.choice(_FORM_USERS)
    secret = rng.choice(_FORM_SECRETS)
    submit = rng.choice(_FORM_SUBMITS)
    check = rng.choice(_FORM_CHECKS)
    link = rng.choice(_FORM_LINKS)
    extra = rng.choice(_FORM_EXTRA_FIELDS)
    use_extra = rng.random() < 0.35
    use_check_cycle = rng.random() < 0.3
    status1 = rng.choice(["Credentials entered", "Fields updated", "Input accepted"])
    status2 = rng.choice(["Ready to submit", "Form complete", "All fields valid"])
    progress1 = rng.choice(["Step 1 of 2 complete", "2 of 3 fields complete"])
    review = rng.choice(["Review your entries", "Almost done"])

    def base() -> Any:
        children = [
            _node("AXTextField", user, interactive=True),
            _node("AXTextField", secret, interactive=True),
        ]
        if use_extra:
            children.append(_node("AXTextField", extra, interactive=True))
        children += [
            _node("AXCheckBox", check, interactive=True),
            _node("AXButton", submit, interactive=True),
            _node("AXLink", link, interactive=True),
        ]
        return _node("AXWindow", "EvalBrowser", children)

    def mid_fill() -> Any:
        # First credential accepted: progress markers appear.
        tree = base()
        tree.children.append(_node("AXStaticText", status1))
        tree.children.append(_node("AXStaticText", progress1))
        return tree

    def ready() -> Any:
        tree = base()
        tree.children.append(_node("AXStaticText", review))
        tree.children.append(_node("AXStaticText", status2))
        return tree

    third_turn = ScriptedTurn("click", check) if use_check_cycle else ScriptedTurn("click", submit)
    cycle = [
        (ScriptedTurn("fill", user, text="operator@eval.local"), base()),
        (ScriptedTurn("fill", secret, text="hunter2"), mid_fill()),
        (third_turn, ready()),
    ]
    task_text = f"Log in with the saved operator credentials via {submit}"
    return _from_cycle("form", index, cycle, steps, rng, task_text)


def _settings_variant(rng: random.Random, index: int, steps: int) -> SyntheticTask:
    menu = rng.choice(_SETTINGS_MENUS)
    toggle = rng.choice(_SETTINGS_TOGGLES)
    save = rng.choice(_SETTINGS_SAVES)
    link = rng.choice(_SETTINGS_LINKS)
    panel = rng.choice(_SETTINGS_PANELS)
    items = rng.choice(_MENU_ITEMS)
    open_menu = rng.random() < 0.5
    scroll_tail = rng.random() < 0.25

    def base() -> Any:
        return _node("AXWindow", "EvalBrowser", [
            _node("AXPopUpButton", menu, interactive=True),
            _node("AXCheckBox", toggle, interactive=True),
            _node("AXButton", save, interactive=True),
            _node("AXLink", link, interactive=True),
            _node("AXScrollArea", panel, interactive=True),
        ])

    def menu_open() -> Any:
        # Clicking the popup opens its options — a substantial mutation.
        tree = base()
        tree.children[0].children = [
            _node("AXMenuItem", item, interactive=True) for item in items
        ]
        tree.children.append(_node("AXStaticText", f"{menu} options open"))
        tree.children.append(_node("AXStaticText", "Choose an option"))
        return tree

    def toggled() -> Any:
        tree = base()
        tree.children.append(_node("AXStaticText", f"{toggle} enabled"))
        tree.children.append(_node("AXStaticText", "Unsaved changes"))
        return tree

    def stored() -> Any:
        tree = base()
        tree.children.append(_node("AXStaticText", "Settings stored"))
        tree.children.append(_node("AXStaticText", "Everything is up to date"))
        return tree

    if open_menu:
        cycle = [
            (ScriptedTurn("click", menu), menu_open()),
            (ScriptedTurn("click", toggle), toggled()),
            (ScriptedTurn("click", save), stored()),
        ]
    else:
        tail_turn = ScriptedTurn("scroll", panel) if scroll_tail else ScriptedTurn("click", save)
        cycle = [
            (ScriptedTurn("click", menu), base()),
            (ScriptedTurn("click", toggle), toggled()),
            (tail_turn, stored()),
        ]
    task_text = f"Enable {toggle.lower()} and save the settings"
    return _from_cycle("settings", index, cycle, steps, rng, task_text)


def _from_cycle(
    template: str,
    index: int,
    cycle: Sequence[Tuple[ScriptedTurn, Any]],
    steps: int,
    rng: random.Random,
    task_text: str,
) -> SyntheticTask:
    """Repeat a (turn, observation) cycle to ``steps`` turns; assign one
    scripted adapter failure target outside the modal (phase-0) step."""
    turns = [copy.deepcopy(cycle[i % len(cycle)][0]) for i in range(steps)]
    # The planning loop consumes trees[0] as the pre-step observation and
    # step s sees trees[s], so shift by one: step s (turn s-1, cycle phase
    # (s-1) % L) is decided against the matching cycle phase's tree. Without
    # the shift, gold and observation sit one cycle phase apart (verified
    # against the recorded states).
    step_trees = [copy.deepcopy(cycle[(i - 1) % len(cycle)][1]) for i in range(steps)]
    fail_candidates = sorted({t.target for t in turns if t.target} - {turns[0].target})
    fail_targets = [rng.choice(fail_candidates)] if fail_candidates else []
    return SyntheticTask(
        task_id=f"{template}-v{index:02d}",
        task=task_text,
        tree=copy.deepcopy(step_trees[0]),
        turns=turns,
        fail_targets=fail_targets,
        step_trees=step_trees,
    )


_BUILDERS = {"search": _search_variant, "form": _form_variant, "settings": _settings_variant}


def make_variant_tasks(
    seed: int = 42,
    n_variants: int = 22,
    n_val: int = 4,
    steps_range: Tuple[int, int] = (20, 28),
) -> Tuple[List[SyntheticTask], List[SyntheticTask]]:
    """Build the train/val variant tasks deterministically from ``seed``.

    Returns (train_tasks, val_tasks). Names are drawn from pools asserted
    disjoint from every canonical held-out name.
    """
    _check_pool_disjoint()
    rng = random.Random(seed)
    templates = list(_BUILDERS)
    variants = [
        _BUILDERS[templates[i % len(templates)]](rng, i, rng.randint(*steps_range))
        for i in range(n_variants)
    ]
    order = list(range(n_variants))
    rng.shuffle(order)
    val_ids = set(order[:n_val])
    train = [t for i, t in enumerate(variants) if i not in val_ids]
    val = [t for i, t in enumerate(variants) if i in val_ids]
    return train, val


# ---------------------------------------------------------------------------
# Trace capture — a recording head through the REAL planning loop, so the
# captured (state_text, questions) are byte-identical to a live eval pass
# ---------------------------------------------------------------------------

class _RecordingHead:
    """DecisionHead that records each pass's inputs and answers uniformly so
    the loop proceeds through the scripted transcript."""

    def __init__(self) -> None:
        self.records: List[Tuple[str, List[Dict[str, Any]]]] = []

    def decide(self, state_text: str, questions: Sequence[Any]) -> TypedDecision:
        self.records.append((
            state_text,
            [{"name": q.name, "options": [str(o) for o in q.options]} for q in questions],
        ))
        choices = {}
        for q in questions:
            n = len(q.options)
            choices[q.name] = Choice(
                q.name, q.options[0],
                {o: 1.0 / n for o in q.options}, 0.0,
            )
        return TypedDecision(choices=choices, latency_ms=0.0, model_id="trace-recorder")


def _strip_ids(rendered_table: str) -> str:
    """Remove ``[<id>] `` row prefixes — the loop's refmap renders ``@eN``
    refs while a freshly built table renders plain indices; the row ORDER
    (what the scorer's positional indices mean) is identical."""
    import re

    return re.sub(r"\[[^\]]*\] ", "", rendered_table)


def _table_for_state(state_text: str, step_trees: Sequence[Any]) -> Any:
    """Rebuild the element table for one recorded state by matching the
    rendered table text inside the captured prompt (robust to the loop's
    snapshot cadence and to @eN ref rendering). When several trees match —
    a static base tree's text is a substring of a mutated phase tree's text
    — the LONGEST (most rows) wins."""
    from .element_table import build_element_table

    haystack = _strip_ids(state_text)
    best: Any = None
    for tree in step_trees:
        table = build_element_table(tree)
        rendered = _strip_ids(table.to_prompt_text())
        if rendered and rendered in haystack:
            if best is None or len(table) > len(best):
                best = table
    if best is None:
        raise ValueError("no step tree's element table matches the recorded state text")
    return best


def task_traces(task: SyntheticTask, split: str) -> List[Dict[str, Any]]:
    """Record one task through the real planning loop and label every decide
    step from the recorded-LLM transcript (the distillation target)."""
    recorder = _RecordingHead()
    run_task_sync(task, head=recorder)
    step_trees = _step_trees(task)
    traces = []
    fail_targets = set(task.fail_targets)
    for step_num, (state_text, questions) in enumerate(recorder.records, start=1):
        turn = task.turns[step_num - 1]
        llm_op = _LLM_OP_MAP.get(turn.action_type, turn.action_type)
        by_name = {q["name"]: q for q in questions}

        gold: Dict[str, str] = {}
        operation_options = by_name.get("operation", {}).get("options", [])
        if llm_op in operation_options:
            gold["operation"] = llm_op
        table = _table_for_state(state_text, step_trees)
        target_question = by_name.get(f"{llm_op}_target")
        if target_question is not None:
            matched = table.match_target(turn.target)
            if matched is not None and str(matched) in target_question["options"]:
                gold[f"{llm_op}_target"] = str(matched)
        if "goal_satisfied" in by_name:
            gold["goal_satisfied"] = "true" if step_num == len(task.turns) else "false"
        if "stuck" in by_name:
            gold["stuck"] = "true" if turn.target in fail_targets else "false"

        traces.append({
            "schema_version": TRACE_SCHEMA_VERSION,
            "trace_id": f"{task.task_id}:s{step_num}",
            "task_id": task.task_id,
            "template": task.task_id.split("-")[0],
            "split": split,
            "step": step_num,
            "state_text": state_text,
            "questions": questions,
            "gold": gold,
            "llm": {
                "op": llm_op,
                "target": turn.target,
                "text": turn.text,
                "success": turn.target not in fail_targets,
            },
        })
    return traces


def _mixed_name(rng: random.Random, canonical: set) -> str:
    for _ in range(50):
        name = f"{rng.choice(_MIX_ADJECTIVES)} {rng.choice(_MIX_NOUNS)}"
        if name not in canonical:
            return name
    raise ValueError("could not draw a mixed name disjoint from canonical names")


def augment_record_names(record: Dict[str, Any], rng: random.Random) -> Dict[str, Any]:
    """Copy of a trace with every CONTROL row's name re-rolled from the
    mix pools (status rows keep their text — they are the phase signal).
    Row order, roles, indices, questions and golds are untouched, so the
    structure/position policy is the only consistent way to fit the mixed
    copies — which is exactly the policy that transfers to the canonical
    held-out names the variant pools are forbidden to use.
    """
    from .element_table import ROLE_OPERATIONS

    canonical = canonical_names()
    out_lines = []
    in_block = False
    for line in record["state_text"].splitlines():
        stripped = line.strip()
        if stripped == "[OBSERVED ELEMENTS]":
            in_block = True
            out_lines.append(line)
            continue
        if in_block:
            if stripped.startswith("[") and "] " in stripped and ": " in stripped:
                ident, rest = stripped[1:].split("] ", 1)
                role, _name = rest.split(": ", 1)
                if role in ROLE_OPERATIONS:
                    out_lines.append(f"[{ident}] {role}: {_mixed_name(rng, canonical)}")
                else:
                    out_lines.append(line)
                continue
            if stripped.startswith("["):
                in_block = False
            out_lines.append(line)
            continue
        out_lines.append(line)
    mixed = dict(record)
    mixed["state_text"] = "\n".join(out_lines)
    mixed["trace_id"] = f"{record['trace_id']}+mix{rng.randint(100, 999)}"
    return mixed


def build_traces(
    seed: int = 42,
    n_variants: int = 22,
    n_val: int = 4,
    heldout_steps: int = 22,
    train_mixes: int = 2,
) -> List[Dict[str, Any]]:
    """The full labelled set: train + val variants + the held-out canonical
    tasks. Deterministic for a given ``seed``.

    Train traces are emitted ``train_mixes`` extra times with control-row
    names re-rolled (see :func:`augment_record_names`); val and held-out
    stay name-original so val still measures pool-name generalization.
    """
    train_tasks, val_tasks = make_variant_tasks(seed=seed, n_variants=n_variants, n_val=n_val)
    traces: List[Dict[str, Any]] = []
    mix_rng = random.Random(seed + 1)
    for task in train_tasks:
        train_traces = task_traces(task, SPLIT_TRAIN)
        traces.extend(train_traces)
        for _ in range(train_mixes):
            for record in train_traces:
                traces.append(augment_record_names(record, mix_rng))
    for task in val_tasks:
        traces.extend(task_traces(task, SPLIT_VAL))
    for task in default_tasks(heldout_steps):
        traces.extend(task_traces(task, SPLIT_HELDOUT))
    return traces


# ---------------------------------------------------------------------------
# Schema validation + JSONL IO
# ---------------------------------------------------------------------------

def validate_trace(record: Dict[str, Any]) -> None:
    """Raise ValueError when a trace record does not match the schema."""
    missing = [key for key in _REQUIRED_KEYS if key not in record]
    if missing:
        raise ValueError(f"trace missing keys: {missing}")
    if record["schema_version"] != TRACE_SCHEMA_VERSION:
        raise ValueError(f"unsupported schema_version {record['schema_version']!r}")
    if record["split"] not in _SPLITS:
        raise ValueError(f"split must be one of {_SPLITS}, got {record['split']!r}")
    if not isinstance(record["state_text"], str) or "[OBSERVED ELEMENTS]" not in record["state_text"]:
        raise ValueError("state_text must carry the [OBSERVED ELEMENTS] block")
    if not isinstance(record["questions"], list) or not record["questions"]:
        raise ValueError("questions must be a non-empty list")
    option_names = set()
    for question in record["questions"]:
        if not isinstance(question, dict) or "name" not in question or "options" not in question:
            raise ValueError(f"malformed question entry: {question!r}")
        if not question["options"]:
            raise ValueError(f"question {question['name']!r} has no options")
        option_names.add(question["name"])
    for name, answer in record["gold"].items():
        if name not in option_names:
            raise ValueError(f"gold answers unknown question {name!r}")
        options = next(q["options"] for q in record["questions"] if q["name"] == name)
        if answer not in options and answer != ABSTAIN_OPTION:
            raise ValueError(
                f"gold answer {answer!r} for {name!r} is not an option and not abstain"
            )


def write_traces(traces: Sequence[Dict[str, Any]], path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in traces:
            validate_trace(record)
            handle.write(json.dumps(record) + "\n")


def load_traces(path: Path) -> List[Dict[str, Any]]:
    traces = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            try:
                validate_trace(record)
            except ValueError as exc:
                raise ValueError(f"{path}:{line_number}: {exc}") from exc
            traces.append(record)
    return traces


def split_counts(traces: Sequence[Dict[str, Any]]) -> Dict[str, int]:
    counts: Dict[str, int] = {split: 0 for split in _SPLITS}
    for record in traces:
        counts[record["split"]] += 1
    return counts
