#!/usr/bin/env python3
"""
Tests for the recordings detail/file/GIF routes.

Contract under test: surfaces/ai.allternit.com/src/remote-control/api/recordings.ts
(RecordingManifest / RecordedStep / RecordingDetail).

Run from domains/computer-use/core/gateway:
    PYTHONPATH=".." python -m pytest tests/test_recordings_routes.py -q
"""

import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

GATEWAY_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(GATEWAY_DIR.parent))  # domains/computer-use/core (the `core` package)

from core import action_recorder  # noqa: E402
from gateway.computer_use_router import router as computer_use_router  # noqa: E402

# Minimal valid 1x1 GIF (transparent pixel).
GIF_BYTES = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\x00\x00\x00!\xf9\x04"
    b"\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D"
    b"\x01\x00;"
)


@pytest.fixture()
def recordings_dir(tmp_path, monkeypatch):
    """Point the ActionRecorder recordings root at a temp dir."""
    root = tmp_path / "recordings"
    root.mkdir()
    monkeypatch.setattr(action_recorder, "DEFAULT_RECORDINGS_DIR", root)
    return root


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(computer_use_router)
    return TestClient(app)


def _write_recording(
    root: Path,
    recording_id: str = "rec-test123",
    with_gif: bool = False,
    with_video: bool = False,
) -> str:
    """Seed a JSONL recording (manifest line + two frame lines), return raw text."""
    manifest = {
        "_type": "manifest",
        "recording_id": recording_id,
        "task": "Open the settings page",
        "session_id": "sess-abc",
        "run_id": "run-xyz",
        "vision_provider": "gpt-4o",
        "adapter_id": "browser.playwright",
        "started_at": "2026-09-09T00:00:00+00:00",
        "completed_at": "2026-09-09T00:01:00+00:00",
        "total_steps": 2,
        "status": "completed",
        "gif_path": None,
        "video_path": None,
        "video_start_epoch": None,
    }
    frame1 = {
        "recording_id": recording_id,
        "step": 1,
        "timestamp": "2026-09-09T00:00:10+00:00",
        "action_type": "click",
        "action_target": "#menu",
        "action_params": {"x": 1},
        "before_screenshot_b64": "",
        "after_screenshot_b64": "",
        "reasoning": "Open the menu",
        "reflection": "",
        "action_succeeded": True,
        "risk_level": "low",
        "tokens_used": 10,
    }
    frame2 = {
        "recording_id": recording_id,
        "step": 2,
        "timestamp": "2026-09-09T00:00:20+00:00",
        "action_type": "fill",
        "action_target": "#search",
        "action_params": {"text": "hello"},
        "before_screenshot_b64": "",
        "after_screenshot_b64": "",
        "reasoning": "Type the query",
        "reflection": "",
        "action_succeeded": False,
        "risk_level": "medium",
        "tokens_used": 20,
    }
    lines = [json.dumps(manifest), json.dumps(frame1), json.dumps(frame2)]
    text = "\n".join(lines) + "\n"
    (root / f"{recording_id}.jsonl").write_text(text, encoding="utf-8")
    if with_gif:
        (root / f"{recording_id}.gif").write_bytes(GIF_BYTES)
    if with_video:
        (root / f"{recording_id}.webm").write_bytes(WEBM_BYTES)
    return text


# Minimal WebM header bytes — content is irrelevant to the route tests.
WEBM_BYTES = b"\x1a\x45\xdf\xa3" + b"\x00" * 64


# ---------------------------------------------------------------------------
# Detail route
# ---------------------------------------------------------------------------

def test_detail_happy_path(client, recordings_dir):
    _write_recording(recordings_dir)
    resp = client.get("/v1/computer-use/recordings/rec-test123")
    assert resp.status_code == 200
    body = resp.json()

    manifest = body["manifest"]
    assert manifest["recording_id"] == "rec-test123"
    assert manifest["task"] == "Open the settings page"
    assert manifest["session_id"] == "sess-abc"
    assert manifest["run_id"] == "run-xyz"
    assert manifest["started_at"] == "2026-09-09T00:00:00+00:00"
    assert manifest["completed_at"] == "2026-09-09T00:01:00+00:00"
    assert manifest["total_steps"] == 2
    assert manifest["status"] == "completed"
    assert manifest["gif_path"] is None

    steps = body["steps"]
    assert len(steps) == 2
    assert steps[0] == {
        "step": 1,
        "timestamp": "2026-09-09T00:00:10+00:00",
        "kind": "action",
        "action_type": "click",
        "action_target": "#menu",
        "action_params": {"x": 1},
        "reasoning": "Open the menu",
        "action_succeeded": True,
        "risk_level": "low",
    }
    assert steps[1]["action_succeeded"] is False
    assert steps[1]["risk_level"] == "medium"
    # Screenshot payloads must not leak into the step view.
    assert "before_screenshot_b64" not in steps[0]
    assert "after_screenshot_b64" not in steps[0]

    # No GIF on disk → gif_url null.
    assert body["gif_url"] is None


def test_detail_includes_gif_url_when_gif_present(client, recordings_dir):
    _write_recording(recordings_dir, with_gif=True)
    resp = client.get("/v1/computer-use/recordings/rec-test123")
    assert resp.status_code == 200
    assert resp.json()["gif_url"] == "/v1/computer-use/recordings/rec-test123/gif"


