"""Unittest suite for allternit_computers (urllib mocked at the boundary)."""

from __future__ import annotations

import io
import json
import os
import sys
import unittest
import urllib.error
import urllib.parse
import urllib.request
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from allternit_computers import AllternitComputersClient, ComputersAPIError  # noqa: E402


class FakeResponse:
    def __init__(self, body: bytes, status: int = 200) -> None:
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None


def fake_urlopen(response: FakeResponse, calls: list) -> object:
    def _urlopen(request: urllib.request.Request, timeout: float = 0) -> FakeResponse:
        calls.append({
            "url": request.full_url,
            "method": request.get_method(),
            "headers": dict(request.header_items()),
            "body": request.data,
            "timeout": timeout,
        })
        return response

    return _urlopen


class ClientTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = AllternitComputersClient(base_url="http://gw:8013", token="tok-1")

    def test_defaults(self) -> None:
        client = AllternitComputersClient()
        self.assertEqual(client.base_url, "http://127.0.0.1:8013")

    def test_create_computer_with_approval_id(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"id": "computer-1", "status": "running"}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.create_computer(
                {"kind": "cloud_desktop", "name": "dev-box"}, approval_id="appr-42")
        self.assertEqual(result["id"], "computer-1")
        call = calls[0]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["url"], "http://gw:8013/api/v1/computers?approval_id=appr-42")
        self.assertEqual(call["headers"].get("Content-type"), "application/json")
        self.assertEqual(call["headers"].get("Authorization"), "Bearer tok-1")
        self.assertEqual(json.loads(call["body"].decode()),
                         {"kind": "cloud_desktop", "name": "dev-box"})

    def test_create_computer_without_approval_omits_query(self) -> None:
        calls: list = []
        response = FakeResponse(b"{}")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            self.client.create_computer({"kind": "local"})
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers")

    def test_list_computers_with_query_params(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"computers": [{"id": "c-1"}]}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            computers = self.client.list_computers(
                bot_id="bot 9", kind="cloud_desktop", include_roles=True)
        self.assertEqual(computers, [{"id": "c-1"}])
        call = calls[0]
        self.assertEqual(call["method"], "GET")
        parsed = urllib.parse.urlparse(call["url"])
        self.assertEqual(parsed.path, "/api/v1/computers")
        self.assertEqual(parsed.query, "bot_id=bot%209&kind=cloud_desktop&include_roles=1")

    def test_start_computer_threads_approval(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"id": "c-1", "status": "running"}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.start_computer("c-1", approval_id="appr-9")
        self.assertEqual(result["status"], "running")
        self.assertEqual(calls[0]["method"], "POST")
        self.assertEqual(calls[0]["url"],
                         "http://gw:8013/api/v1/computers/c-1/start?approval_id=appr-9")

    def test_get_computer_quotes_path(self) -> None:
        calls: list = []
        response = FakeResponse(b"{}")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            self.client.get_computer("a/b")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers/a%2Fb")

    def test_resize_uses_patch(self) -> None:
        calls: list = []
        response = FakeResponse(b"{}")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            self.client.resize_computer("c-1", {"cpu_cores": 8}, approval_id="appr-3")
        self.assertEqual(calls[0]["method"], "PATCH")
        self.assertEqual(calls[0]["url"],
                         "http://gw:8013/api/v1/computers/c-1/resize?approval_id=appr-3")
        self.assertEqual(json.loads(calls[0]["body"].decode()), {"cpu_cores": 8})

    def test_delete_posts_to_delete_route(self) -> None:
        calls: list = []
        response = FakeResponse(b"")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            self.assertIsNone(self.client.delete_computer("c-1", approval_id="appr-5"))
        self.assertEqual(calls[0]["method"], "POST")
        self.assertEqual(calls[0]["url"],
                         "http://gw:8013/api/v1/computers/c-1/delete?approval_id=appr-5")

    def test_mouse_control_with_approval(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"success": True}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.mouse("c-1", {"action": "click", "x": 1, "y": 2},
                                       approval_id="appr-1")
        self.assertTrue(result["success"])
        self.assertEqual(calls[0]["url"],
                         "http://gw:8013/api/v1/computers/c-1/mouse?approval_id=appr-1")
        self.assertEqual(json.loads(calls[0]["body"].decode()),
                         {"action": "click", "x": 1, "y": 2})

    def test_shell(self) -> None:
        calls: list = []
        body = json.dumps({"exit_code": 0, "stdout": "hi", "stderr": "", "duration_ms": 7})
        response = FakeResponse(body.encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.shell("c-1", {"command": ["echo", "hi"]})
        self.assertEqual(result["stdout"], "hi")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers/c-1/shell")

    def test_upload_file_sends_octet_stream_with_path(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"success": True}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.upload_file("c-1", "/tmp/a file.txt", b"\x01\x02",
                                             approval_id="appr-8")
        self.assertTrue(result["success"])
        call = calls[0]
        self.assertEqual(call["method"], "POST")
        parsed = urllib.parse.urlparse(call["url"])
        self.assertEqual(parsed.path, "/api/v1/computers/c-1/files/upload")
        self.assertEqual(parsed.query, "path=%2Ftmp%2Fa%20file.txt&approval_id=appr-8")
        self.assertEqual(call["headers"].get("Content-type"), "application/octet-stream")
        self.assertEqual(call["body"], b"\x01\x02")

    def test_download_file_returns_bytes(self) -> None:
        calls: list = []
        response = FakeResponse(b"\x09\x09")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            data = self.client.download_file("c-1", "/tmp/out.bin")
        self.assertEqual(data, b"\x09\x09")
        parsed = urllib.parse.urlparse(calls[0]["url"])
        self.assertEqual(parsed.path, "/api/v1/computers/c-1/files/download")
        self.assertEqual(parsed.query, "path=%2Ftmp%2Fout.bin")

    def test_screenshot_returns_png_bytes(self) -> None:
        calls: list = []
        response = FakeResponse(b"\x89PNG")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            data = self.client.screenshot("c-1")
        self.assertEqual(data, b"\x89PNG")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers/c-1/screenshot")

    def test_snapshot_lifecycle(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps(
            {"snapshots": [{"id": "snap-1", "stateful": True}]}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            snapshots = self.client.list_snapshots("c-1")
            self.client.create_snapshot("c-1", stateful=True)
            self.client.restore_snapshot("c-1", "snap-1")
            self.client.delete_snapshot("c-1", "snap-1")
        self.assertEqual(snapshots[0]["id"], "snap-1")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers/c-1/snapshots")
        self.assertEqual(json.loads(calls[1]["body"].decode()), {"stateful": True})
        self.assertEqual(calls[2]["url"],
                         "http://gw:8013/api/v1/computers/c-1/snapshots/snap-1/restore")
        self.assertEqual(calls[3]["method"], "DELETE")
        self.assertEqual(calls[3]["url"],
                         "http://gw:8013/api/v1/computers/c-1/snapshots/snap-1")

    def test_list_templates_with_filters(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"templates": [{"id": "t-1"}]}).encode())
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            templates = self.client.list_templates(os="linux", tag="dev")
        self.assertEqual(templates, [{"id": "t-1"}])
        parsed = urllib.parse.urlparse(calls[0]["url"])
        self.assertEqual(parsed.path, "/api/v1/desktop-templates")
        self.assertEqual(parsed.query, "os=linux&tag=dev")

    def test_import_template_posts_json(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"id": "t-2"}).encode())
        doc = {"apiVersion": "allternit.ai/v1", "kind": "ComputerTemplate",
               "metadata": {"name": "imported"}}
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.import_template(doc)
        self.assertEqual(result["id"], "t-2")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/desktop-templates/import")
        self.assertEqual(json.loads(calls[0]["body"].decode()), doc)

    def test_build_template_threads_approval(self) -> None:
        calls: list = []
        response = FakeResponse(json.dumps({"id": "t-1", "build_status": "building"}).encode(),
                                status=202)
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            result = self.client.build_template("t-1", approval_id="appr-77")
        self.assertEqual(result["build_status"], "building")
        self.assertEqual(calls[0]["url"],
                         "http://gw:8013/api/v1/desktop-templates/t-1/build?approval_id=appr-77")

    def test_phase5_status_and_embed_token_routes(self) -> None:
        calls: list = []
        response = FakeResponse(b"{}")
        with mock.patch("urllib.request.urlopen", fake_urlopen(response, calls)):
            self.client.get_computer_status("c-1")
            self.client.create_embed_token("c-1")
        self.assertEqual(calls[0]["url"], "http://gw:8013/api/v1/computers/c-1/status")
        self.assertEqual(calls[1]["method"], "POST")
        self.assertEqual(calls[1]["url"], "http://gw:8013/api/v1/computers/c-1/embed-token")

    def test_http_error_raises_with_status_and_payload(self) -> None:
        def _urlopen(request: urllib.request.Request, timeout: float = 0) -> FakeResponse:
            raise urllib.error.HTTPError(
                request.full_url, 404, "Not Found", {},
                io.BytesIO(json.dumps({"error": "computer not found"}).encode()))

        with mock.patch("urllib.request.urlopen", _urlopen):
            with self.assertRaises(ComputersAPIError) as ctx:
                self.client.get_computer("missing")
        self.assertEqual(ctx.exception.status, 404)
        self.assertEqual(ctx.exception.payload, {"error": "computer not found"})


if __name__ == "__main__":
    unittest.main()
