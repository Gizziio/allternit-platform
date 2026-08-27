"""Dependency-free synchronous client for canonical computer-use REST APIs."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


class ComputerUseAPIError(RuntimeError):
    def __init__(self, status: int, payload: Any) -> None:
        super().__init__(f"Computer-use API returned HTTP {status}: {payload}")
        self.status = status
        self.payload = payload


class AllternitComputerUseClient:
    def __init__(
        self, base_url: str = "http://127.0.0.1:8760", *,
        api_key: Optional[str] = None, timeout_seconds: float = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{self.base_url}/v1/computer-use/canonical{path}", data=data, method=method,
            headers={"Accept": "application/json", **({"Content-Type": "application/json"} if data else {})},
        )
        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", "replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = raw
            raise ComputerUseAPIError(error.code, payload) from error

    @staticmethod
    def _quote(value: str) -> str:
        return urllib.parse.quote(value, safe="")

    def providers(self) -> Dict[str, Any]:
        return self._request("GET", "/providers")

    def native_capabilities(self) -> Dict[str, Any]:
        return self._request("GET", "/native-capabilities")

    def roots(self, *, session_id: str, environment_id: str = "environment_local", provider_id: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", "/roots", {
            "session_id": session_id, "environment_id": environment_id, "provider_id": provider_id,
        })

    def observe(self, *, provider_id: str, session_id: str, environment_id: str, resource_id: str) -> Dict[str, Any]:
        return self._request("POST", "/observe", {
            "provider_id": provider_id, "session_id": session_id,
            "environment_id": environment_id, "resource_id": resource_id,
        })

    def approve_transaction(self, transaction: Dict[str, Any], *, approved_by: str, ttl_seconds: int = 120) -> Dict[str, Any]:
        return self._request("POST", "/approvals", {
            "transaction": transaction, "approved_by": approved_by, "ttl_seconds": ttl_seconds,
        })

    def execute_transaction(self, transaction: Dict[str, Any], *, provider_id: str) -> Dict[str, Any]:
        return self._request("POST", "/transactions", {"provider_id": provider_id, "transaction": transaction})

    def create_environment(self, **request: Any) -> Dict[str, Any]:
        return self._request("POST", "/environments", request)

    def acquire_lease(self, environment_id: str, *, holder_id: str, kind: str = "agent", ttl_seconds: int = 300) -> Dict[str, Any]:
        return self._request("POST", f"/environments/{self._quote(environment_id)}/leases", {
            "holder_id": holder_id, "kind": kind, "ttl_seconds": ttl_seconds,
        })

    def approve_operation(self, **request: Any) -> Dict[str, Any]:
        return self._request("POST", "/operation-approvals", request)

    def environment_operation(self, environment_id: str, path: str, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", f"/environments/{self._quote(environment_id)}/{path.lstrip('/')}", request)

    def trajectory(self, session_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/sessions/{self._quote(session_id)}/trajectory")

    def routing_cells(self) -> Dict[str, Any]:
        return self._request("GET", "/routing/cells")

    def history_status(self) -> Dict[str, Any]:
        return self._request("POST", "/history/status", {})

    def history_query(self, *, limit: int = 50, session_id: Optional[str] = None,
                      since_sequence: Optional[int] = None, until_sequence: Optional[int] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"limit": limit}
        if session_id is not None:
            body["session_id"] = session_id
        if since_sequence is not None:
            body["since_sequence"] = since_sequence
        if until_sequence is not None:
            body["until_sequence"] = until_sequence
        return self._request("POST", "/history/query", body)