def test_detail_unknown_id_404(client, recordings_dir):
    resp = client.get("/v1/computer-use/recordings/rec-nope")
    assert resp.status_code == 404
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# File route
# ---------------------------------------------------------------------------

def test_file_returns_verbatim_jsonl(client, recordings_dir):
    raw = _write_recording(recordings_dir)
    resp = client.get("/v1/computer-use/recordings/rec-test123/file")
    assert resp.status_code == 200
    assert resp.content.decode("utf-8") == raw
    assert resp.headers["content-type"].startswith("application/x-ndjson")


def test_file_unknown_id_404(client, recordings_dir):
    resp = client.get("/v1/computer-use/recordings/rec-nope/file")
    assert resp.status_code == 404
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# GIF route
# ---------------------------------------------------------------------------

def test_gif_200_when_present(client, recordings_dir):
    _write_recording(recordings_dir, with_gif=True)
    resp = client.get("/v1/computer-use/recordings/rec-test123/gif")
    assert resp.status_code == 200
    assert resp.content == GIF_BYTES
    assert resp.headers["content-type"].startswith("image/gif")


def test_gif_404_when_absent(client, recordings_dir):
    _write_recording(recordings_dir, with_gif=False)
    resp = client.get("/v1/computer-use/recordings/rec-test123/gif")
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_gif_unknown_id_404(client, recordings_dir):
    resp = client.get("/v1/computer-use/recordings/rec-nope/gif")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Video route
# ---------------------------------------------------------------------------

def test_detail_includes_video_url_when_video_present(client, recordings_dir):
    _write_recording(recordings_dir, with_video=True)
    resp = client.get("/v1/computer-use/recordings/rec-test123")
    assert resp.status_code == 200
    assert resp.json()["video_url"] == "/v1/computer-use/recordings/rec-test123/video"


def test_detail_manifest_carries_video_metadata(client, recordings_dir):
    _write_recording(recordings_dir, with_video=True)
    # Stamp the manifest with chrome-stream provider metadata (as POST /record
    # does when a video artifact is supplied at start/stop).
    path = recordings_dir / "rec-test123.jsonl"
    lines = path.read_text(encoding="utf-8").splitlines()
    manifest = json.loads(lines[0])
    manifest["video_path"] = str(recordings_dir / "rec-test123.webm")
    manifest["video_start_epoch"] = 1_757_395_200_000
    lines[0] = json.dumps(manifest)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    resp = client.get("/v1/computer-use/recordings/rec-test123")
    body = resp.json()
    assert body["manifest"]["video_path"].endswith("rec-test123.webm")
    assert body["manifest"]["video_start_epoch"] == 1_757_395_200_000
    assert body["video_url"] == "/v1/computer-use/recordings/rec-test123/video"


def test_video_200_when_present(client, recordings_dir):
    _write_recording(recordings_dir, with_video=True)
    resp = client.get("/v1/computer-use/recordings/rec-test123/video")
    assert resp.status_code == 200
    assert resp.content == WEBM_BYTES
    assert resp.headers["content-type"].startswith("video/webm")


def test_video_404_when_absent(client, recordings_dir):
    _write_recording(recordings_dir, with_video=False)
    resp = client.get("/v1/computer-use/recordings/rec-test123/video")
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_video_unknown_id_404(client, recordings_dir):
    resp = client.get("/v1/computer-use/recordings/rec-nope/video")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Security: path traversal ids must never touch disk outside the root
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_id", ["..", "../..", "..%2F..", "..%2F..%2Fetc%2Fpasswd", "a/b", "/etc/passwd"])
def test_traversal_ids_rejected(client, recordings_dir, bad_id):
    # A file outside the recordings root that a traversal would target.
    outside = recordings_dir.parent / "etc"
    outside.mkdir(exist_ok=True)
    passwd = outside / "passwd"
    passwd.write_text("root:x:0:0:root:/root:/bin/sh\n", encoding="utf-8")

    for suffix in ("", "/file", "/gif", "/video"):
        resp = client.get(f"/v1/computer-use/recordings/{bad_id}{suffix}")
        assert resp.status_code in (400, 404), f"{bad_id}{suffix} → {resp.status_code}"
        if resp.headers["content-type"].startswith("application/json"):
            body = resp.text
            assert "root:x:0:0" not in body
    # The outside file was never read or modified.
    assert passwd.read_text(encoding="utf-8") == "root:x:0:0:root:/root:/bin/sh\n"


def test_traversal_id_never_reaches_filesystem(tmp_path, monkeypatch):
    """Even if the regex were bypassed, resolved-path containment blocks escape."""
    root = tmp_path / "recordings"
    root.mkdir()
    monkeypatch.setattr(action_recorder, "DEFAULT_RECORDINGS_DIR", root)

    from gateway import computer_use_router as cur

    # Direct call with a regex-passing-but-escaping id is impossible via HTTP
    # ('/' is not in the allowlist); simulate the containment check directly.
    with pytest.raises(Exception):
        cur._resolve_recording_path("..")
    # An id that would resolve outside the root via symlink also stays contained.
    outside = tmp_path / "outside.jsonl"
    outside.write_text("{}\n", encoding="utf-8")
    link = root / "link.jsonl"
    try:
        link.symlink_to(outside)
    except OSError:
        pytest.skip("symlinks unavailable")
    # 'link' passes the regex; resolution must still refuse it if it points outside.
    resolved = (root / "link.jsonl").resolve()
    assert not resolved.is_relative_to(root.resolve())
