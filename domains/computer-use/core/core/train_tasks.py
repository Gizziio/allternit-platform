"""
Allternit Computer Use — TRAIN-split synthetic task templates (Laya volume lane)

New interaction-shape templates for minting labeled training decisions: every
task_id here is OUTSIDE ``core.kimi_fewshot.HELD_OUT_TASK_IDS``, so
``core/trace_recorder.py`` labels their traces ``split="train"`` and
``scripts/export_laya_finetune.py`` turns them into Laya fine-tune cases. The
three canonical held-out tasks (search-flow / form-fill / settings-toggle) are
verification data only and are NOT touched — benchmark stability.

Contract (mirrors core/shadow_eval.py exactly):
- turns repeat a scripted pattern to ``steps_per_task`` decide steps;
- every turn's target resolves via ``ElementTable.match_target`` against the
  step trees AND supports the turn's mapped whitelist operation
  (``_LLM_OP_MAP``: fill/type→fill, select→selectOptionFromDropdown,
  scroll→scrollTo, key→press, double_click→doubleClick);
- ``fail_targets`` are adapter-failed element names, giving the recorder's
  ``effect: suspected_noop`` variety and stuck-gate calibration labels;
- each template exercises >= 3 distinct whitelist ops; across the suite the
  mix mirrors the real op distribution (click plurality, substantial
  fill/select/scroll, plus press and doubleClick).

Seed parameterization: every factory derives names/values/orders from
``random.Random(f"{seed}:{task_id}")`` — per-seed deterministic, order
independent (no global RNG state), so new seeds multiply diversity without
new code.
"""

from __future__ import annotations

import copy
import random
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .shadow_eval import (
    DEFAULT_STEPS_PER_TASK,
    ScriptedTurn,
    SyntheticTask,
    _node,
)

__all__ = ["train_tasks", "TRAIN_TASK_IDS"]


def _rng(seed: int, task_id: str) -> random.Random:
    """Per-template seeded RNG — same seed → same task, regardless of the
    order templates are built in or any other template's draw count."""
    return random.Random(f"{seed}:{task_id}")


def _cycle(pattern: Sequence[ScriptedTurn], steps: int) -> List[ScriptedTurn]:
    """Repeat the scripted pattern to ``steps`` turns (canonical convention)."""
    return [copy.deepcopy(pattern[i % len(pattern)]) for i in range(steps)]


# ---------------------------------------------------------------------------
# Template factories (one per interaction shape)
# ---------------------------------------------------------------------------

