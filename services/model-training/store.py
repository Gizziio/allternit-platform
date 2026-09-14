"""Persistent job/dataset/checkpoint store.

The store uses plain JSON files so it can be inspected and repaired without
extra dependencies. Concurrent writes are serialized with a simple file lock.
"""

from __future__ import annotations

import fcntl
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from config import ARTIFACTS_DIR, DATASETS_DIR, JOBS_DIR, ensure_dirs
from schemas import CheckpointInfo, ExportInfo, TrainingJob, TrainingJobStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _job_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def _dataset_path(dataset_id: str) -> Path:
    return DATASETS_DIR / f"{dataset_id}.json"


def _export_path(export_id: str) -> Path:
    return ARTIFACTS_DIR / "exports" / f"{export_id}.json"


@contextmanager
def _locked(path: Path):
    """Advisory file lock for the duration of a block."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with open(lock_path, "w", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _load_json(path: Path) -> Optional[dict[str, Any]]:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_json(path: Path, data: dict[str, Any]) -> None:
    with _locked(path):
        tmp = path.with_suffix(path.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, default=str)
        tmp.replace(path)


class JobStore:
    """CRUD and listing for training jobs."""

    def __init__(self) -> None:
        ensure_dirs()

    def create_job(self, job: TrainingJob) -> TrainingJob:
        _save_json(_job_path(job.job_id), job.model_dump(mode="json"))
        return job

    def get_job(self, job_id: str) -> Optional[TrainingJob]:
        data = _load_json(_job_path(job_id))
        if data is None:
            return None
        return TrainingJob.model_validate(data)

    def update_job(self, job_id: str, **updates: Any) -> Optional[TrainingJob]:
        data = _load_json(_job_path(job_id))
        if data is None:
            return None
        data.update(updates)
        data["updated_at"] = _now().isoformat()
        _save_json(_job_path(job_id), data)
        return TrainingJob.model_validate(data)

    def list_jobs(self) -> list[TrainingJob]:
        jobs: list[TrainingJob] = []
        for path in sorted(JOBS_DIR.glob("*.json")):
            if path.suffixes and path.suffixes[-1] == ".lock":
                continue
            data = _load_json(path)
            if data is not None:
                try:
                    jobs.append(TrainingJob.model_validate(data))
                except Exception:
                    continue
        return jobs

    def delete_job(self, job_id: str) -> bool:
        path = _job_path(job_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def scan_checkpoints(self, job_id: str) -> list[CheckpointInfo]:
        """Discover checkpoint directories written by the training worker."""
        checkpoint_dir = ARTIFACTS_DIR / job_id / "checkpoints"
        if not checkpoint_dir.exists():
            return []
        checkpoints: list[CheckpointInfo] = []
        for path in sorted(checkpoint_dir.iterdir()):
            if not path.is_dir():
                continue
            meta_path = path / "checkpoint_info.json"
            step = 0
            epoch = 0.0
            created_at = _now()
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                    step = int(meta.get("step", 0))
                    epoch = float(meta.get("epoch", 0.0))
                    created_at = datetime.fromisoformat(meta.get("created_at", created_at.isoformat()))
                except Exception:
                    pass
            checkpoints.append(
                CheckpointInfo(
                    checkpoint_id=path.name,
                    path=str(path),
                    step=step,
                    epoch=epoch,
                    created_at=created_at,
                )
            )
        return checkpoints


class DatasetStore:
    """Dataset metadata and on-disk file tracking."""

    def __init__(self) -> None:
        ensure_dirs()

    def save_dataset(self, dataset_id: str, file_path: Path, rows: int, fmt: str) -> dict[str, Any]:
        record = {
            "dataset_id": dataset_id,
            "path": str(file_path),
            "rows": rows,
            "format": fmt,
            "created_at": _now().isoformat(),
        }
        _save_json(_dataset_path(dataset_id), record)
        return record

    def get_dataset(self, dataset_id: str) -> Optional[dict[str, Any]]:
        return _load_json(_dataset_path(dataset_id))

    def list_datasets(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for path in sorted(DATASETS_DIR.glob("*.json")):
            if path.suffixes and path.suffixes[-1] == ".lock":
                continue
            data = _load_json(path)
            if data is not None:
                out.append(data)
        return out


class ExportStore:
    """Track GGUF/MLX export jobs."""

    def __init__(self) -> None:
        ensure_dirs()
        (ARTIFACTS_DIR / "exports").mkdir(parents=True, exist_ok=True)

    def create(self, export: ExportInfo) -> ExportInfo:
        _save_json(_export_path(export.export_id), export.model_dump(mode="json"))
        return export

    def get(self, export_id: str) -> Optional[ExportInfo]:
        data = _load_json(_export_path(export_id))
        if data is None:
            return None
        return ExportInfo.model_validate(data)

    def update(self, export_id: str, **updates: Any) -> Optional[ExportInfo]:
        data = _load_json(_export_path(export_id))
        if data is None:
            return None
        data.update(updates)
        data["updated_at"] = _now().isoformat()
        _save_json(_export_path(export_id), data)
        return ExportInfo.model_validate(data)


def new_id(prefix: str = "id") -> str:
    """Generate a short, filesystem-safe identifier."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
