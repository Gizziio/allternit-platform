"""Model Lab async HTTP service.

Exposes endpoints for dataset upload, training job management, checkpoint
listing, and GGUF/MLX export. Training happens in a background subprocess
managed by `worker.TrainingWorker`.
"""

from __future__ import annotations

import csv
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from config import (
    BASE_MODEL_CATALOG,
    DATASETS_DIR,
    DEFAULT_HOST,
    DEFAULT_PORT,
    ensure_dirs,
)
from schemas import (
    BaseModelInfo,
    DatasetUploadResponse,
    ExportInfo,
    ExportRequest,
    ExportTarget,
    Hyperparameters,
    LossPoint,
    TrainingJob,
    TrainingJobCreate,
    TrainingJobStatus,
)
from store import DatasetStore, ExportStore, JobStore, new_id
from worker import TrainingWorker, WorkerProgress, poll_progress_forever

# Global worker/store instances are initialized in lifespan.
_worker: Optional[TrainingWorker] = None
_job_store: Optional[JobStore] = None
_dataset_store: Optional[DatasetStore] = None
_export_store: Optional[ExportStore] = None


@asynccontextmanager
async def _lifespan(app: FastAPI):  # noqa: ARG001
    global _worker, _job_store, _dataset_store, _export_store
    ensure_dirs()
    _worker = TrainingWorker()
    _job_store = JobStore()
    _dataset_store = DatasetStore()
    _export_store = ExportStore()
    task = asyncio.create_task(poll_progress_forever())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Allternit Model Lab", version="0.1.0", lifespan=_lifespan)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "model-lab"}


@app.get("/base-models", response_model=list[BaseModelInfo])
async def list_base_models() -> list[BaseModelInfo]:
    return [BaseModelInfo(**model) for model in BASE_MODEL_CATALOG]


