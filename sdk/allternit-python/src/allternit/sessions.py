"""Cloud Agents sessions client for the Allternit API (`/api/v1/sessions`).

Stdlib-only HTTP client. This is the Allternit public session surface — the
same kind of product as hosted agent sessions, on Allternit's own session
model. It is not an OpenAI or Anthropic Agents API client and sends no beta
headers.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, Optional, Union


class CloudAgentsError(Exception):
    """Raised when the Allternit API returns a non-2xx response."""

    def __init__(self, status: int, detail: str):
        super().__init__(f"Allternit request failed: HTTP {status} — {detail}")
        self.status = status
        self.detail = detail


@dataclass
class CloudSessionEvent:
    id: str
    type: str
    session_id: str
    created_at: str
    data: Dict[str, Any] = field(default_factory=dict)
    sequence: Optional[int] = None

    @classmethod
    def from_json(cls, payload: Dict[str, Any]) -> "CloudSessionEvent":
        return cls(
            id=payload.get("id", ""),
            type=payload.get("type", ""),
            session_id=payload.get("session_id", ""),
            created_at=payload.get("created_at", ""),
            data=payload.get("data") or {},
            sequence=payload.get("sequence"),
        )


class Allternit:
    """Client for the Allternit Agents Cloud Agents API.

    Usage::

        client = Allternit(api_key="...", base_url="http://localhost:8013")
        session = client.sessions.create(
            agent={"model": "kimi-k2", "instructions": "Be terse."},
            computer={"kind": "none"},
            input="hello",
        )
        client.sessions.events.send(session["id"], [{"type": "user.interrupt"}])
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "http://localhost:8013",
        timeout: float = 60.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.sessions = _SessionsResource(self)

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                **(
                    {"Authorization": f"Bearer {self.api_key}"}
                    if self.api_key
                    else {}
                ),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise CloudAgentsError(error.code, detail) from error
        return json.loads(raw) if raw else {}

    def _stream(self, path: str) -> Iterator[CloudSessionEvent]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            headers=(
                {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            ),
        )
        buffer = b""
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            while True:
                chunk = response.read1(4096)
                if not chunk:
                    break
                buffer += chunk
                while b"\n\n" in buffer:
                    frame, buffer = buffer.split(b"\n\n", 1)
                    for line in frame.split(b"\n"):
                        if line.startswith(b"data:"):
                            text = line[5:].strip()
                            if text:
                                try:
                                    yield CloudSessionEvent.from_json(
                                        json.loads(text.decode("utf-8"))
                                    )
                                except (ValueError, TypeError):
                                    continue


class _SessionsResource:
    def __init__(self, client: Allternit):
        self._client = client
        self.events = _EventsResource(client)

    def turns(self, session_id: str) -> List[Dict[str, Any]]:
        payload = self._client._request(
            "GET", f"/api/v1/sessions/{session_id}/turns"
        )
        return payload.get("turns", [])

    def create(
        self,
        agent: Optional[Union[str, Dict[str, Any]]] = None,
        computer: Optional[Dict[str, Any]] = None,
        input: Optional[Union[str, Dict[str, Any]]] = None,
        vault_ids: Optional[List[str]] = None,
        budget: Optional[Dict[str, int]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        brain_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"stream": False}
        if agent is not None:
            body["agent"] = agent
        body["computer"] = computer or {"kind": "none"}
        if input is not None:
            body["input"] = input
        if vault_ids is not None:
            body["vault_ids"] = vault_ids
        if budget is not None:
            body["budget"] = budget
        if metadata is not None:
            body["metadata"] = metadata
        if brain_id is not None:
            body["brain_id"] = brain_id
        payload = self._client._request("POST", "/api/v1/sessions", body)
        return payload.get("session", payload)

    def retrieve(self, session_id: str) -> Dict[str, Any]:
        payload = self._client._request("GET", f"/api/v1/sessions/{session_id}")
        return payload.get("session", payload)

    def archive(self, session_id: str) -> Dict[str, Any]:
        return self._client._request(
            "POST", f"/api/v1/sessions/{session_id}/archive", {}
        )


class _EventsResource:
    def __init__(self, client: Allternit):
        self._client = client

    def send(
        self, session_id: str, events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return self._client._request(
            "POST",
            f"/api/v1/sessions/{session_id}/events",
            {"events": events},
        )

    def stream(
        self, session_id: str, after: Optional[int] = None
    ) -> Iterator[CloudSessionEvent]:
        query = f"?after={after}" if after is not None else ""
        return self._client._stream(
            f"/api/v1/sessions/{session_id}/events/stream{query}"
        )