def _checkout_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-checkout"
    rng = _rng(seed, task_id)
    store = rng.choice(["Northwind Trading", "Alder and Co", "Bluefjord Goods",
                        "Copperline Market", "Helios General"])
    currency = rng.choice(["USD", "EUR", "GBP", "JPY", "CAD"])
    shopper = rng.choice(["Mara Quinn", "Deniz Aksoy", "Tomas Riva",
                          "Ingrid Solberg", "Kwame Mensah"])
    street = rng.choice(["14 Harbor Lane", "220 Birchwood Ave", "9 Kiln Court",
                         "77 Meridian Road", "3 Alder Crescent"])
    city = rng.choice(["Portland", "Rotterdam", "Lisbon", "Osaka", "Halifax"])
    card = " ".join(str(rng.randrange(1000, 9999)) for _ in range(4))
    total = f"{rng.randrange(2, 40)}.{rng.randrange(10, 99):02d}"
    countries = ["United States", "Netherlands", "Portugal", "Japan", "Canada"]
    ship_to = rng.sample(countries, 3)

    pattern = [
        ScriptedTurn("fill", "Shipping full name", text=shopper),
        ScriptedTurn("fill", "Shipping street address", text=street),
        ScriptedTurn("fill", "Shipping city", text=city),
        ScriptedTurn("select", "Shipping country"),
        ScriptedTurn("fill", "Card number", text=card),
        ScriptedTurn("click", "Place order"),
    ]
    tree = _node("AXWindow", f"Checkout — {store}", [
        _node("AXTextField", "Shipping full name", interactive=True),
        _node("AXTextField", "Shipping street address", interactive=True),
        _node("AXTextField", "Shipping city", interactive=True),
        _node("AXPopUpButton", "Shipping country", interactive=True,
              value=ship_to[0]),
        _node("AXTextField", "Card number", interactive=True),
        _node("AXButton", "Place order", interactive=True),
        _node("AXLink", "Return to cart", interactive=True),
        _node("AXStaticText", f"Order total: {currency} {total}"),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"Complete the {store} checkout: enter the shipping address, "
             f"choose a shipping country, enter the card number, place the order",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Place order"],
    )


def _pagination_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-pagination"
    rng = _rng(seed, task_id)
    catalog = rng.choice(["Parts catalog", "Seed library", "Vinyl archive",
                          "Tool depot", "Stamp registry"])
    query = rng.choice(["brass fitting", "heirloom tomato", "live recording",
                        "torque wrench", "first edition"])
    item = rng.choice(["Catalog item listing", "Catalog entry card",
                       "Catalog result row"])
    last_page = rng.randrange(4, 12)

    pattern = [
        ScriptedTurn("fill", "Catalog search box", text=query),
        ScriptedTurn("click", "Run catalog search"),
        ScriptedTurn("scroll", "Catalog results list"),
        ScriptedTurn("click", "Next results page"),
        ScriptedTurn("click", item),
    ]
    tree = _node("AXWindow", catalog, [
        _node("AXTextField", "Catalog search box", interactive=True),
        _node("AXButton", "Run catalog search", interactive=True),
        _node("AXScrollArea", "Catalog results list", [
            _node("AXLink", item, interactive=True),
            _node("AXLink", f"{item} alternate", interactive=True),
        ], interactive=True),
        _node("AXButton", "Next results page", interactive=True),
        _node("AXButton", "Previous results page", interactive=True),
        _node("AXStaticText", f"Page 1 of {last_page}"),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"Search the {catalog.lower()} for '{query}', page through the "
             f"results, and open a result listing",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=[item],
    )


def _modal_dialog_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-modal-dialog"
    rng = _rng(seed, task_id)
    viewer = rng.choice(["Invoice viewer", "Refund portal", "Booking manager",
                         "Contract console"])
    note = rng.choice(["Approved by ops on Monday", "Customer asked for a copy",
                       "Hold until the 15th", "Matches the purchase order"])
    formats = ["PDF copy", "CSV extract", "Print layout"]
    initial_format = rng.choice(formats)

    pattern = [
        ScriptedTurn("click", "Open detail dialog"),
        ScriptedTurn("select", "Export format picker"),
        ScriptedTurn("type", "Detail note area", text=note),
        ScriptedTurn("click", "Confirm detail dialog"),
    ]
    tree = _node("AXWindow", viewer, [
        _node("AXButton", "Open detail dialog", interactive=True),
        _node("AXPopUpButton", "Export format picker", interactive=True,
              value=initial_format),
        _node("AXTextArea", "Detail note area", interactive=True),
        _node("AXButton", "Confirm detail dialog", interactive=True),
        _node("AXButton", "Cancel detail dialog", interactive=True),
        _node("AXLink", "Back to overview", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"In the {viewer.lower()}, open the detail dialog, pick an export "
             f"format, type a short note, and confirm",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Confirm detail dialog"],
    )


def _combobox_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-combobox-booking"
    rng = _rng(seed, task_id)
    site = rng.choice(["Ferry booking", "Rail pass desk", "Shuttle scheduler",
                       "Bike share hub"])
    departure = rng.choice(["Harborfront", "Old Mill District", "Northgate",
                            "Riverbend"])
    arrival = rng.choice(["Lighthouse Point", "University Quarter",
                          "Meadowbrook", "Cannery Row"])
    day = f"{rng.randrange(1, 29)}"
    month = rng.choice(["March", "April", "May", "June"])
    cabin = rng.choice(["Standard seat", "Window seat", "Quiet car"])

    pattern = [
        ScriptedTurn("fill", "Departure city combo", text=departure),
        ScriptedTurn("select", "Arrival city combo"),
        ScriptedTurn("fill", "Travel date field", text=f"{month} {day}"),
        ScriptedTurn("click", "Find departures button"),
    ]
    tree = _node("AXWindow", site, [
        _node("AXComboBox", "Departure city combo", interactive=True,
              value=departure),
        _node("AXComboBox", "Arrival city combo", interactive=True,
              value=arrival),
        _node("AXTextField", "Travel date field", interactive=True),
        _node("AXButton", "Find departures button", interactive=True),
        _node("AXPopUpButton", "Cabin class picker", interactive=True,
              value=cabin),
        _node("AXLink", "Fare conditions", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"Book on {site.lower()}: fill the departure and arrival combos, "
             f"set the travel date, find departures",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Find departures button"],
    )


def _survey_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-checkbox-radio"
    rng = _rng(seed, task_id)
    survey = rng.choice(["Delivery survey", "Onboarding survey",
                         "Event feedback form", "Product panel signup"])
    respondent = rng.choice(["ops-lead@example.org", "field-tech@example.org",
                             "cs-associate@example.org"])
    language = rng.choice(["English", "Spanish", "German", "Japanese"])
    speed = rng.choice(["Delivery speed standard", "Delivery speed express"])

    pattern = [
        ScriptedTurn("fill", "Respondent email field", text=respondent),
        ScriptedTurn("select", "Survey language picker"),
        ScriptedTurn("click", "Newsletter opt-in checkbox"),
        ScriptedTurn("click", speed),
        ScriptedTurn("click", "Send survey responses"),
    ]
    tree = _node("AXWindow", survey, [
        _node("AXTextField", "Respondent email field", interactive=True),
        _node("AXPopUpButton", "Survey language picker", interactive=True,
              value=language),
        _node("AXCheckBox", "Newsletter opt-in checkbox", interactive=True),
        _node("AXCheckBox", "Terms acceptance checkbox", interactive=True),
        _node("AXRadioButton", "Delivery speed standard", interactive=True),
        _node("AXRadioButton", "Delivery speed express", interactive=True),
        _node("AXButton", "Send survey responses", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"Fill the {survey.lower()}: respondent email, language, the "
             f"newsletter opt-in, a delivery speed, then send",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Send survey responses"],
    )


def _slider_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-slider-adjust"
    rng = _rng(seed, task_id)
    mixer = rng.choice(["Audio mixer", "Lighting board", "Climate panel",
                        "Camera rig console"])
    preset = rng.choice(["Evening set", "Focus block", "Late night",
                         "Presentation"])
    low = rng.choice(["Master volume slider", "Ambient level slider"])
    high = rng.choice(["Bass level slider", "Brightness slider",
                       "Fan speed slider"])

    pattern = [
        ScriptedTurn("key", low),
        ScriptedTurn("key", high),
        ScriptedTurn("fill", "Preset name field", text=preset),
        ScriptedTurn("click", "Save mixer preset"),
    ]
    tree = _node("AXWindow", mixer, [
        _node("AXSlider", low, interactive=True,
              value=str(rng.randrange(10, 40))),
        _node("AXSlider", high, interactive=True,
              value=str(rng.randrange(40, 90))),
        _node("AXSlider", "Aux gain slider", interactive=True,
              value=str(rng.randrange(20, 70))),
        _node("AXTextField", "Preset name field", interactive=True),
        _node("AXButton", "Save mixer preset", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"On the {mixer.lower()}, nudge two sliders with the keyboard, "
             f"name the preset, and save it",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Save mixer preset"],
    )


def _filter_chips_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-filter-chips"
    rng = _rng(seed, task_id)
    site = rng.choice(["Recipe discovery", "Trail finder", "Museum events",
                       "Secondhand listings"])
    keyword = rng.choice(["mushroom", "waterfront", "modernist", "vintage"])
    chip_a, chip_b = rng.sample(
        ["Under 30 minutes chip", "Vegetarian chip", "Family friendly chip",
         "Budget pick chip", "Staff favorite chip"], 2)
    result = rng.choice(["Recipe result card", "Trail result card",
                         "Event result card", "Listing result card"])

    pattern = [
        ScriptedTurn("fill", "Keyword search field", text=keyword),
        ScriptedTurn("click", chip_a),
        ScriptedTurn("click", chip_b),
        ScriptedTurn("scroll", "Results feed pane"),
        ScriptedTurn("click", result),
    ]
    tree = _node("AXWindow", site, [
        _node("AXTextField", "Keyword search field", interactive=True),
        _node("AXButton", chip_a, interactive=True),
        _node("AXButton", chip_b, interactive=True),
        _node("AXButton", "Reset all filters", interactive=True),
        _node("AXScrollArea", "Results feed pane", [
            _node("AXLink", result, interactive=True),
            _node("AXLink", f"{result} sponsored", interactive=True),
        ], interactive=True),
        _node("AXButton", "Apply filters bar", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"On {site.lower()}, search '{keyword}', apply two filter chips, "
             f"scroll the results, and open a result card",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=[result],
    )


def _registration_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-registration-form"
    rng = _rng(seed, task_id)
    community = rng.choice(["Community signup", "Guild registration",
                            "Club member enrollment", "Co-op onboarding"])
    given = rng.choice(["Priya", "Jonas", "Aiko", "Rafael", "Nadia"])
    family = rng.choice(["Okafor", "Lindqvist", "Tanaka", "Mendes", "Haddad"])
    handle = f"{given.lower()}.{family.lower()}{rng.randrange(10, 99)}"
    bio = rng.choice([
        "Weekend potter, weekday accountant.",
        "Keeps bees on a fourth-floor balcony.",
        "Maps old railway lines for fun.",
        "Restores tube radios found at flea markets.",
    ])
    level = rng.choice(["Beginner", "Intermediate", "Advanced"])

    pattern = [
        ScriptedTurn("fill", "Given name field", text=given),
        ScriptedTurn("fill", "Family name field", text=family),
        ScriptedTurn("fill", "Signup email address", text=f"{handle}@example.net"),
        ScriptedTurn("type", "Short bio textarea", text=bio),
        ScriptedTurn("select", "Experience level picker"),
        ScriptedTurn("click", "Create community account"),
    ]
    tree = _node("AXWindow", community, [
        _node("AXTextField", "Given name field", interactive=True),
        _node("AXTextField", "Family name field", interactive=True),
        _node("AXTextField", "Signup email address", interactive=True),
        _node("AXTextArea", "Short bio textarea", interactive=True),
        _node("AXPopUpButton", "Experience level picker", interactive=True,
              value=level),
        _node("AXButton", "Create community account", interactive=True),
        _node("AXLink", "Sign in instead", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"Register on the {community.lower()}: names, signup email, a "
             f"short bio, experience level, then create the account",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Create community account"],
    )


def _settings_tabs_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-settings-tabs"
    rng = _rng(seed, task_id)
    workspace = rng.choice(["Workspace preferences", "Studio preferences",
                            "Fleet console settings", "Kitchen display settings"])
    display_name = rng.choice(["Night crew", "Maple studio", "Unit 7",
                               "Front of house"])
    density = rng.choice(["Comfortable density", "Compact density"])

    pattern = [
        ScriptedTurn("fill", "Workspace display name", text=display_name),
        ScriptedTurn("click", "Privacy tab"),
        ScriptedTurn("click", "Appearance tab"),
        ScriptedTurn("select", "Density preference picker"),
        ScriptedTurn("click", "Share usage statistics"),
        ScriptedTurn("click", "Save preferences button"),
    ]
    tree = _node("AXWindow", workspace, [
        _node("AXTextField", "Workspace display name", interactive=True),
        _node("AXTab", "Privacy tab", interactive=True),
        _node("AXTab", "Appearance tab", interactive=True),
        _node("AXTab", "Notifications tab", interactive=True),
        _node("AXPopUpButton", "Density preference picker", interactive=True,
              value=density),
        _node("AXCheckBox", "Share usage statistics", interactive=True),
        _node("AXButton", "Save preferences button", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"In {workspace.lower()}, set the display name, visit the privacy "
             f"and appearance tabs, pick a density, enable usage statistics, save",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Save preferences button"],
    )


def _file_upload_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-file-upload"
    rng = _rng(seed, task_id)
    picker = rng.choice(["Attachment picker", "Evidence uploader",
                         "Asset import dialog", "Ticket file annex"])
    file_name = rng.choice(["quarterly-summary.pdf", "site-survey-notes.pdf",
                            "inventory-snapshot.csv", "onboarding-checklist.pdf"])
    caption = rng.choice(["Q3 board pack", "Field visit record",
                          "Year-end stocktake", "New hire checklist"])

    pattern = [
        ScriptedTurn("click", "Browse files button"),
        ScriptedTurn("scroll", "File list pane"),
        ScriptedTurn("double_click", "Open file preview button"),
        ScriptedTurn("fill", "Attachment caption field", text=caption),
        ScriptedTurn("click", "Attach selected file"),
    ]
    tree = _node("AXWindow", picker, [
        _node("AXButton", "Browse files button", interactive=True),
        _node("AXScrollArea", "File list pane", [
            _node("AXRow", "Target file row", interactive=True,
                  value=file_name),
            _node("AXRow", "Spare file row", interactive=True,
                  value="readme-notes.txt"),
        ], interactive=True),
        _node("AXTextField", "Attachment caption field", interactive=True),
        _node("AXButton", "Open file preview button", interactive=True),
        _node("AXButton", "Attach selected file", interactive=True),
        _node("AXButton", "Cancel attachment", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"In the {picker.lower()}, browse the file list, open "
             f"{file_name}, give it a caption, attach it",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Attach selected file"],
    )


def _accordion_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-accordion-faq"
    rng = _rng(seed, task_id)
    center = rng.choice(["Help center", "Policy library", "Resident handbook",
                         "Vendor wiki"])
    topic = rng.choice(["Billing cycle question", "Shipping window question",
                        "Refund timing question", "Warranty claim question"])
    phrase = rng.choice(["annual adjustment", "weekend delivery",
                         "prorated refund", "transferable warranty"])

    pattern = [
        ScriptedTurn("fill", "Help search phrase", text=phrase),
        ScriptedTurn("click", "Billing topic accordion"),
        ScriptedTurn("scroll", "Help topics list"),
        ScriptedTurn("click", topic),
    ]
    tree = _node("AXWindow", center, [
        _node("AXTextField", "Help search phrase", interactive=True),
        _node("AXButton", "Billing topic accordion", interactive=True),
        _node("AXButton", "Shipping topic accordion", interactive=True),
        _node("AXScrollArea", "Help topics list", [
            _node("AXButton", topic, interactive=True),
            _node("AXLink", "Contact support link", interactive=True),
        ], interactive=True),
        _node("AXStaticText", f"Browse: {center}"),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"In the {center.lower()}, search '{phrase}', expand the billing "
             f"accordion, scroll the topics, open the {topic.lower()}",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=[topic],
    )


def _toast_task(seed: int, steps: int) -> SyntheticTask:
    task_id = "train-toast-dismiss"
    rng = _rng(seed, task_id)
    dashboard = rng.choice(["Dashboard editor", "Report builder",
                            "Site layout editor", "Menu board designer"])
    title = rng.choice(["Q4 pipeline", "Weekly footfall", "Launch checklist",
                        "Stock alerts"])
    theme = rng.choice(["Slate theme", "Paper theme", "Ember theme"])

    pattern = [
        ScriptedTurn("fill", "Dashboard title field", text=title),
        ScriptedTurn("select", "Dashboard theme picker"),
        ScriptedTurn("click", "Dismiss autosave toast"),
        ScriptedTurn("click", "Show grid lines"),
        ScriptedTurn("click", "Publish dashboard"),
    ]
    tree = _node("AXWindow", dashboard, [
        _node("AXTextField", "Dashboard title field", interactive=True),
        _node("AXPopUpButton", "Dashboard theme picker", interactive=True,
              value=theme),
        _node("AXButton", "Dismiss autosave toast", interactive=True),
        _node("AXCheckBox", "Show grid lines", interactive=True),
        _node("AXButton", "Publish dashboard", interactive=True),
        _node("AXButton", "Preview dashboard", interactive=True),
    ])
    return SyntheticTask(
        task_id=task_id,
        task=f"In the {dashboard.lower()}, set the title and theme, dismiss "
             f"the autosave toast, enable grid lines, publish",
        tree=tree,
        turns=_cycle(pattern, steps),
        fail_targets=["Publish dashboard"],
    )


_TEMPLATE_FACTORIES = (
    _checkout_task,
    _pagination_task,
    _modal_dialog_task,
    _combobox_task,
    _survey_task,
    _slider_task,
    _filter_chips_task,
    _registration_task,
    _settings_tabs_task,
    _file_upload_task,
    _accordion_task,
    _toast_task,
)

#: Stable template ids (outside HELD_OUT_TASK_IDS — verified by tests).
TRAIN_TASK_IDS: Tuple[str, ...] = tuple(
    factory(42, 1).task_id for factory in _TEMPLATE_FACTORIES
)


def train_tasks(
    seed: int = 42,
    steps_per_task: int = DEFAULT_STEPS_PER_TASK,
) -> List[SyntheticTask]:
    """The TRAIN-split synthetic task suite: one seeded instance per template.

    ``seed`` reshuffles every derived name/value/order (deterministic per
    seed — a ``random.Random(f"{seed}:{task_id}")`` per template, no global
    state), so running the harness over multiple seeds multiplies training
    volume without new code.
    """
    return [factory(seed, steps_per_task) for factory in _TEMPLATE_FACTORIES]