@app.post("/datasets", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),  # noqa: B008
    name: Optional[str] = Form(default=None),
) -> DatasetUploadResponse:
    ext = Path(file.filename or "dataset.jsonl").suffix.lower()
    if ext not in {".jsonl", ".csv"}:
        raise HTTPException(status_code=400, detail="Only JSONL and CSV uploads are supported.")

    dataset_id = new_id("dataset")
    file_path = DATASETS_DIR / f"{dataset_id}{ext}"
    rows = 0
    try:
        with open(file_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                out.write(chunk)
        with open(file_path, "r", encoding="utf-8") as handle:
            if ext == ".csv":
                rows = sum(1 for _ in csv.reader(handle))
            else:
                rows = sum(1 for _ in handle)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {exc}") from exc

    _dataset_store.save_dataset(
        dataset_id=dataset_id,
        file_path=file_path,
        rows=max(rows - 1 if ext == ".csv" else rows, 0),
        fmt=ext.lstrip("."),
    )
    return DatasetUploadResponse(
        dataset_id=dataset_id,
        path=str(file_path),
        rows=rows,
        format=ext.lstrip("."),  # type: ignore[arg-type]
    )


@app.get("/jobs", response_model=list[TrainingJob])
async def list_jobs() -> list[TrainingJob]:
    jobs = _job_store.list_jobs()
    return [_sync_job_status(job) for job in jobs]


@app.post("/jobs", response_model=TrainingJob)
async def create_job(create: TrainingJobCreate) -> TrainingJob:
    dataset = _dataset_store.get_dataset(create.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    job_id = new_id("job")
    now = _now()
    job = TrainingJob(
        job_id=job_id,
        name=create.name or f"job-{now.isoformat(timespec='seconds')}",
        base_model_id=create.base_model_id,
        dataset_id=create.dataset_id,
        hyperparameters=create.hyperparameters,
        status=TrainingJobStatus.PENDING,
        created_at=now,
        updated_at=now,
    )
    _job_store.create_job(job)

    # Transition to preparing and start worker.
    _job_store.update_job(job_id, status=TrainingJobStatus.PREPARING.value)
    _worker.start_job(job)
    return _sync_job_status(job)


@app.get("/jobs/{job_id}", response_model=TrainingJob)
async def get_job(job_id: str) -> TrainingJob:
    job = _job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _sync_job_status(job)


@app.post("/jobs/{job_id}/cancel", response_model=TrainingJob)
async def cancel_job(job_id: str) -> TrainingJob:
    job = _job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    _worker.cancel_job(job_id)
    updated = _job_store.update_job(job_id, status=TrainingJobStatus.CANCELLED.value)
    return _sync_job_status(updated or job)


@app.get("/jobs/{job_id}/checkpoints")
async def list_checkpoints(job_id: str) -> dict[str, list[dict]]:
    job = _job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    checkpoints = _job_store.scan_checkpoints(job_id)
    _job_store.update_job(job_id, checkpoints=[c.model_dump(mode="json") for c in checkpoints])
    return {"checkpoints": [c.model_dump(mode="json") for c in checkpoints]}


@app.post("/jobs/{job_id}/export", response_model=ExportInfo)
async def export_job(job_id: str, request: ExportRequest) -> ExportInfo:
    job = _job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != TrainingJobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job must be completed before export")

    export_id = new_id("export")
    now = _now()
    export = ExportInfo(
        export_id=export_id,
        job_id=job_id,
        target=request.target,
        status=TrainingJobStatus.PENDING,
        created_at=now,
        updated_at=now,
    )
    _export_store.create(export)

    # Run export in a thread so the API stays async.
    import asyncio

    async def _do_export() -> None:
        try:
            _export_store.update(export_id, status=TrainingJobStatus.RUNNING.value)
            adapter_path = Path(job.artifact_path)
            output_dir = Path(job.artifact_path).parent / f"export-{request.target.value}"
            if request.target == ExportTarget.GGUF:
                from exporters.gguf import export_gguf
                export_gguf(adapter_path, output_dir, quantization=request.quantization)
            elif request.target == ExportTarget.MLX:
                from exporters.mlx import export_mlx
                export_mlx(adapter_path, output_dir)
            else:
                raise ValueError(f"Unsupported export target: {request.target}")
            _export_store.update(
                export_id,
                status=TrainingJobStatus.COMPLETED.value,
                output_path=str(output_dir),
            )
        except Exception as exc:
            _export_store.update(export_id, status=TrainingJobStatus.FAILED.value, error_message=str(exc))

    asyncio.create_task(_do_export())
    return export


@app.get("/exports/{export_id}", response_model=ExportInfo)
async def get_export(export_id: str) -> ExportInfo:
    export = _export_store.get(export_id)
    if export is None:
        raise HTTPException(status_code=404, detail="Export not found")
    return export


def _sync_job_status(job: TrainingJob) -> TrainingJob:
    """Merge worker progress file into the persisted job record."""
    progress = WorkerProgress(job.job_id).read()
    updates: dict = {}
    if progress:
        status_str = progress.get("status")
        if status_str:
            try:
                updates["status"] = TrainingJobStatus(status_str).value
            except ValueError:
                pass
        for key in ("current_step", "total_steps", "progress_pct", "current_loss"):
            if key in progress:
                updates[key] = progress[key]
        if "error_message" in progress:
            updates["error_message"] = progress["error_message"]
        if "artifact_path" in progress:
            updates["artifact_path"] = progress["artifact_path"]
        if "current_loss" in progress:
            point = LossPoint(
                step=progress.get("current_step", 0),
                loss=progress["current_loss"],
                epoch=progress.get("epoch", 0.0),
                timestamp=_now(),
            )
            loss_history = list(job.loss_history)
            loss_history.append(point)
            updates["loss_history"] = [l.model_dump(mode="json") for l in loss_history]

    # Re-scan checkpoints each time the job is read.
    checkpoints = _job_store.scan_checkpoints(job.job_id)
    updates["checkpoints"] = [c.model_dump(mode="json") for c in checkpoints]

    if updates:
        updated = _job_store.update_job(job.job_id, **updates)
        if updated is not None:
            return updated
    return job


def main() -> None:
    import uvicorn

    ensure_dirs()
    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT)


if __name__ == "__main__":
    main()
