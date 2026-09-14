"""
Allternit Computer Use — Network Traces (HAR third leg)

HAR as the third verification leg of the record → teach → batch → verify
chain (spec: Research/specs/har-network-traces.md).

Pipeline:
  - ``scrub_har``       H0 — deterministic scrub of a raw HAR document BEFORE
                        storage. Authorization/cookie headers, token-bearing
                        query params, and payload secrets are replaced using
                        the same ``SENSITIVE_KEY`` policy as
                        ``core.action_recorder.redact_tool_args``. After
                        scrubbing, every original sensitive value is searched
                        for in the serialized result; any survivor raises
                        ``HarScrubError`` — the HAR is refused, never stored
                        raw (fail closed).
  - ``distill_har``     H1 — distill a scrubbed HAR into a ``NetworkTrace``
                        (ordered shapes only: method, host, path template
                        with ID segments normalized, payload key-set hash).
                        Never values. Entries whose paths cannot be
                        templated deterministically are marked
                        ``unverifiable`` — never guessed.
  - ``compare_traces``  H2 — deterministic ordered comparison of a live trace
                        against the recorded one. Exact method + path
                        template + order; exact payload key-set; count
                        mismatch = deviation. Every mismatch becomes a
                        ``NetworkDeviation``; the caller maps those onto the
                        existing ``ReplayDeviation``/receipt machinery.

Only http/https entries are distilled or compared — browser-internal
requests (data:, chrome-extension:, ...) are not server ground truth.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

logger = logging.getLogger(__name__)

try:
    from core.action_recorder import _SENSITIVE_KEY
except ImportError:
    try:
        from action_recorder import _SENSITIVE_KEY
    except ImportError:
        _SENSITIVE_KEY = re.compile(
            r"(authorization|cookie|token|secret|password|api[_-]?key|clipboard)", re.I
        )

TRACE_VERSION = 1

# Sentinel written in place of any scrubbed value. Deliberately not a value
# any real header/query/payload is likely to carry verbatim.
REDACTED = "[REDACTED]"

# Minimum length of a sensitive value for the post-scrub survivor check —
# shorter fragments ("ab") appear in JSON punctuation too often to be useful
# evidence of a leak.
_SURVIVOR_MIN_LEN = 4

# A path segment is an identifier when it is fully digits, a hex/blob slug of
# 6+ chars, or a UUID. Deterministic — no heuristics about "looks random".
_ID_SEGMENT = re.compile(
    r"^(\d+|[0-9a-fA-F]{6,}|[0-9a-zA-Z_-]{16,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$"
)


class HarScrubError(Exception):
    """The HAR could not be scrubbed to a provably clean state.

    Raised fail-closed: the caller must refuse to store the artifact.
    """


# ---------------------------------------------------------------------------
# H0 — scrub
# ---------------------------------------------------------------------------

def _collect_value(value: Any, secrets: List[str]) -> None:
    """Collect a sensitive value for the survivor check.

    Whitespace-composite values ("Bearer <token>", "session=<id> <other>")
    also contribute their individual parts, so a secret that escapes its
    original field without its prefix still trips the fail-closed check.
    """
    if not isinstance(value, str) or len(value) < _SURVIVOR_MIN_LEN:
        return
    secrets.append(value)
    for part in value.split():
        if len(part) >= _SURVIVOR_MIN_LEN and part not in ("Bearer", "Basic"):
            secrets.append(part)


def _collect(value: Any, secrets: List[str]) -> None:
    """Collect primitive values under sensitive-looking keys (recursively)."""
    if isinstance(value, dict):
        for key, item in value.items():
            if _SENSITIVE_KEY.search(str(key)):
                if isinstance(item, (str, int, float)) and not isinstance(item, bool):
                    _collect_value(str(item), secrets)
                else:
                    _collect(item, secrets)
            else:
                _collect(item, secrets)
    elif isinstance(value, (list, tuple)):
        for item in value:
            _collect(item, secrets)


def _redact_json_value(value: Any) -> Any:
    """Recursively replace values under sensitive keys with REDACTED."""
    if isinstance(value, dict):
        return {
            str(key): (REDACTED if _SENSITIVE_KEY.search(str(key)) else _redact_json_value(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_redact_json_value(item) for item in value]
    return value


def _scrub_headers(headers: Any, secrets: List[str]) -> List[Dict[str, Any]]:
    """Redact sensitive header values in place-of-value; shape preserved."""
    out = []
    for header in headers or []:
        if not isinstance(header, dict):
            continue
        name = str(header.get("name", ""))
        value = header.get("value", "")
        if _SENSITIVE_KEY.search(name):
            _collect_value(value if isinstance(value, str) else "", secrets)
            value = REDACTED
        out.append({"name": name, "value": value})
    return out


def _scrub_query(query: Any, secrets: List[str]) -> Tuple[List[Dict[str, Any]], bool]:
    """Redact token-bearing query params. Returns (scrubbed, changed)."""
    out = []
    changed = False
    for param in query or []:
        if not isinstance(param, dict):
            continue
        name = str(param.get("name", ""))
        value = param.get("value", "")
        if _SENSITIVE_KEY.search(name):
            _collect_value(value if isinstance(value, str) else "", secrets)
            value = REDACTED
            changed = True
        out.append({"name": name, "value": value})
    return out, changed


def _scrub_url(url: str, query: List[Dict[str, Any]]) -> str:
    """Rebuild a URL with its query string replaced by the scrubbed params."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    if not parts.query:
        return url
    from urllib.parse import quote_plus

    rendered = "&".join(
        f"{quote_plus(str(p['name']))}={quote_plus(str(p['value']))}" for p in query
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, rendered, parts.fragment))


