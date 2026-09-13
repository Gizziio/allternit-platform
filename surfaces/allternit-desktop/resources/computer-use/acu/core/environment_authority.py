"""Durable authority for computer environments, images, snapshots, and leases."""

from __future__ import annotations

import json
import sqlite3
import threading
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat()


@dataclass(frozen=True)
class EnvironmentRecord:
    environment_id: str
    owner_id: str
    provider_id: str
    os: str
    isolation: str
    state: str
    image_digest: Optional[str]
    created_at: str
    updated_at: str
    expires_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ImageRecord:
    digest: str
    source: str
    os: str
    architecture: str
    provenance: Dict[str, Any]
    scan_status: str
    created_at: str


@dataclass(frozen=True)
class LeaseRecord:
    lease_id: str
    environment_id: str
    holder_id: str
    kind: str
    issued_at: str
    expires_at: str


@dataclass(frozen=True)
class SnapshotRecord:
    snapshot_id: str
    environment_id: str
    parent_snapshot_id: Optional[str]
    backend_reference: str
    state: str
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EnvironmentPoolRecord:
    pool_id: str
    owner_id: str
    provider_id: str
    os: str
    isolation: str
    image_digest: Optional[str]
    maximum_size: int
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class EnvironmentConflictError(RuntimeError):
    pass


