from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import json
import time
from datetime import datetime
from pydantic import BaseModel

from .plugin_engine import run_probe

REPO_ROOT = Path(__file__).resolve().parents[3]
VENDOR_PLUGINS_DIR = (
    REPO_ROOT / "5-ui" / "a2r-platform" / "src" / "a2r-usage" / "plugins"
)
RECEIPTS_DIR = Path(__file__).resolve().parents[1].resolve().parents[0] / ".a2r" / "receipts"
PROVIDER_STATUS_CACHE: Dict[str, Dict[str, float]] = {}


def _camel_case(value: str) -> str:
    parts = value.split("_")
    if not parts:
        return value
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class ProviderMetadata(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    brand_color: Optional[str] = None
    description: Optional[str] = None
    lines: List[Dict[str, Any]] = []
    entry: Optional[str] = None

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetryProviderInfo(BaseModel):
    id: str
    name: str
    icon_url: Optional[str] = None
    active: bool = True
    last_updated: float = 0.0
    description: Optional[str] = None
    brand_color: Optional[str] = None

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetryLine(BaseModel):
    type: str
    label: str
    scope: Optional[str] = None
    used: Optional[float] = None
    limit: Optional[float] = None
    format: Optional[str] = None
    text: Optional[str] = None
    value: Optional[str] = None
    color: Optional[str] = None
    subtitle: Optional[str] = None

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TimelineEntry(BaseModel):
    timestamp: float
    label: str
    type: str
    detail: Optional[str] = None
    speaker: Optional[str] = None

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetrySnapshot(BaseModel):
    session_id: str
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    status: str = "idle"
    timestamp: float = 0.0
    token_usage: Optional[Dict[str, float]] = None
    cost: Optional[float] = None
    tool_usage: Optional[List[Dict[str, Any]]] = None
    model_usage: Optional[Dict[str, Any]] = None
    timeline: List[TimelineEntry] = []
    lines: List[TelemetryLine] = []
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


def _load_plugin_manifest(plugin_dir: Path) -> Optional[ProviderMetadata]:
    manifest = plugin_dir / "plugin.json"
    if not manifest.exists():
        return None
    try:
        raw = json.loads(manifest.read_text())
        return ProviderMetadata(
            id=raw.get("id", plugin_dir.name),
            name=raw.get("name", plugin_dir.name.capitalize()),
            icon=raw.get("icon"),
            brand_color=raw.get("brandColor"),
            description=raw.get("description"),
            lines=raw.get("lines", []),
            entry=raw.get("entry"),
        )
    except json.JSONDecodeError:
        return None


def _provider_status(provider_id: str) -> Dict[str, float]:
    return PROVIDER_STATUS_CACHE.get(provider_id, {})

def _set_provider_status(provider_id: Optional[str], active: bool) -> None:
    if provider_id is None:
        return
    PROVIDER_STATUS_CACHE[provider_id] = {
        "active": active,
        "last_updated": time.time(),
    }


def list_providers() -> List[TelemetryProviderInfo]:
    providers: List[TelemetryProviderInfo] = []
    if not VENDOR_PLUGINS_DIR.exists():
        return providers
    for plugin_dir in sorted(VENDOR_PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir():
            continue
        manifest = _load_plugin_manifest(plugin_dir)
        if not manifest:
            continue
        icon_path = manifest.icon and (plugin_dir / manifest.icon).as_posix()
        status = _provider_status(manifest.id)
        providers.append(TelemetryProviderInfo(
            id=manifest.id,
            name=manifest.name,
            iconUrl=icon_path,
            active=status.get("active", True),
            lastUpdated=status.get("last_updated", time.time()),
            description=manifest.description,
            brandColor=manifest.brand_color,
        ))
    return providers


def build_snapshot(session_id: str, provider: Optional[TelemetryProviderInfo]) -> TelemetrySnapshot:
    now_ms = time.time() * 1000
    provider_id = provider.id if provider else None
    manifest = None
    if provider_id:
        manifest = _load_plugin_manifest(VENDOR_PLUGINS_DIR / provider_id)
    plugin_output = run_probe(provider_id) if provider_id else None

    provider_label = provider.name if provider else (manifest.name if manifest else "Telemetry")
    token_usage = None
    metadata: Dict[str, Any] = {
        "providerId": provider_id,
        "providerName": provider_label,
    }
    cost = None
    status = "idle"
    timeline = []

    if plugin_output:
        lines = _convert_plugin_lines(plugin_output.get("lines", []))
        timeline = _build_plugin_timeline(plugin_output, provider_label)
        token_usage = plugin_output.get("tokenUsage")
        metadata.update(plugin_output.get("metadata", {}))
        cost = plugin_output.get("cost")
        status = plugin_output.get("status", "active")
        tool_usage = plugin_output.get("toolUsage")
        model_usage = plugin_output.get("modelUsage")
        _set_provider_status(provider_id, True)
    else:
        session_receipts = _load_session_receipts(session_id)
        if session_receipts:
            lines = _build_lines_from_receipts(session_receipts, manifest)
            timeline = _build_timeline_from_receipts(session_receipts, provider_label)
            total_ms = sum(r.get("execution", {}).get("duration_ms", 0) for r in session_receipts)
            succeeded = sum(1 for r in session_receipts if r.get("execution", {}).get("exit_code", 0) == 0)
            token_usage = None
            cost = None
            status = "active"
            tool_usage = [
                {"tool": r.get("tool_id", "unknown"), "receipt_id": r.get("receipt_id"), "duration_ms": r.get("execution", {}).get("duration_ms", 0)}
                for r in session_receipts
            ]
            model_usage = None
            metadata["source"] = "a2r-receipts"
            metadata["total_actions"] = len(session_receipts)
            metadata["succeeded"] = succeeded
            metadata["total_duration_ms"] = total_ms
            _set_provider_status(provider_id, True)
        else:
            lines = [
                TelemetryLine(type="text", label="Status", value="Idle", scope="overview"),
                TelemetryLine(type="text", label="Actions", value="0", scope="overview"),
            ]
            timeline = []
            token_usage = None
            cost = None
            status = "idle"
            tool_usage = None
            model_usage = None
            metadata["source"] = "a2r-receipts"
            _set_provider_status(provider_id, False)

    snapshot = TelemetrySnapshot(
        session_id=session_id,
        provider_id=provider_id,
        provider_name=provider_label,
        status=status,
        timestamp=now_ms,
        token_usage=token_usage,
        cost=cost,
        timeline=timeline,
        lines=lines,
        metadata=metadata,
    )

    if plugin_output:
        snapshot.tool_usage = tool_usage
        snapshot.model_usage = model_usage

    return snapshot


def _load_session_receipts(session_id: str) -> List[Dict[str, Any]]:
    """Load all receipts associated with a session from .a2r/receipts/."""
    receipts: List[Dict[str, Any]] = []
    dirs_to_check = [
        RECEIPTS_DIR,
        Path.home() / ".a2r" / "receipts",
        Path.cwd() / ".a2r" / "receipts",
    ]
    seen: set = set()
    for receipts_dir in dirs_to_check:
        if not receipts_dir.exists():
            continue
        for receipt_file in sorted(receipts_dir.glob("rcpt_*.json")):
            if receipt_file in seen:
                continue
            seen.add(receipt_file)
            try:
                data = json.loads(receipt_file.read_text())
                if data.get("run_id") == session_id:
                    receipts.append(data)
            except Exception:
                pass
    return receipts


def _build_lines_from_receipts(
    receipts: List[Dict[str, Any]],
    manifest: Optional[ProviderMetadata],
) -> List[TelemetryLine]:
    total = len(receipts)
    succeeded = sum(1 for r in receipts if r.get("execution", {}).get("exit_code", 0) == 0)
    total_ms = sum(r.get("execution", {}).get("duration_ms", 0) for r in receipts)
    success_pct = round(succeeded / total * 100, 1) if total else 0.0
    return [
        TelemetryLine(type="text", label="Actions", value=str(total), scope="overview"),
        TelemetryLine(
            type="progress",
            label="Success Rate",
            used=success_pct,
            limit=100.0,
            format="percent",
            scope="overview",
        ),
        TelemetryLine(
            type="text",
            label="Total Duration",
            value=f"{total_ms / 1000:.1f}s",
            scope="overview",
        ),
    ]


def _build_timeline_from_receipts(
    receipts: List[Dict[str, Any]],
    label: str,
) -> List[TimelineEntry]:
    entries: List[TimelineEntry] = []
    for receipt in receipts:
        ts_iso = receipt.get("created_at", "")
        try:
            ts = datetime.fromisoformat(ts_iso).timestamp() * 1000
        except Exception:
            ts = time.time() * 1000
        exit_code = receipt.get("execution", {}).get("exit_code", 0)
        entries.append(TimelineEntry(
            timestamp=ts,
            label=receipt.get("tool_id", label),
            type="receipt" if exit_code == 0 else "error",
            detail=receipt.get("receipt_id"),
        ))
    return entries





def _convert_plugin_lines(raw_lines: List[Dict[str, Any]]) -> List[TelemetryLine]:
    lines: List[TelemetryLine] = []
    for raw_line in raw_lines:
        fmt = raw_line.get("format")
        fmt_value = fmt.get("kind") if isinstance(fmt, dict) else fmt
        lines.append(
            TelemetryLine(
                type=raw_line.get("type", "text"),
                label=raw_line.get("label", ""),
                scope=raw_line.get("scope"),
                used=raw_line.get("used"),
                limit=raw_line.get("limit"),
                format=fmt_value,
                text=raw_line.get("text"),
                value=raw_line.get("value"),
                color=raw_line.get("color"),
                subtitle=raw_line.get("subtitle"),
            )
        )
    if not lines:
        lines.append(TelemetryLine(type="text", label="status", text="No data"))
    return lines


def _build_plugin_timeline(plugin_output: Dict[str, Any], label: str) -> List[TimelineEntry]:
    raw_items = plugin_output.get("timeline", [])
    entries: List[TimelineEntry] = []
    for raw in raw_items:
        entries.append(
            TimelineEntry(
                timestamp=_normalize_timestamp(raw.get("timestamp")),
                label=raw.get("label", label),
                type=raw.get("type", "status"),
                detail=raw.get("detail"),
                speaker=raw.get("speaker"),
            )
        )
    if not entries:
        entries.append(
            TimelineEntry(
                timestamp=time.time() * 1000,
                label=f"{label} probe",
                type="status",
                detail=plugin_output.get("plan") or "Plugin snapshot",
                speaker=None,
            )
        )
    return entries


def _normalize_timestamp(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            try:
                return float(json.loads(value))
            except Exception:
                return time.time() * 1000
    return time.time() * 1000