def _scrub_post_data(post_data: Any, secrets: List[str]) -> Dict[str, Any]:
    """Redact payload secrets. JSON bodies are redacted recursively; form
    bodies are treated like query params; anything else is left as-is (the
    survivor check below still fails closed if a collected secret appears)."""
    if not isinstance(post_data, dict):
        return {}
    out = dict(post_data)
    text = post_data.get("text")
    mime = str(post_data.get("mimeType", ""))
    if not isinstance(text, str) or not text:
        return out
    if "json" in mime:
        try:
            parsed = json.loads(text)
        except ValueError:
            parsed = None
        if parsed is not None:
            _collect(parsed, secrets)
            out["text"] = json.dumps(_redact_json_value(parsed), sort_keys=True)
        return out
    if "application/x-www-form-urlencoded" in mime:
        pairs = []
        changed = False
        for chunk in text.split("&"):
            name, _, value = chunk.partition("=")
            if _SENSITIVE_KEY.search(name):
                _collect_value(value, secrets)
                value = REDACTED
                changed = True
            pairs.append(f"{name}={value}")
        if changed:
            out["text"] = "&".join(pairs)
        return out
    return out


def scrub_har(har: Dict[str, Any]) -> Dict[str, Any]:
    """Scrub a raw HAR document. Raises ``HarScrubError`` fail-closed when any
    originally-sensitive value survives anywhere in the serialized result."""
    if not isinstance(har, dict) or not isinstance(har.get("log"), dict):
        raise HarScrubError("not a HAR document (missing log)")

    secrets: List[str] = []
    log = har["log"]
    entries = log.get("entries")
    if not isinstance(entries, list):
        raise HarScrubError("not a HAR document (missing log.entries)")

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        request = entry.get("request")
        if isinstance(request, dict):
            request["headers"] = _scrub_headers(request.get("headers"), secrets)
            query, _ = _scrub_query(request.get("queryString"), secrets)
            request["queryString"] = query
            if isinstance(request.get("url"), str):
                request["url"] = _scrub_url(request["url"], query)
            if isinstance(request.get("postData"), dict):
                request["postData"] = _scrub_post_data(request["postData"], secrets)
        response = entry.get("response")
        if isinstance(response, dict):
            response["headers"] = _scrub_headers(response.get("headers"), secrets)
            # Response cookies ride their own list — redact value + cookie
            # header-alikes deterministically.
            cookies = response.get("cookies")
            if isinstance(cookies, list):
                for cookie in cookies:
                    if isinstance(cookie, dict) and isinstance(cookie.get("value"), str):
                        _collect_value(cookie["value"], secrets)
                        cookie["value"] = REDACTED

    # Fail-closed verification: no originally-sensitive value may survive
    # anywhere in the serialized scrubbed document (headers we did not know
    # about, nested encodings, comments — anything).
    serialized = json.dumps(har, sort_keys=True, default=str)
    for secret in secrets:
        if secret and len(secret) >= _SURVIVOR_MIN_LEN and secret in serialized:
            logger.error("[har] scrub survivor detected (%d chars) — refusing", len(secret))
            raise HarScrubError(
                "sensitive value survived scrubbing; HAR refused (fail closed)"
            )
    return har


# ---------------------------------------------------------------------------
# H1 — distill
# ---------------------------------------------------------------------------

def _path_template(path: str) -> str:
    """Normalize ID-looking path segments to ``{id}`` (deterministic)."""
    segments = [s for s in path.split("/") if s != ""]
    normalized = ["{id}" if _ID_SEGMENT.match(s) else s for s in segments]
    return "/" + "/".join(normalized)


