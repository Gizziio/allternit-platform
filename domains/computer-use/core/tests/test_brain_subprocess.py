"""CLI-brain subprocess provider tests — cu22 follow-ups F3 (configurable
timeout) and F4 (process-tree kill on timeout/cancellation).

The cu22 real-model campaign hit the old fixed 60 s brain-call timeout with
gpt-6-astra via the codex CLI, and CLI-brain timeouts orphaned the spawned
CLI's children (only the direct child was killed). These tests use `/bin/sh`
stubs — no real CLI or model needed.
"""

import asyncio
import os
import sys
import time
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

from core.vision_providers import (  # noqa: E402
    DEFAULT_BRAIN_TIMEOUT_S,
    SubprocessVisionProvider,
    VisionAPIError,
)


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class TestBrainTimeoutConfig:
    def test_default_is_sane_for_cli_brains(self):
        # 60 s was too tight for real CLI backends; the new default leaves
        # headroom while still bounding a hung call.
        assert DEFAULT_BRAIN_TIMEOUT_S >= 240.0
        provider = SubprocessVisionProvider(cmd="/bin/sh", args=["-c", "true"])
        assert provider._timeout_s == DEFAULT_BRAIN_TIMEOUT_S

    def test_env_var_overrides_default(self, monkeypatch):
        monkeypatch.setenv("ALLTERNIT_BRAIN_TIMEOUT_S", "5")
        provider = SubprocessVisionProvider(cmd="/bin/sh", args=["-c", "true"])
        assert provider._timeout_s == 5.0

    def test_constructor_wins_over_env(self, monkeypatch):
        monkeypatch.setenv("ALLTERNIT_BRAIN_TIMEOUT_S", "5")
        provider = SubprocessVisionProvider(cmd="/bin/sh", args=["-c", "true"],
                                            timeout_s=90.0)
        assert provider._timeout_s == 90.0

    @pytest.mark.asyncio
    async def test_timeout_fires_at_the_configured_value(self):
        provider = SubprocessVisionProvider(
            cmd="/bin/sh", args=["-c", "sleep 5"], timeout_s=0.4,
        )
        start = time.monotonic()
        with pytest.raises(VisionAPIError, match="timed out"):
            await provider.ground_and_reason("aGk=", "task")
        elapsed = time.monotonic() - start
        # Fired at the configured cap, not the old hardcoded 60 s.
        assert elapsed < 3.0

    @pytest.mark.asyncio
    async def test_slow_but_under_limit_call_succeeds(self):
        provider = SubprocessVisionProvider(
            cmd="/bin/sh",
            args=["-c", "sleep 0.3; echo '{\"done\": true}'"],
            timeout_s=30.0,
        )
        plan = await provider.ground_and_reason("aGk=", "task")
        assert plan is not None
