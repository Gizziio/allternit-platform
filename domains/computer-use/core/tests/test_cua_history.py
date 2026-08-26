"""Tests for CUA Driver Computer History integration."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

COMPUTER_USE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(COMPUTER_USE_ROOT))

from providers.cua_driver_transport import CuaDriverTransport
from providers.cua_driver_canonical import CuaDriverCanonicalProvider


@pytest.fixture
def transport(tmp_path: Path) -> CuaDriverTransport:
    """Create a transport backed by a dummy executable file."""
    executable = tmp_path / "cua-driver"
    executable.write_text("#!/bin/sh\necho '{}'")
    executable.chmod(0o755)
    return CuaDriverTransport(str(executable))


def _run(coro):
    """Run an async coroutine in a synchronous test."""
    return asyncio.run(coro)


class TestCuaDriverTransportHistory:
    def test_history_status_delegates_to_call(self, transport: CuaDriverTransport) -> None:
        transport.call = AsyncMock(return_value={"supported": True, "admitted": True})  # type: ignore[method-assign]
        result = _run(transport.history_status())
        transport.call.assert_awaited_once_with("history_status", {})
        assert result["supported"] is True

    def test_history_query_forwards_bounded_args(self, transport: CuaDriverTransport) -> None:
        transport.call = AsyncMock(return_value={"events": []})  # type: ignore[method-assign]
        result = _run(
            transport.history_query(
                limit=20,
                session_id="sess-123",
                since_sequence=10,
                until_sequence=50,
            )
        )
        transport.call.assert_awaited_once_with(
            "history_query",
            {
                "limit": 20,
                "session_id": "sess-123",
                "since_sequence": 10,
                "until_sequence": 50,
            },
        )
        assert result == {"events": []}

    def test_history_query_default_no_optional_args(self, transport: CuaDriverTransport) -> None:
        transport.call = AsyncMock(return_value={"events": []})  # type: ignore[method-assign]
        _run(transport.history_query())
        transport.call.assert_awaited_once_with("history_query", {})

    @pytest.mark.parametrize(
        "kwargs,expected_message",
        [
            ({"limit": 0}, "limit must be between 1 and 200"),
            ({"limit": 201}, "limit must be between 1 and 200"),
            ({"session_id": ""}, "session_id must be a string between 1 and 128 characters"),
            ({"since_sequence": 0}, "since_sequence must be an integer >= 1"),
            ({"until_sequence": -1}, "until_sequence must be an integer >= 1"),
            (
                {"since_sequence": 10, "until_sequence": 5},
                "since_sequence must not exceed until_sequence",
            ),
        ],
    )
    def test_history_query_rejects_invalid_input(self, transport: CuaDriverTransport, kwargs, expected_message) -> None:
        with pytest.raises(ValueError, match=expected_message):
            _run(transport.history_query(**kwargs))


class TestCuaDriverCanonicalProviderHistory:
    def test_capabilities_advertises_history_when_supported(self, tmp_path: Path) -> None:
        transport = AsyncMock(spec=CuaDriverTransport)
        transport.history_status = AsyncMock(
            return_value={"supported": True, "admitted": True, "enabled": True}
        )
        transport.manifest = AsyncMock(return_value={"version": "nightly"})
        provider = CuaDriverCanonicalProvider(transport, tmp_path, version="nightly")
        manifest = _run(provider.capabilities())
        assert "history_status" in manifest.tools
        assert "history_query" in manifest.tools

    def test_capabilities_omits_history_when_not_admitted(self, tmp_path: Path) -> None:
        transport = AsyncMock(spec=CuaDriverTransport)
        transport.history_status = AsyncMock(
            return_value={"supported": True, "admitted": False, "enabled": False}
        )
        transport.manifest = AsyncMock(return_value={"version": "nightly"})
        provider = CuaDriverCanonicalProvider(transport, tmp_path, version="nightly")
        manifest = _run(provider.capabilities())
        assert "history_status" not in manifest.tools
        assert "history_query" not in manifest.tools

    def test_capabilities_degrades_gracefully_on_history_error(self, tmp_path: Path) -> None:
        transport = AsyncMock(spec=CuaDriverTransport)
        from providers.cua_driver_transport import CuaDriverCallError
        transport.history_status = AsyncMock(
            side_effect=CuaDriverCallError("history_status", "preview not admitted")
        )
        transport.manifest = AsyncMock(return_value={"version": "nightly"})
        provider = CuaDriverCanonicalProvider(transport, tmp_path, version="nightly")
        manifest = _run(provider.capabilities())
        assert "history_status" not in manifest.tools
        assert "history_query" not in manifest.tools

    def test_history_status_delegates_to_transport(self, tmp_path: Path) -> None:
        transport = AsyncMock(spec=CuaDriverTransport)
        transport.history_status = AsyncMock(return_value={"enabled": True})
        provider = CuaDriverCanonicalProvider(transport, tmp_path, version="nightly")
        result = _run(provider.history_status())
        assert result["enabled"] is True
        transport.history_status.assert_awaited_once_with()

    def test_history_query_delegates_to_transport(self, tmp_path: Path) -> None:
        transport = AsyncMock(spec=CuaDriverTransport)
        transport.history_query = AsyncMock(return_value={"events": [{"sequence": 1}]})
        provider = CuaDriverCanonicalProvider(transport, tmp_path, version="nightly")
        result = _run(provider.history_query(limit=10))
        assert result["events"][0]["sequence"] == 1
        transport.history_query.assert_awaited_once_with(
            limit=10, session_id=None, since_sequence=None, until_sequence=None
        )