def _payload_key_hash(post_data: Any) -> Optional[str]:
    """SHA-256 of the sorted JSON payload key paths (shapes, not values).

    Returns ``None`` when the request carries no JSON payload — distinct from
    an empty-object hash, so "payload appeared where none was recorded" is a
    deterministic drift, not a guess.
    """
    if not isinstance(post_data, dict):
        return None
    text = post_data.get("text")
    if not isinstance(text, str) or not text:
        return None
    try:
        parsed = json.loads(text)
    except ValueError:
        return None
    if not isinstance(parsed, dict):
        return None

    keys: List[str] = []

    def _walk(value: Any, prefix: str) -> None:
        if isinstance(value, dict):
            for key in sorted(value.keys(), key=str):
                path = f"{prefix}.{key}" if prefix else str(key)
                keys.append(path)
                _walk(value[key], path)
        elif isinstance(value, list):
            for index, item in enumerate(value):
                _walk(item, f"{prefix}[{index}]")

    _walk(parsed, "")
    digest = hashlib.sha256("\n".join(keys).encode("utf-8")).hexdigest()
    return digest


@dataclass
class NetworkEntry:
    """One shape-only network expectation (recorded or live)."""
    method: str
    host: str
    path_template: str
    payload_keys_hash: Optional[str] = None
    verifiable: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "method": self.method,
            "host": self.host,
            "pathTemplate": self.path_template,
            "payloadKeysHash": self.payload_keys_hash,
            "verifiable": self.verifiable,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "NetworkEntry":
        return NetworkEntry(
            method=str(data.get("method", "")),
            host=str(data.get("host", "")),
            path_template=str(data.get("pathTemplate", "")),
            payload_keys_hash=data.get("payloadKeysHash"),
            verifiable=bool(data.get("verifiable", True)),
        )


@dataclass
class NetworkTrace:
    """Ordered, versioned list of network expectations (shapes only)."""
    entries: List[NetworkEntry] = field(default_factory=list)
    version: int = TRACE_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "entries": [e.to_dict() for e in self.entries],
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "NetworkTrace":
        if int(data.get("version", TRACE_VERSION)) != TRACE_VERSION:
            raise ValueError(f"unsupported NetworkTrace version: {data.get('version')}")
        entries = data.get("entries")
        if not isinstance(entries, list):
            raise ValueError("NetworkTrace entries must be a list")
        return NetworkTrace(entries=[NetworkEntry.from_dict(e) for e in entries])


def distill_har(har: Dict[str, Any]) -> NetworkTrace:
    """Distill a (scrubbed) HAR into a ``NetworkTrace``.

    Path templates are built per (method, host) group: when every path in the
    group normalizes to the same template the entry is ``verifiable``; when
    the group disagrees (no deterministic template exists) every entry in it
    is marked ``unverifiable`` — never guessed.
    """
    log = har.get("log") or {}
    raw_entries: List[Tuple[str, str, str, Optional[str]]] = []
    for entry in log.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        request = entry.get("request") or {}
        url = str(request.get("url") or "")
        try:
            parts = urlsplit(url)
        except ValueError:
            continue
        if parts.scheme not in ("http", "https") or not parts.netloc:
            continue
        method = str(request.get("method") or "GET").upper()
        host = parts.netloc
        template = _path_template(parts.path or "/")
        payload_hash = _payload_key_hash(request.get("postData"))
        raw_entries.append((method, host, template, payload_hash))

    groups: Dict[Tuple[str, str], set] = {}
    for method, host, template, _ in raw_entries:
        groups.setdefault((method, host), set()).add(template)

    trace = NetworkTrace()
    for method, host, template, payload_hash in raw_entries:
        verifiable = len(groups[(method, host)]) == 1
        trace.entries.append(NetworkEntry(
            method=method,
            host=host,
            path_template=template,
            payload_keys_hash=payload_hash,
            verifiable=verifiable,
        ))
    return trace


# ---------------------------------------------------------------------------
# H2 — deterministic comparison
# ---------------------------------------------------------------------------

# Deviation kinds (deterministic vocabulary).
DEV_METHOD = "wrong_method"
DEV_REORDERED = "reordered"
DEV_EXTRA = "extra_call"
DEV_MISSING = "missing_call"
DEV_PAYLOAD = "payload_key_drift"


@dataclass
class NetworkDeviation:
    """One exact mismatch between the recorded trace and the live trace."""
    kind: str
    index: int                # recorded index (missing/reordered/payload/method)
    live_index: Optional[int]
    expected: Dict[str, Any]
    actual: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "index": self.index,
            "live_index": self.live_index,
            "expected": self.expected,
            "actual": self.actual,
        }


