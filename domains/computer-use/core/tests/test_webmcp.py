"""
Allternit Computer Use — WebMCP adapter + tool_call recording tests

Covers:
  - adapter.manifest.json round-trips through routing/registry.py and
    routing/capability_matrix.py manifest discovery
  - blocked plugin actions refused at the site tool boundary
  - ActionRecorder writes and reads back a tool_call frame (with arg redaction)
  - old-format recordings without tool_call frames still load
"""

import asyncio
import json
import sys
from pathlib import Path

import pytest

# Import root is domains/computer-use/core (contains the inner core/,
# adapters/, plugins/, routing/ packages).
DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

# Pin the INNER core package (same dance as tests/conftest.py / test_replay.py).
_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from adapters.browser.webmcp import (  # noqa: E402
    SiteToolRegistry,
    WebMcpAdapter,
    WebMcpContext,
    load_default_site_tools,
    origin_matches,
)
from core.action_recorder import (  # noqa: E402
    ActionRecorder,
    RecordedFrame,
    ToolCallFrame,
    redact_tool_args,
)
from routing.capability_matrix import CapabilityMatrix  # noqa: E402
from routing.registry import AdapterRegistry  # noqa: E402


# ---------------------------------------------------------------------------
# Manifest discovery round-trip
# ---------------------------------------------------------------------------

def test_manifest_loads_through_adapter_registry():
    registry = AdapterRegistry()
    registry.load_manifests()
    manifest = registry.get_manifest("browser.webmcp")
    assert manifest is not None, "browser.webmcp manifest not discovered"
    assert manifest["family"] == "browser"
    assert manifest["production_status"] == "experimental"
    assert "execute" in manifest["modes_supported"]
    assert registry.supports("browser.webmcp", "multi_tab") is True
    assert registry.get_guarantee_grade("browser.webmcp", "policy") == "A"
    browser_adapters = registry.list_adapters(family="browser")
    assert any(m["adapter_id"] == "browser.webmcp" for m in browser_adapters)


def test_manifest_loads_through_capability_matrix():
    matrix = CapabilityMatrix()
    matrix.load()
    candidate = matrix.get("browser.webmcp")
    assert candidate is not None, "browser.webmcp not in capability matrix"
    assert candidate.family == "browser"
    assert candidate.supports_mode("inspect") is True
    # Experimental adapters are excluded from automatic routing candidates.
    execute_candidates = [c.adapter_id for c in matrix.candidates_for("browser", "execute")]
    assert "browser.webmcp" not in execute_candidates
    execute_all = [c.adapter_id for c in matrix.candidates_for("browser", "execute", allow_experimental=True)]
    assert "browser.webmcp" in execute_all


# ---------------------------------------------------------------------------
# Site tool registry — plugin policy enforcement
# ---------------------------------------------------------------------------

def _registry() -> SiteToolRegistry:
    registry = SiteToolRegistry()
    registry.register_all(load_default_site_tools())
    return registry


def test_site_tools_derived_from_plugin_manifests():
    registry = _registry()
    names = [d.name for d in registry.descriptors()]
    assert "gmail.read_inbox" in names
    assert "github.review_pr" in names
    assert "github.triage_issue" in names
    assert "notion.create_page" in names
    gmail = registry.get("gmail.read_inbox")
    assert "mail.google.com" in gmail.allowed_domains
    assert "delete_all_emails" in gmail.blocked_actions


def test_blocked_action_refused_at_tool_boundary():
    registry = _registry()
    result = asyncio.run(registry.invoke(
        "gmail.read_inbox",
        {"requestedAction": "delete_all_emails"},
        ctx=WebMcpContext(dry_run=True),
    ))
    assert result.refused is True
    assert result.ok is False
    assert "blocked" in (result.reason or "")


def test_unknown_action_refused_by_handler():
    registry = _registry()
    result = asyncio.run(registry.invoke(
        "gmail.read_inbox",
        {"requestedAction": "send_email"},
        ctx=WebMcpContext(dry_run=True),
    ))
    assert result.ok is False


def test_dry_run_returns_plan_without_page():
    registry = _registry()
    result = asyncio.run(registry.invoke(
        "github.triage_issue",
        {"issueUrl": "https://github.com/o/r/issues/1", "comment": "triaged", "label": "bug"},
        ctx=WebMcpContext(dry_run=True),
    ))
    assert result.ok is True
    assert any("label" in step for step in result.data["steps"])