class EnvironmentAuthority:
    """Single durable registry; providers perform backend-specific side effects."""

    def __init__(self, path: str | Path, *, max_environments_per_owner: int = 8) -> None:
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._max_environments_per_owner = max_environments_per_owner
        with self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS canonical_images (
                    digest TEXT PRIMARY KEY, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS canonical_environments (
                    environment_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
                    state TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS canonical_environment_owner
                    ON canonical_environments(owner_id, state);
                CREATE TABLE IF NOT EXISTS canonical_snapshots (
                    snapshot_id TEXT PRIMARY KEY, environment_id TEXT NOT NULL,
                    parent_snapshot_id TEXT, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS canonical_environment_leases (
                    lease_id TEXT PRIMARY KEY, environment_id TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS canonical_environment_pools (
                    pool_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL
                );
                """
            )

    def register_image(
        self, *, source: str, os: str, architecture: str,
        content_digest: str, provenance: Dict[str, Any], scan_status: str,
    ) -> ImageRecord:
        if not content_digest.startswith("sha256:") or len(content_digest) != 71:
            raise ValueError("Image digest must be a sha256:<64 lowercase hex> value")
        try:
            int(content_digest[7:], 16)
        except ValueError as error:
            raise ValueError("Image digest contains non-hexadecimal characters") from error
        if scan_status not in {"clean", "failed", "pending", "unavailable"}:
            raise ValueError("Unsupported image scan status")
        record = ImageRecord(content_digest, source, os, architecture, provenance, scan_status, _iso(_now()))
        payload = json.dumps(asdict(record), sort_keys=True, separators=(",", ":"))
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT payload FROM canonical_images WHERE digest = ?", (content_digest,)
            ).fetchone()
            if existing and existing["payload"] != payload:
                raise EnvironmentConflictError("An immutable image digest was registered with different metadata")
            self._connection.execute(
                "INSERT OR IGNORE INTO canonical_images(digest, payload) VALUES (?, ?)",
                (content_digest, payload),
            )
        return record

    def image(self, digest: str) -> ImageRecord:
        row = self._connection.execute(
            "SELECT payload FROM canonical_images WHERE digest = ?", (digest,)
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown image {digest!r}")
        return ImageRecord(**json.loads(row["payload"]))

    def attest_image_scan(self, digest: str, scan_status: str, attestation: Dict[str, Any]) -> ImageRecord:
        if scan_status not in {"clean", "failed", "unavailable"}:
            raise ValueError("Final scan status must be clean, failed, or unavailable")
        with self._lock, self._connection:
            current = self.image(digest)
            provenance = {**current.provenance, "scan_attestation": attestation}
            updated = ImageRecord(
                current.digest, current.source, current.os, current.architecture,
                provenance, scan_status, current.created_at,
            )
            self._connection.execute(
                "UPDATE canonical_images SET payload = ? WHERE digest = ?",
                (json.dumps(asdict(updated), sort_keys=True, separators=(",", ":")), digest),
            )
        return updated

    def create_environment(
        self, *, owner_id: str, provider_id: str, os: str, isolation: str,
        image_digest: Optional[str], ttl_seconds: Optional[int], metadata: Dict[str, Any],
    ) -> EnvironmentRecord:
        if isolation not in {"host", "container", "vm"}:
            raise ValueError("Environment isolation must be host, container, or vm")
        network_policy = str(metadata.get("network_policy", "denied"))
        if network_policy not in {"denied", "allowlist", "unrestricted"}:
            raise ValueError("network_policy must be denied, allowlist, or unrestricted")
        sensitive = re.compile(r"(password|secret|token|api[_-]?key|authorization|cookie)", re.I)
        forbidden = [str(key) for key in metadata if sensitive.search(str(key)) and key != "secret_refs"]
        if forbidden:
            raise ValueError("Persist secret references, not literal secret metadata")
        metadata = {**metadata, "network_policy": network_policy}
        if image_digest:
            image = self.image(image_digest)
            if image.scan_status != "clean":
                raise EnvironmentConflictError("Only images with a clean scan may provision environments")
        now = _now()
        with self._lock, self._connection:
            active = self._connection.execute(
                "SELECT COUNT(*) count FROM canonical_environments "
                "WHERE owner_id = ? AND state NOT IN ('stopped', 'destroyed', 'failed')",
                (owner_id,),
            ).fetchone()["count"]
            if active >= self._max_environments_per_owner:
                raise EnvironmentConflictError("Environment quota exceeded")
            environment_id = f"environment_{uuid4().hex}"
            record = EnvironmentRecord(
                environment_id, owner_id, provider_id, os, isolation, "requested",
                image_digest, _iso(now), _iso(now),
                _iso(now + timedelta(seconds=ttl_seconds)) if ttl_seconds else None,
                metadata,
            )
            self._connection.execute(
                "INSERT INTO canonical_environments(environment_id, owner_id, state, payload) VALUES (?, ?, ?, ?)",
                (environment_id, owner_id, record.state, json.dumps(asdict(record), sort_keys=True)),
            )
        return record

    def create_pool(
        self, *, owner_id: str, provider_id: str, os: str, isolation: str,
        image_digest: Optional[str], maximum_size: int, metadata: Dict[str, Any],
    ) -> EnvironmentPoolRecord:
        if not 1 <= maximum_size <= self._max_environments_per_owner:
            raise ValueError("Pool maximum_size exceeds the owner quota")
        if image_digest:
            self.image(image_digest)
        record = EnvironmentPoolRecord(
            f"pool_{uuid4().hex}", owner_id, provider_id, os, isolation,
            image_digest, maximum_size, _iso(_now()), metadata,
        )
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT INTO canonical_environment_pools(pool_id, owner_id, payload) VALUES (?, ?, ?)",
                (record.pool_id, owner_id, json.dumps(asdict(record), sort_keys=True)),
            )
        return record

    def get_pool(self, pool_id: str) -> EnvironmentPoolRecord:
        row = self._connection.execute(
            "SELECT payload FROM canonical_environment_pools WHERE pool_id = ?", (pool_id,)
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown environment pool {pool_id!r}")
        return EnvironmentPoolRecord(**json.loads(row["payload"]))

    def allocate_from_pool(self, pool_id: str, *, ttl_seconds: Optional[int] = None) -> EnvironmentRecord:
        pool = self.get_pool(pool_id)
        with self._lock:
            pool_count = sum(
                1 for record in self.list_environments(pool.owner_id)
                if record.metadata.get("pool_id") == pool_id
                and record.state not in {"destroyed", "failed"}
            )
            if pool_count >= pool.maximum_size:
                raise EnvironmentConflictError("Environment pool capacity exceeded")
            return self.create_environment(
                owner_id=pool.owner_id, provider_id=pool.provider_id, os=pool.os,
                isolation=pool.isolation, image_digest=pool.image_digest,
                ttl_seconds=ttl_seconds, metadata={**pool.metadata, "pool_id": pool_id},
            )

    def get_environment(self, environment_id: str) -> EnvironmentRecord:
        row = self._connection.execute(
            "SELECT payload FROM canonical_environments WHERE environment_id = ?", (environment_id,)
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown environment {environment_id!r}")
        return EnvironmentRecord(**json.loads(row["payload"]))

    def list_environments(self, owner_id: Optional[str] = None) -> tuple[EnvironmentRecord, ...]:
        if owner_id:
            rows = self._connection.execute(
                "SELECT payload FROM canonical_environments WHERE owner_id = ? ORDER BY environment_id", (owner_id,)
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT payload FROM canonical_environments ORDER BY environment_id"
            ).fetchall()
        return tuple(EnvironmentRecord(**json.loads(row["payload"])) for row in rows)

    def transition(self, environment_id: str, state: str) -> EnvironmentRecord:
        allowed = {
            "requested": {"provisioning", "destroyed", "failed"},
            "provisioning": {"running", "failed", "destroyed"},
            "running": {"stopping", "failed"},
            "stopping": {"stopped", "failed"},
            "stopped": {"provisioning", "destroyed"},
            "failed": {"destroyed"}, "destroyed": set(),
        }
        with self._lock, self._connection:
            current = self.get_environment(environment_id)
            if state not in allowed.get(current.state, set()):
                raise EnvironmentConflictError(f"Invalid environment transition {current.state!r} -> {state!r}")
            updated = EnvironmentRecord(**{**asdict(current), "state": state, "updated_at": _iso(_now())})
            self._connection.execute(
                "UPDATE canonical_environments SET state = ?, payload = ? WHERE environment_id = ?",
                (state, json.dumps(asdict(updated), sort_keys=True), environment_id),
            )
        return updated

    def acquire_lease(
        self, environment_id: str, *, holder_id: str, kind: str, ttl_seconds: int,
    ) -> LeaseRecord:
        if kind not in {"agent", "human_takeover"}:
            raise ValueError("Lease kind must be agent or human_takeover")
        now = _now()
        expires = now + timedelta(seconds=ttl_seconds)
        with self._lock, self._connection:
            self.get_environment(environment_id)
            row = self._connection.execute(
                "SELECT expires_at FROM canonical_environment_leases WHERE environment_id = ?", (environment_id,)
            ).fetchone()
            if row and datetime.fromisoformat(row["expires_at"]) > now:
                raise EnvironmentConflictError("Environment already has an active exclusive lease")
            self._connection.execute(
                "DELETE FROM canonical_environment_leases WHERE environment_id = ?", (environment_id,)
            )
            record = LeaseRecord(
                f"lease_{uuid4().hex}", environment_id, holder_id, kind, _iso(now), _iso(expires)
            )
            self._connection.execute(
                "INSERT INTO canonical_environment_leases(lease_id, environment_id, expires_at, payload) VALUES (?, ?, ?, ?)",
                (record.lease_id, environment_id, record.expires_at, json.dumps(asdict(record), sort_keys=True)),
            )
        return record

    def create_snapshot(
        self, environment_id: str, *, backend_reference: str,
        parent_snapshot_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None,
    ) -> SnapshotRecord:
        environment = self.get_environment(environment_id)
        if environment.state not in {"running", "stopped"}:
            raise EnvironmentConflictError("Snapshots require a running or stopped environment")
        if parent_snapshot_id:
            self.get_snapshot(parent_snapshot_id)
        record = SnapshotRecord(
            f"snapshot_{uuid4().hex}", environment_id, parent_snapshot_id,
            backend_reference, "ready", _iso(_now()), metadata or {},
        )
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT INTO canonical_snapshots(snapshot_id, environment_id, parent_snapshot_id, payload) "
                "VALUES (?, ?, ?, ?)",
                (record.snapshot_id, environment_id, parent_snapshot_id, json.dumps(asdict(record), sort_keys=True)),
            )
        return record

    def get_snapshot(self, snapshot_id: str) -> SnapshotRecord:
        row = self._connection.execute(
            "SELECT payload FROM canonical_snapshots WHERE snapshot_id = ?", (snapshot_id,)
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown snapshot {snapshot_id!r}")
        return SnapshotRecord(**json.loads(row["payload"]))

    def list_snapshots(self, environment_id: str) -> tuple[SnapshotRecord, ...]:
        rows = self._connection.execute(
            "SELECT payload FROM canonical_snapshots WHERE environment_id = ? ORDER BY snapshot_id",
            (environment_id,),
        ).fetchall()
        return tuple(SnapshotRecord(**json.loads(row["payload"])) for row in rows)

    def clone_from_snapshot(
        self, snapshot_id: str, *, owner_id: str, ttl_seconds: Optional[int] = None,
    ) -> EnvironmentRecord:
        snapshot = self.get_snapshot(snapshot_id)
        source = self.get_environment(snapshot.environment_id)
        return self.create_environment(
            owner_id=owner_id, provider_id=source.provider_id, os=source.os,
            isolation=source.isolation, image_digest=source.image_digest,
            ttl_seconds=ttl_seconds,
            metadata={
                **source.metadata, "clone_source_snapshot_id": snapshot_id,
                "clone_backend_reference": snapshot.backend_reference,
            },
        )

    def cleanup_expired(self) -> Dict[str, int]:
        """Expire leases and identify TTL-expired environments without backend side effects."""
        now = _now()
        expired_environments = 0
        with self._lock, self._connection:
            expired_leases = self._connection.execute(
                "DELETE FROM canonical_environment_leases WHERE expires_at <= ?", (_iso(now),)
            ).rowcount
            rows = self._connection.execute(
                "SELECT payload FROM canonical_environments WHERE state NOT IN ('destroyed', 'failed')"
            ).fetchall()
            for row in rows:
                record = EnvironmentRecord(**json.loads(row["payload"]))
                if record.expires_at and datetime.fromisoformat(record.expires_at) <= now:
                    updated = EnvironmentRecord(**{
                        **asdict(record), "state": "stopping", "updated_at": _iso(now),
                        "metadata": {**record.metadata, "cleanup_reason": "ttl_expired"},
                    })
                    self._connection.execute(
                        "UPDATE canonical_environments SET state = ?, payload = ? WHERE environment_id = ?",
                        (updated.state, json.dumps(asdict(updated), sort_keys=True), updated.environment_id),
                    )
                    expired_environments += 1
        return {"expired_leases": expired_leases, "environments_pending_stop": expired_environments}

    def release_lease(self, lease_id: str, holder_id: str) -> None:
        with self._lock, self._connection:
            row = self._connection.execute(
                "SELECT payload FROM canonical_environment_leases WHERE lease_id = ?", (lease_id,)
            ).fetchone()
            if row is None:
                raise KeyError(f"Unknown lease {lease_id!r}")
            record = LeaseRecord(**json.loads(row["payload"]))
            if record.holder_id != holder_id:
                raise EnvironmentConflictError("Only the lease holder may release a lease")
            self._connection.execute("DELETE FROM canonical_environment_leases WHERE lease_id = ?", (lease_id,))

    def require_lease(self, environment_id: str, lease_id: str, holder_id: str) -> LeaseRecord:
        row = self._connection.execute(
            "SELECT payload FROM canonical_environment_leases WHERE lease_id = ? AND environment_id = ?",
            (lease_id, environment_id),
        ).fetchone()
        if row is None:
            raise EnvironmentConflictError("A matching environment lease is required")
        record = LeaseRecord(**json.loads(row["payload"]))
        if record.holder_id != holder_id:
            raise EnvironmentConflictError("Lease holder does not match")
        if datetime.fromisoformat(record.expires_at) <= _now():
            raise EnvironmentConflictError("Environment lease has expired")
        return record

    def close(self) -> None:
        self._connection.close()