def _segment_match(template: str, live_path: str) -> bool:
    """Template segment ``{id}`` matches any ID-like live segment; every other
    template segment must equal the live segment exactly. Deterministic."""
    t_segments = [s for s in template.split("/") if s != ""]
    l_segments = [s for s in live_path.split("/") if s != ""]
    if len(t_segments) != len(l_segments):
        return False
    for t_seg, l_seg in zip(t_segments, l_segments):
        if t_seg == "{id}":
            if not _ID_SEGMENT.match(l_seg):
                return False
        elif t_seg != l_seg:
            return False
    return True


def _entry_shape(entry: NetworkEntry, path: Optional[str] = None) -> Dict[str, Any]:
    shape = entry.to_dict()
    if path is not None:
        shape["path"] = path
    return shape


def compare_traces(
    recorded: NetworkTrace,
    live: NetworkTrace,
) -> List[NetworkDeviation]:
    """Deterministic ordered comparison. Returns every mismatch — the caller
    decides halt-at-first-failure reporting; nothing here is fuzzy."""
    deviations: List[NetworkDeviation] = []
    live_entries = live.entries
    consumed = [False] * len(live_entries)
    cursor = 0

    def _matches(recorded_entry: NetworkEntry, live_entry: NetworkEntry) -> bool:
        if recorded_entry.method != live_entry.method:
            return False
        if recorded_entry.host != live_entry.host:
            return False
        if not recorded_entry.verifiable:
            return True  # unverifiable: method+host only, no path guess
        return _segment_match(recorded_entry.path_template, live_entry.path_template)

    for index, rec in enumerate(recorded.entries):
        found = -1
        for j in range(cursor, len(live_entries)):
            if not consumed[j] and _matches(rec, live_entries[j]):
                found = j
                break

        if found >= 0:
            consumed[found] = True
            cursor = found
            live_entry = live_entries[found]
            if (
                rec.verifiable
                and rec.payload_keys_hash != live_entry.payload_keys_hash
            ):
                deviations.append(NetworkDeviation(
                    kind=DEV_PAYLOAD,
                    index=index,
                    live_index=found,
                    expected=_entry_shape(rec),
                    actual=_entry_shape(live_entry),
                ))
            continue

        # Not found from the cursor onward. Wrong method at the same shape?
        wrong_at = -1
        if rec.verifiable:
            for j in range(cursor, len(live_entries)):
                candidate = live_entries[j]
                if consumed[j] or candidate.method == rec.method:
                    continue
                if candidate.host == rec.host and _segment_match(
                    rec.path_template, candidate.path_template
                ):
                    wrong_at = j
                    break
        if wrong_at >= 0:
            consumed[wrong_at] = True
            cursor = wrong_at
            deviations.append(NetworkDeviation(
                kind=DEV_METHOD,
                index=index,
                live_index=wrong_at,
                expected=_entry_shape(rec),
                actual=_entry_shape(live_entries[wrong_at]),
            ))
            continue

        # Reordered (the same shape already passed, unconsumed) or missing.
        reordered_at = -1
        for j in range(0, cursor):
            if not consumed[j] and _matches(rec, live_entries[j]):
                reordered_at = j
                break
        if reordered_at >= 0:
            consumed[reordered_at] = True
            deviations.append(NetworkDeviation(
                kind=DEV_REORDERED,
                index=index,
                live_index=reordered_at,
                expected=_entry_shape(rec),
                actual=_entry_shape(live_entries[reordered_at]),
            ))
        else:
            deviations.append(NetworkDeviation(
                kind=DEV_MISSING,
                index=index,
                live_index=None,
                expected=_entry_shape(rec),
                actual=None,
            ))

    for j, live_entry in enumerate(live_entries):
        if not consumed[j]:
            deviations.append(NetworkDeviation(
                kind=DEV_EXTRA,
                index=j,
                live_index=j,
                expected={},
                actual=_entry_shape(live_entry),
            ))

    return deviations


def load_har(path: Any) -> Dict[str, Any]:
    """Read a HAR document from disk."""
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def store_scrubbed_har(raw_path: Any, out_path: Any) -> Dict[str, Any]:
    """Scrub the raw HAR at ``raw_path`` and write the result to ``out_path``.

    Raises ``HarScrubError`` without writing anything when scrubbing fails.
    The raw file is the caller's to delete (it may be Playwright-managed).
    """
    har = load_har(raw_path)
    scrubbed = scrub_har(har)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(scrubbed, handle, indent=2, sort_keys=True)
    return scrubbed