def test_origin_matching_respects_wildcards():
    assert origin_matches("https://github.com", ["github.com", "*.github.com"])
    assert origin_matches("https://api.github.com", ["github.com", "*.github.com"])
    assert origin_matches("https://mail.google.com", ["mail.google.com"])
    assert not origin_matches("https://evil.github.com.evil.com", ["*.github.com"])
    assert not origin_matches(None, ["github.com"])


def test_adapter_instantiates_with_registry():
    pytest.importorskip("playwright", reason="playwright not installed in this environment")
    adapter = WebMcpAdapter()
    descriptors = adapter.list_tools()
    assert len(descriptors) == 4
    tools = adapter.tools_for_origin("https://github.com")
    assert {t.descriptor.name for t in tools} == {"github.review_pr", "github.triage_issue"}


# ---------------------------------------------------------------------------
# action_recorder — tool_call frames + backward compat
# ---------------------------------------------------------------------------

def test_tool_call_frame_round_trip(tmp_path: Path):
    async def run():
        recorder = ActionRecorder(
            recording_id="rec-webmcp-test",
            task="read inbox",
            session_id="s1",
            run_id="r1",
            output_dir=tmp_path,
        )
        await recorder.start()
        await recorder.record_tool_call(
            tool_name="gmail.read_inbox",
            args={"maxMessages": 5, "api_key": "hunter2"},
            result_summary="Read 3 unread message(s) from the Gmail inbox",
            latency_ms=1200,
        )
        await recorder.record_tool_call(
            tool_name="github.triage_issue",
            args={"issueUrl": "https://github.com/o/r/issues/1"},
            result_summary=None,
            latency_ms=None,
            error="no page attached",
        )
        await recorder.stop()
        return recorder.get_path()

    path = asyncio.run(run())
    manifest, frames = ActionRecorder.load(path)
    tool_frames = [f for f in frames if isinstance(f, ToolCallFrame)]
    assert len(tool_frames) == 2
    first = tool_frames[0]
    assert first.tool_name == "gmail.read_inbox"
    assert first.args["maxMessages"] == 5
    assert first.args["api_key"] == "[REDACTED]"
    assert first.redacted is True
    assert first.latency_ms == 1200
    assert first.result_summary.startswith("Read 3")
    second = tool_frames[1]
    assert second.error == "no page attached"
    assert second.redacted is False

    # On-disk shape: tool_call lines carry _type, redacted args, timestamp.
    lines = [json.loads(l) for l in path.read_text().splitlines()[1:]]
    assert lines[0]["_type"] == "tool_call"
    assert "timestamp" in lines[0]
    assert lines[0]["args"]["api_key"] == "[REDACTED]"


def test_old_format_recording_still_loads(tmp_path: Path):
    """A pre-tool_call recording (no _type field) must load unchanged."""
    path = tmp_path / "rec-old.jsonl"
    manifest_line = {
        "_type": "manifest",
        "recording_id": "rec-old",
        "task": "old task",
        "session_id": "s",
        "run_id": "r",
        "vision_provider": "",
        "adapter_id": "browser.playwright",
        "started_at": "2026-01-01T00:00:00+00:00",
        "completed_at": "2026-01-01T00:01:00+00:00",
        "total_steps": 1,
        "status": "completed",
        "gif_path": None,
    }
    frame_line = {
        "recording_id": "rec-old",
        "step": 1,
        "timestamp": "2026-01-01T00:00:30+00:00",
        "action_type": "click",
        "action_target": "button.submit",
        "action_params": {"x": 10, "y": 20},
        "before_screenshot_b64": "",
        "after_screenshot_b64": "",
        "reasoning": "",
        "reflection": "",
        "action_succeeded": True,
        "risk_level": "low",
        "tokens_used": 0,
    }
    path.write_text(json.dumps(manifest_line) + "\n" + json.dumps(frame_line) + "\n")
    manifest, frames = ActionRecorder.load(path)
    assert manifest.recording_id == "rec-old"
    assert len(frames) == 1
    frame = frames[0]
    assert isinstance(frame, RecordedFrame)
    assert not isinstance(frame, ToolCallFrame)
    assert frame.action_type == "click"
    assert frame.action_target == "button.submit"


def test_redact_tool_args_policy():
    redacted, changed = redact_tool_args({"token": "abc", "nested": {"password": "x"}, "ok": 1})
    assert changed is True
    assert redacted["token"] == "[REDACTED]"
    assert redacted["nested"]["password"] == "[REDACTED]"
    assert redacted["ok"] == 1
    _, changed = redact_tool_args({"ok": 1})
    assert changed is False
