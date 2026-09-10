"""Dependency-free synchronous client for the Allternit Computers API.

Mirrors the route surface in ``cmd/allternit-api/src/computer_routes.rs``
(mounted at /api/v1/computers), the control/file surface in
``bot_desktop_input.rs``, snapshots in ``bot_desktop_snapshots.rs``, and the
Phase 4 desktop template registry in ``bot_desktop_templates.rs`` (mounted at
/api/v1/desktop-templates).

Risky calls accept an optional ``approval_id``, threaded verbatim as the
``?approval_id=`` query param (the server-side serde field is ``approval_id``,
with ``approvalId`` accepted as an alias). This client never obtains approvals
itself — the caller must already hold a grant from the ACI approvals flow and
pass it through.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "http://127.0.0.1:8013"
_COMPUTERS_PREFIX = "/api/v1/computers"
_TEMPLATES_PREFIX = "/api/v1/desktop-templates"


class ComputersAPIError(RuntimeError):
    def __init__(self, status: int, payload: Any) -> None:
        super().__init__(f"Computers API returned HTTP {status}: {payload}")
        self.status = status
        self.payload = payload


class AllternitComputersClient:
    def __init__(
        self, base_url: str = DEFAULT_BASE_URL, *,
        token: Optional[str] = None, api_key: Optional[str] = None,
        timeout_seconds: float = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token if token is not None else api_key
        self.timeout_seconds = timeout_seconds

    # ── HTTP plumbing ──────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, *,
                 data: Optional[bytes] = None, binary: bool = False) -> Any:
        if data is not None:
            payload = data
            content_type = "application/octet-stream"
        elif body is not None:
            payload = json.dumps(body).encode("utf-8")
            content_type = "application/json"
        else:
            payload = None
            content_type = None
        request = urllib.request.Request(
            f"{self.base_url}{path}", data=payload, method=method,
            headers={"Accept": "application/json", **({"Content-Type": content_type} if content_type else {})},
        )
        if self.token:
            request.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except urllib.error.HTTPError as error:
            text = error.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = text
            raise ComputersAPIError(error.code, parsed) from error
        if binary:
            return raw
        if not raw:
            return None
        return json.loads(raw)

    @staticmethod
    def _quote(value: str) -> str:
        return urllib.parse.quote(value, safe="")

    @staticmethod
    def _with_approval(path: str, approval_id: Optional[str]) -> str:
        if not approval_id:
            return path
        separator = "&" if "?" in path else "?"
        return f"{path}{separator}approval_id={urllib.parse.quote(approval_id, safe='')}"

    # ── REST lifecycle ─────────────────────────────────────────────────────

    def list_computers(self, *, bot_id: Optional[str] = None, kind: Optional[str] = None,
                       group_id: Optional[str] = None,
                       include_roles: bool = False) -> List[Dict[str, Any]]:
        params: List[str] = []
        if bot_id:
            params.append(f"bot_id={urllib.parse.quote(bot_id, safe='')}")
        if kind:
            params.append(f"kind={urllib.parse.quote(kind, safe='')}")
        if group_id:
            params.append(f"group_id={urllib.parse.quote(group_id, safe='')}")
        if include_roles:
            params.append("include_roles=1")
        query = f"?{'&'.join(params)}" if params else ""
        result = self._request("GET", f"{_COMPUTERS_PREFIX}{query}")
        return result.get("computers", [])

    def get_computer(self, computer_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}")

    def create_computer(self, request: Dict[str, Any], *,
                        approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(_COMPUTERS_PREFIX, approval_id), request)

    def start_computer(self, computer_id: str, *,
                       approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/start", approval_id))

    def stop_computer(self, computer_id: str, *,
                      approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/stop", approval_id))

    def restart_computer(self, computer_id: str, *,
                         approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/restart", approval_id))

    def resize_computer(self, computer_id: str, request: Dict[str, Any], *,
                        approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("PATCH", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/resize", approval_id), request)

    def clone_computer(self, computer_id: str, name: Optional[str] = None, *,
                       approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/clone", approval_id), {"name": name})

    def delete_computer(self, computer_id: str, *,
                        approval_id: Optional[str] = None) -> None:
        self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/delete", approval_id))

    # ── Phase 5 additions: status + embed token ────────────────────────────
    # These routes are being added to the server concurrently with this SDK;
    # response payloads are not yet frozen.

    def get_computer_status(self, computer_id: str) -> Dict[str, Any]:
        return self._request("GET", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/status")

    def create_embed_token(self, computer_id: str) -> Dict[str, Any]:
        return self._request("POST", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/embed-token")

    # ── Desktop control ────────────────────────────────────────────────────

    def screenshot(self, computer_id: str) -> bytes:
        """GET /api/v1/computers/:id/screenshot -> PNG bytes."""
        return self._request("GET", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/screenshot",
                             binary=True)

    def mouse(self, computer_id: str, request: Dict[str, Any], *,
              approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/mouse", approval_id), request)

    def keyboard(self, computer_id: str, request: Dict[str, Any], *,
                 approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/keyboard", approval_id), request)

    def shell(self, computer_id: str, request: Dict[str, Any], *,
              approval_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", self._with_approval(
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/shell", approval_id), request)

    def upload_file(self, computer_id: str, path: str, data: bytes, *,
                    approval_id: Optional[str] = None) -> Dict[str, Any]:
        """POST raw body bytes with ?path= (and optional ?approval_id=)."""
        query = f"?path={urllib.parse.quote(path, safe='')}"
        if approval_id:
            query += f"&approval_id={urllib.parse.quote(approval_id, safe='')}"
        return self._request(
            "POST", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/files/upload{query}",
            data=data)

    def download_file(self, computer_id: str, path: str) -> bytes:
        """GET ?path= -> file bytes."""
        query = f"?path={urllib.parse.quote(path, safe='')}"
        return self._request(
            "GET", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/files/download{query}",
            binary=True)

    # ── Snapshots ──────────────────────────────────────────────────────────

    def list_snapshots(self, computer_id: str) -> List[Dict[str, Any]]:
        result = self._request("GET", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/snapshots")
        return result.get("snapshots", [])

    def create_snapshot(self, computer_id: str, stateful: bool = False) -> Dict[str, Any]:
        return self._request("POST", f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/snapshots",
                             {"stateful": stateful})

    def restore_snapshot(self, computer_id: str, snapshot_id: str) -> Dict[str, Any]:
        return self._request(
            "POST",
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/snapshots/"
            f"{self._quote(snapshot_id)}/restore")

    def delete_snapshot(self, computer_id: str, snapshot_id: str) -> Dict[str, Any]:
        return self._request(
            "DELETE",
            f"{_COMPUTERS_PREFIX}/{self._quote(computer_id)}/snapshots/"
            f"{self._quote(snapshot_id)}")

    # ── Desktop templates (Phase 4 registry) ───────────────────────────────

    def list_templates(self, *, os: Optional[str] = None,
                       tag: Optional[str] = None) -> List[Dict[str, Any]]:
        params: List[str] = []
        if os:
            params.append(f"os={urllib.parse.quote(os, safe='')}")
        if tag:
            params.append(f"tag={urllib.parse.quote(tag, safe='')}")
        query = f"?{'&'.join(params)}" if params else ""
        result = self._request("GET", f"{_TEMPLATES_PREFIX}{query}")
        return result.get("templates", [])

    def import_template(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/v1/desktop-templates/import (canonical ComputerTemplate doc).

        The body is serialized as JSON; the server's YAML deserializer parses
        JSON as a subset of YAML.
        """
        return self._request("POST", f"{_TEMPLATES_PREFIX}/import", doc)

    def build_template(self, template_id: str, *,
                       approval_id: Optional[str] = None) -> Dict[str, Any]:
        """POST /api/v1/desktop-templates/:id/build (ACI-approval-gated)."""
        return self._request("POST", self._with_approval(
            f"{_TEMPLATES_PREFIX}/{self._quote(template_id)}/build", approval_id))
