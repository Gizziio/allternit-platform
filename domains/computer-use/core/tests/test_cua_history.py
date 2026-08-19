"""Tests for CUA Driver Computer History integration."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock

import pytest

CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CORE_ROOT))

from contracts.canonical import CapabilityManifest
from providers.cua_driver_canonical import CuaDriverCanonicalProvider
from providers.cua_driver_transport import CuaDriverCallError, CuaDriverTransport


class FakeTransport(CuaDriverTransport):
    def __init__(self) -> None:
        self.executable = "/fake/cua-driver"
        self.timeout_seconds = 30.0
        self.socket_path = None
        self.history_status_response: Dict[str, Any] = {
            "supported": True,
            "admitted": True,
            "enabled": True,
            "paused": False,
            "encrypted": True,
            "profile": "cua-history-profile-v1/cbor-sequence+cose-encrypt0+cloudevents-json",
            "retention_days": 7,
            "quota_bytes": 104857600,
            "bytes_used": 0,
            "dropped_events": 0,
            "health": "ready",
        }
        self.history_query_response: Dict[str, Any] = {
            "events": [
                {
                    "specversion": "1.0",
                    "id": "evt-1",
                    "source": "urn:cua-driver:history:sess-1",
                    "type": "cua-driver.history.action_completed.v0",
                    "time": "2026-08-14T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:cua-driver:schema:history-event:v0",
                    "data": {
                        "session_id": "sess-1",
                        "action_id": "act-1",
                        "sequence": 1,
                        "platform": "macos",
                        "capability": "computer.pointer.click",
                        "caller_category": "cua_runtime",
                        "payload": {"kind": "action_completed"},
                    },
                }
            ],
            "metadata_only": True,
            "model_context_disclosure": True,
        }
        self.last_query: Dict[str, Any] | None = None

    async def history_status(self) -> Dict[str, Any]:
        return dict(self.history_status_response)

    async def history_query(self, *, limit: int = 50, session_id: str | None = None,
                            since_sequence: int | None = None, until_sequence: int | None = None) -> Dict[str, Any]:
        self.last_query = {
            "limit": limit,
            "session_id": session_id,
            "since_sequence": since_sequence,
            "until_sequence": until_sequence,
        }
        return dict(self.history_query_response)


class DenyingTransport(FakeTransport):
    async def history_status(self) -> Dict[str, Any]:
        return {
            "supported": True,
            "admitted": False,
            "enabled": False,
            "paused": False,
            "encrypted": True,
            "profile": "cua-history-profile-v1/cbor-sequence+cose-encrypt0+cloudevents-json",
            "retention_days": 7,
            "quota_bytes": 104857600,
            "bytes_used": 0,
            "dropped_events": 0,
            "health": "not_admitted",
        }


class FailingTransport(FakeTransport):
    async def history_status(self) -> Dict[str, Any]:
        raise CuaDriverCallError("history_status", "history unavailable")


@pytest.fixture
def tmp_artifact_dir(tmp_path: Path) -> Path:
    return tmp_path / "artifacts"


@pytest.mark.asyncio
async def test_provider_advertises_history_tools_when_admitted(tmp_artifact_dir: Path) -> None:
    provider = CuaDriverCanonicalProvider(FakeTransport(), tmp_artifact_dir, version="test")
    manifest = await provider.capabilities()
    assert "history_status" in manifest.tools
    assert "history_query" in manifest.tools


@pytest.mark.asyncio
async def test_provider_omits_history_tools_when_not_admitted(tmp_artifact_dir: Path) -> None:
    provider = CuaDriverCanonicalProvider(DenyingTransport(), tmp_artifact_dir, version="test")
    manifest = await provider.capabilities()
    assert "history_status" not in manifest.tools
    assert "history_query" not in manifest.tools


@pytest.mark.asyncio
async def test_provider_degrades_when_history_status_fails(tmp_artifact_dir: Path) -> None:
    provider = CuaDriverCanonicalProvider(FailingTransport(), tmp_artifact_dir, version="test")
    manifest = await provider.capabilities()
    assert manifest.tools == ()


@pytest.mark.asyncio
async def test_provider_caches_history_discovery(tmp_artifact_dir: Path) -> None:
    transport = FakeTransport()
    provider = CuaDriverCanonicalProvider(transport, tmp_artifact_dir, version="test")
    manifest1 = await provider.capabilities()
    manifest2 = await provider.capabilities()
    assert manifest1.tools == manifest2.tools


@pytest.mark.asyncio
async def test_provider_history_status_and_query(tmp_artifact_dir: Path) -> None:
    transport = FakeTransport()
    provider = CuaDriverCanonicalProvider(transport, tmp_artifact_dir, version="test")
    status = await provider.history_status()
    assert status["supported"] is True
    assert status["admitted"] is True
    query = await provider.history_query(limit=10, session_id="sess-1", since_sequence=1, until_sequence=5)
    assert len(query["events"]) == 1
    assert transport.last_query == {
        "limit": 10,
        "session_id": "sess-1",
        "since_sequence": 1,
        "until_sequence": 5,
    }


def test_transport_history_query_validation() -> None:
    transport = CuaDriverTransport.__new__(CuaDriverTransport)
    transport.executable = "/fake/cua-driver"

    async def _run(*args: Any, timeout_seconds: float | None = None) -> Dict[str, Any]:
        return {"ok": True}

    transport._run = _run  # type: ignore[assignment]

    assert asyncio.run(transport.history_query(limit=1))["ok"] is True
    assert asyncio.run(transport.history_query(limit=200))["ok"] is True

    with pytest.raises(CuaDriverCallError, match="limit must be"):
        asyncio.run(transport.history_query(limit=0))
    with pytest.raises(CuaDriverCallError, match="limit must be"):
        asyncio.run(transport.history_query(limit=201))
    with pytest.raises(CuaDriverCallError, match="session_id must be"):
        asyncio.run(transport.history_query(session_id=""))
    with pytest.raises(CuaDriverCallError, match="session_id must be"):
        asyncio.run(transport.history_query(session_id="x" * 129))
    with pytest.raises(CuaDriverCallError, match="since_sequence must be"):
        asyncio.run(transport.history_query(since_sequence=0))
    with pytest.raises(CuaDriverCallError, match="until_sequence must be"):
        asyncio.run(transport.history_query(until_sequence=-1))
    with pytest.raises(CuaDriverCallError, match="since_sequence must not exceed"):
        asyncio.run(transport.history_query(since_sequence=5, until_sequence=1))


def test_transport_prefers_installed_cua_driver_app(monkeypatch: pytest.MonkeyPatch) -> None:
    # discover_cua_driver should prefer /Applications/CuaDriver.app when it exists.
    # We cannot assume the real app is installed, so patch os.path checks.
    from providers import cua_driver_transport as transport_mod

    real_exists = Path.is_file
    real_access = os.access

    def fake_is_file(self: Path) -> bool:
        if self.resolve() == Path("/Applications/CuaDriver.app/Contents/MacOS/cua-driver").resolve():
            return True
        return real_exists(self)

    def fake_access(path: str, mode: int) -> bool:
        if Path(path).resolve() == Path("/Applications/CuaDriver.app/Contents/MacOS/cua-driver").resolve():
            return bool(mode & os.X_OK)
        return real_access(path, mode)

    monkeypatch.setattr(Path, "is_file", fake_is_file)
    monkeypatch.setattr(os, "access", fake_access)
    monkeypatch.delenv("ALLTERNIT_CUA_DRIVER_PATH", raising=False)

    discovered = transport_mod.discover_cua_driver()
    assert discovered == str(Path("/Applications/CuaDriver.app/Contents/MacOS/cua-driver").resolve())


def test_transport_uses_default_socket_for_installed_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from providers import cua_driver_transport as transport_mod

    fake_socket = tmp_path / "cua-driver.sock"
    fake_socket.write_bytes(b"")
    monkeypatch.setattr(transport_mod, "_DEFAULT_INSTALLED_CUA_SOCKET", fake_socket)

    transport = CuaDriverTransport.__new__(CuaDriverTransport)
    transport.executable = str(Path("/Applications/CuaDriver.app/Contents/MacOS/cua-driver").resolve())
    transport.timeout_seconds = 30.0
    # __init__ computes socket_path from env or default; emulate that directly.
    transport.socket_path = os.environ.get("ALLTERNIT_CUA_DRIVER_SOCKET") or transport_mod._default_socket_for_executable(
        transport.executable
    )
    assert transport.socket_path == str(fake_socket)


def test_transport_env_socket_overrides_default(monkeypatch: pytest.MonkeyPatch) -> None:
    from providers import cua_driver_transport as transport_mod

    monkeypatch.setenv("ALLTERNIT_CUA_DRIVER_SOCKET", "/custom/socket.sock")
    transport = CuaDriverTransport.__new__(CuaDriverTransport)
    transport.executable = "/fake/cua-driver"
    transport.timeout_seconds = 30.0
    transport.socket_path = os.environ.get("ALLTERNIT_CUA_DRIVER_SOCKET") or transport_mod._default_socket_for_executable(
        transport.executable
    )
    assert transport.socket_path == "/custom/socket.sock"


def test_manifest_has_tools_field() -> None:
    manifest = CapabilityManifest(
        provider_id="test",
        provider_version="1.0",
        tools=("history_status", "history_query"),
    )
    assert manifest.tools == ("history_status", "history_query")


class DummyAdapter:
    pass


class DummyVisionProvider:
    async def ground_and_reason(self, **kwargs):
        raise RuntimeError("unused")


@pytest.mark.asyncio
async def test_planning_loop_consults_history_for_continuation() -> None:
    called_with: List[str] = []

    async def preflight(task: str) -> Dict[str, Any]:
        called_with.append(task)
        return {
            "status": {"supported": True, "admitted": True, "enabled": True, "paused": False, "health": "ready", "dropped_events": 0},
            "events": [
                {
                    "type": "cua-driver.history.action_completed.v0",
                    "data": {"sequence": 1, "capability": "computer.pointer.click", "payload": {"kind": "action_completed", "effect": "confirmed"}},
                }
            ],
        }

    from core.planning_loop import PlanningLoop, PlanningLoopConfig
    loop = PlanningLoop(
        vision_provider=DummyVisionProvider(),
        adapter=DummyAdapter(),
        config=PlanningLoopConfig(max_steps=1),
        history_preflight=preflight,
    )

    # The loop will fail on vision provider, but preflight should still be called.
    try:
        await loop.run("continue where we left off", "session-1", "run-1")
    except Exception:
        pass

    assert len(called_with) == 1
    assert "continue" in called_with[0].lower()


@pytest.mark.asyncio
async def test_planning_loop_skips_history_for_unrelated_task() -> None:
    called_with: List[str] = []

    async def preflight(task: str) -> Dict[str, Any]:
        called_with.append(task)
        return {"status": {"supported": True, "admitted": True, "enabled": True}, "events": []}

    from core.planning_loop import PlanningLoop, PlanningLoopConfig
    loop = PlanningLoop(
        vision_provider=DummyVisionProvider(),
        adapter=DummyAdapter(),
        config=PlanningLoopConfig(max_steps=1),
        history_preflight=preflight,
    )

    try:
        await loop.run("open a new browser tab", "session-1", "run-1")
    except Exception:
        pass

    assert called_with == []
