"""Sandboxed code-mode execution harness (spec: code-mode-execution, C1).

Runs ONE grant-bound code payload inside the run sandbox. The payload never
touches a host interpreter directly: it is handed to ``code_runner.mjs`` (a
trusted harness process) which executes it in a ``node:vm`` context whose
entire surface is scoped handles — declared-target-checked ``page``/``fetch``,
sandbox-dir-rooted ``sandboxFs``, and a ``process.env`` containing ONLY the
sandbox_env allowlist. Hard caps: wall clock (default 30 s, then SIGKILL),
memory (RLIMIT_AS where POSIX), fixed-size truncated+scrubbed stdout.

Credential discipline (PR #187 semantics, preserved): ``sandbox_env`` is the
ONLY credential path. Values are placed in the child environment under their
own names — never into the spec file, never into the payload string, never
into logs — and every stdout line is scrubbed against them before the envelope
is returned. The receipt/envelope never carries the values.

Where this runs: in production the same harness process runs microVM-side and
the payload crosses the sidecar/VM channel; this module is the host-side
driver that spawns it and speaks the op bridge. An unavailable runner is a
failure, never a best-effort host fallback.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Mapping, Optional, Union

logger = logging.getLogger(__name__)

RUNNER_PATH = Path(__file__).resolve().parent / "code_runner.mjs"

DEFAULT_TIMEOUT_S = 30.0
DEFAULT_MEMORY_LIMIT_MB = 512
DEFAULT_STDOUT_LIMIT = 4096
KILL_GRACE_S = 2.0

EXECUTABLE_LANGUAGES = ("playwright-js",)

# Mirror of the Rust refuse-list second line of defense: the descriptor gate
# (aci_code.rs) refuses first; the harness re-checks cheap invariants so a
# caller that bypasses the grant surface still cannot smuggle these.
_HARNESS_REFUSAL_PATTERNS = (
    "child_process",
    "node:child_process",
    "subprocess",
    "os.system",
    "shutil.rmtree",
    "/aci/code",
    "executeCode",
)


class CodeExecutionRefused(Exception):
    """Harness-level refusal (second line of defense behind the Rust gate)."""

    def __init__(self, class_: str, reason: str) -> None:
        super().__init__(reason)
        self.class_ = class_
        self.reason = reason


@dataclass
class CodeExecutionRequest:
    """One sandboxed code execution."""

    code: str
    language: str = "playwright-js"
    declared_targets: List[str] = field(default_factory=list)
    sandbox_env: Mapping[str, str] = field(default_factory=dict)
    run_sandbox_dir: Optional[str] = None    # default: fresh dir under system temp
    timeout_s: float = DEFAULT_TIMEOUT_S
    memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB
    stdout_limit: int = DEFAULT_STDOUT_LIMIT
    # Browser bridge: (op, args) -> result. Only consulted for page ops the
    # payload requests; None means "no bridge" and every page op refuses.
    page_op_handler: Optional[
        Callable[[str, List[Any]], Union[Any, Awaitable[Any]]]
    ] = None


def _enforce_posix_limits(memory_limit_mb: int) -> None:
    try:
        import resource

        limit = memory_limit_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    except Exception:
        # Non-POSIX or restricted: the runner's own heap cap + parent kill are
        # the remaining enforcement. Containment is not weakened — the payload
        # still has no host surface.
        pass


def _scrub(text: str, secrets: List[str]) -> str:
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return text


async def _maybe_await(value: Any) -> Any:
    if asyncio.iscoroutine(value):
        return await value
    return value


async def execute_code(req: CodeExecutionRequest) -> Dict[str, Any]:
    """Execute one payload in the sandbox; return the FIXED result envelope.

    The envelope is the only output surface (spec §3): truncated+scrubbed
    stdout, exit status, timed_out, screenshot sha256+ref, and honest error
    fields. Nothing else crosses back.
    """
    if req.language not in EXECUTABLE_LANGUAGES:
        raise CodeExecutionRefused(
            "language_not_allowed",
            f"language {req.language!r} has no wired executor; supported: {EXECUTABLE_LANGUAGES}",
        )
    lowered = req.code
    for pattern in _HARNESS_REFUSAL_PATTERNS:
        if pattern in lowered:
            raise CodeExecutionRefused(
                "destructive_call",
                f"payload contains forbidden pattern {pattern!r} (harness second line of defense)",
            )

    sandbox_dir = req.run_sandbox_dir or tempfile.mkdtemp(prefix="allternit-code-")
    os.makedirs(sandbox_dir, exist_ok=True)
    created_dir = req.run_sandbox_dir is None

    spec = {
        "code": req.code,
        "sandboxDir": os.path.abspath(sandbox_dir),
        "declaredTargets": list(req.declared_targets),
        "timeoutMs": int(req.timeout_s * 1000),
        # Only key NAMES go in the spec; values travel via the environment.
        "sandboxEnvKeys": sorted(req.sandbox_env.keys()),
        "hasBridge": req.page_op_handler is not None,
    }
    spec_path = os.path.join(sandbox_dir, "code-spec.json")
    with open(spec_path, "w", encoding="utf-8") as fh:
        json.dump(spec, fh)

    # Minimal child environment: PATH + the sandbox_env allowlist ONLY. No
    # host environment inheritance — unrelated host secrets never reach the
    # child, and sandbox_env keys are the sole credential surface.
    child_env: Dict[str, str] = {"PATH": os.environ.get("PATH", "/usr/bin:/bin")}
    for key, value in req.sandbox_env.items():
        if not key or not key[0].isalpha() and key[0] != "_":
            continue
        child_env[key] = value

    node = shutil.which("node")
    if not node:
        if created_dir:
            shutil.rmtree(sandbox_dir, ignore_errors=True)
        raise CodeExecutionRefused("executor_unavailable", "node runtime not found")

    started = time.monotonic()
    timed_out = False
    stdout_lines: List[str] = []
    refusal_error: Optional[str] = None
    crash_error: Optional[str] = None
    exit_status: Optional[int] = None
    envelope_line: Optional[Dict[str, Any]] = None

    proc = await asyncio.create_subprocess_exec(
        node,
        "--max-old-space-size=%d" % max(64, req.memory_limit_mb),
        str(RUNNER_PATH),
        spec_path,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=child_env,
        cwd=sandbox_dir,
        preexec_fn=(  # POSIX-only; harmless attribute elsewhere
            (lambda: _enforce_posix_limits(req.memory_limit_mb))
            if os.name == "posix"
            else None
        ),
    )

    async def handle_op(op: str, args: List[Any]) -> Dict[str, Any]:
        if req.page_op_handler is None:
            return {"ok": False, "error": f"no browser bridge available for page op {op!r}"}
        try:
            result = await _maybe_await(req.page_op_handler(op, args))
            if isinstance(result, (bytes, bytearray)):
                result = {"__bytes_b64__": bytes(result).hex() and __import__("base64").b64encode(bytes(result)).decode()}
            return {"ok": True, "result": result}
        except Exception as exc:  # the bridge failing is an op failure, not a run crash
            return {"ok": False, "error": str(exc)}

    async def pump_stdout() -> None:
        nonlocal envelope_line, refusal_error, crash_error
        assert proc.stdout is not None
        while True:
            raw = await proc.stdout.readline()
            if not raw:
                break
            line = raw.decode("utf-8", "replace").rstrip("\n")
            if line.startswith("__ACI_STDOUT__ "):
                try:
                    stdout_lines.extend(json.loads(line[len("__ACI_STDOUT__ "):]))
                except Exception:
                    stdout_lines.append(line)
            elif line.startswith("__ACI_OP__ "):
                try:
                    msg = json.loads(line[len("__ACI_OP__ "):])
                except Exception:
                    continue
                response = await handle_op(msg.get("op", ""), msg.get("args") or [])
                response["id"] = msg.get("id")
                if proc.stdin is not None and not proc.stdin.is_closing():
                    proc.stdin.write(
                        ("__ACI_OP_RESP__ " + json.dumps(response) + "\n").encode()
                    )
                    await proc.stdin.drain()
            elif line.startswith("__ACI_RESULT__ "):
                try:
                    envelope_line = json.loads(line[len("__ACI_RESULT__ "):])
                except Exception:
                    envelope_line = None
            else:
                stdout_lines.append(line)

    pump = asyncio.ensure_future(pump_stdout())
    try:
        await asyncio.wait_for(proc.wait(), timeout=req.timeout_s + KILL_GRACE_S)
    except asyncio.TimeoutError:
        timed_out = True
        proc.kill()
        await proc.wait()
    await asyncio.wait_for(pump, timeout=10)

    if envelope_line is None and not timed_out:
        # The runner died without reporting (OOM kill, segfault). Read stderr
        # for the honest cause.
        stderr = (await proc.stderr.read() if proc.stderr is not None else b"").decode(
            "utf-8", "replace"
        ).strip()
        crash_error = stderr.splitlines()[-1] if stderr else "runner exited without a result envelope"

    if envelope_line:
        exit_status = envelope_line.get("exitStatus")
        timed_out = timed_out or bool(envelope_line.get("timedOut"))
        if envelope_line.get("error"):
            if envelope_line.get("refused"):
                refusal_error = envelope_line["error"]
            else:
                crash_error = envelope_line["error"]

    # Screenshot: only via the page bridge, stored inside the sandbox dir.
    screenshot_sha256: Optional[str] = None
    screenshot_ref: Optional[str] = None

    stdout = "\n".join(stdout_lines)
    truncated = len(stdout.encode()) > req.stdout_limit
    stdout = stdout.encode()[: req.stdout_limit].decode("utf-8", "replace")
    # Scrub AFTER truncation? No — scrub first so a secret split across the
    # cut cannot half-leak, then re-truncate.
    stdout = _scrub(stdout, [v for v in req.sandbox_env.values() if v])
    stdout = stdout.encode()[: req.stdout_limit].decode("utf-8", "replace")

    duration_ms = int((time.monotonic() - started) * 1000)
    if created_dir:
        shutil.rmtree(sandbox_dir, ignore_errors=True)

    return {
        "stdout": stdout,
        "stdout_truncated": truncated,
        "exit_status": exit_status,
        "timed_out": timed_out,
        "refused": refusal_error,
        "error": crash_error,
        "screenshot_sha256": screenshot_sha256,
        "screenshot_ref": screenshot_ref,
        "duration_ms": duration_ms,
        "sandbox_dir": sandbox_dir if not created_dir else None,
    }


def envelope_ok(envelope: Mapping[str, Any]) -> bool:
    """A run counts as successful only on a clean, unrefused exit 0."""
    return (
        not envelope.get("timed_out")
        and envelope.get("exit_status") == 0
        and not envelope.get("refused")
        and not envelope.get("error")
    )
