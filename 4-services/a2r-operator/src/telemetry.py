from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import json
import random
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
    icon: Optional[str]
    brand_color: Optional[str]
    description: Optional[str]
    lines: List[Dict[str, Any]]
    entry: Optional[str]

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetryProviderInfo(BaseModel):
    id: str
    name: str
    icon_url: Optional[str]
    active: bool
    last_updated: float
    description: Optional[str]
    brand_color: Optional[str]

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetryLine(BaseModel):
    type: str
    label: str
    scope: Optional[str]
    used: Optional[float]
    limit: Optional[float]
    format: Optional[str]
    text: Optional[str]
    value: Optional[str]
    color: Optional[str]
    subtitle: Optional[str]

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TimelineEntry(BaseModel):
    timestamp: float
    label: str
    type: str
    detail: Optional[str]
    speaker: Optional[str]

    class Config:
        alias_generator = _camel_case
        allow_population_by_field_name = True


class TelemetrySnapshot(BaseModel):
    session_id: str
    provider_id: Optional[str]
    provider_name: Optional[str]
    status: str
    timestamp: float
    token_usage: Optional[Dict[str, float]]
    cost: Optional[float]
    tool_usage: Optional[List[Dict[str, Any]]]
    model_usage: Optional[Dict[str, Any]]
    timeline: List[TimelineEntry]
    lines: List[TelemetryLine]
    metadata: Optional[Dict[str, Any]]

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
        base = _derive_seed(session_id)
        lines = _build_lines_from_manifest(manifest, base) if manifest else _default_lines(base)
        timeline = _build_timeline(base, provider_label)
        token_usage = {
            "input": 400 + base % 600,
            "output": 1200 + (base * 2) % 2400,
            "total": 1600 + base % 2200,
        }
        metadata["source"] = "a2r-usage-plugin"
        cost = round((token_usage["total"] / 1000) * 0.02, 4)
        status = "idle"
        tool_usage = None
        model_usage = None
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


def _derive_seed(session_id: str) -> int:
    digest = hashlib.sha256(session_id.encode()).digest()
    return int.from_bytes(digest[:4], "little")


def _build_lines_from_manifest(manifest: ProviderMetadata, seed: int) -> List[TelemetryLine]:
    lines: List[TelemetryLine] = []
    random.seed(seed)
    for idx, line_desc in enumerate(manifest.lines):
        line_type = line_desc.get("type", "text")
        label = line_desc.get("label", f"Metric {idx}")
        if line_type == "progress":
            used = random.uniform(20, 90)
            limit = 100.0
            lines.append(
                TelemetryLine(
                    type="progress",
                    label=label,
                    used=round(used, 2),
                    limit=limit,
                    format="percent",
                    scope=line_desc.get("scope"),
                    color=line_desc.get("color"),
                    subtitle=line_desc.get("subtitle"),
                )
            )
        elif line_type == "badge":
            lines.append(
                TelemetryLine(
                    type="badge",
                    label=label,
                    text=line_desc.get("text", "Active"),
                    scope=line_desc.get("scope"),
                    color=line_desc.get("color"),
                    subtitle=line_desc.get("subtitle"),
                )
            )
        else:
            lines.append(
                TelemetryLine(
                    type="text",
                    label=label,
                    value=line_desc.get("value", f"{seed % 100}%"),
                    scope=line_desc.get("scope"),
                    color=line_desc.get("color"),
                    subtitle=line_desc.get("subtitle"),
                )
            )
    return lines


def _default_lines(seed: int) -> List[TelemetryLine]:
    return [
        TelemetryLine(type="progress", label="Session", used=seed % 100, limit=100, format="percent", scope="overview"),
        TelemetryLine(type="text", label="Status", value="Idle"),
    ]


def _build_timeline(seed: int, label: str) -> List[TimelineEntry]:
    now = time.time() * 1000
    return [
        TimelineEntry(timestamp=now - 60000, label=f"{label} event", type="message", detail="Agent response"),
        TimelineEntry(timestamp=now - 30000, label="Tool used", type="receipt", detail="Quick search"),
    ]


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
