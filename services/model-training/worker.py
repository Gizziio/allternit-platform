"""Background training worker.

Jobs run in a subprocess so a training crash cannot bring down the HTTP
service. Progress is reported back through a small JSON state file.
"""

from __future__ import annotations

import asyncio
import json
import multiprocessing
import os
import signal
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from config import ARTIFACTS_DIR
from schemas import Hyperparameters, TrainingJob, TrainingJobStatus


class WorkerProgress:
    """File-backed progress reporter shared between worker subprocess and API."""

    def __init__(self, job_id: str) -> None:
        self._path = ARTIFACTS_DIR / job_id / "progress.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, **kwargs: Any) -> None:
        data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        data.update(kwargs)
        tmp = self._path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as file:
            json.dump(data, file, default=str)
        tmp.replace(self._path)

    def read(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        try:
            with open(self._path, "r", encoding="utf-8") as file:
                return json.load(file)
        except Exception:
            return {}


def _run_training_process(
    job_dict: dict[str, Any],
    on_step: Optional[Callable[[int, int, float, float], None]] = None,
) -> dict[str, Any]:
    """Entry point executed in the worker subprocess.

    Imports Unsloth/Transformers here so the parent process does not need them.
    """
    job = TrainingJob.model_validate(job_dict)
    hyperparams: Hyperparameters = job.hyperparameters
    progress = WorkerProgress(job.job_id)

    from pathlib import Path

    from config import DATASETS_DIR
    from store import new_id

    dataset_record_path = DATASETS_DIR / f"{job.dataset_id}.json"
    if not dataset_record_path.exists():
        raise FileNotFoundError(f"Dataset record not found: {job.dataset_id}")
    dataset_record = json.loads(dataset_record_path.read_text(encoding="utf-8"))
    dataset_path = Path(dataset_record["path"])
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

    artifact_dir = ARTIFACTS_DIR / job.job_id
    checkpoint_dir = artifact_dir / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    # Lazy import the trainer so the worker only loads heavy deps when needed.
    method = hyperparams.method
    if method == "lora":
        from trainers.lora import train_lora
    elif method == "qlora":
        from trainers.qlora import train_qlora
    elif method == "full":
        from trainers.full_finetune import train_full
    elif method == "dpo":
        from trainers.dpo import train_dpo
    else:
        raise ValueError(f"Unknown training method: {method}")

    progress.write(
        status=TrainingJobStatus.RUNNING.value,
        current_step=0,
        total_steps=0,
        progress_pct=0.0,
    )

    def step_callback(step: int, total_steps: int, loss: float, epoch: float) -> None:
        pct = (step / total_steps * 100.0) if total_steps else 0.0
        progress.write(
            status=TrainingJobStatus.RUNNING.value,
            current_step=step,
            total_steps=total_steps,
            progress_pct=round(pct, 2),
            current_loss=round(loss, 6),
            epoch=round(epoch, 4),
        )
        if on_step:
            on_step(step, total_steps, loss, epoch)

    output_path = artifact_dir / "adapter"
    train_fn = {"lora": train_lora, "qlora": train_qlora, "full": train_full, "dpo": train_dpo}[method]
    train_fn(
        base_model_id=job.base_model_id,
        dataset_path=dataset_path,
        hyperparameters=hyperparams,
        output_path=output_path,
        checkpoint_dir=checkpoint_dir,
        progress_callback=step_callback,
    )

    # Mark final checkpoint.
    final_checkpoint = checkpoint_dir / "final"
    final_checkpoint.mkdir(parents=True, exist_ok=True)
    (final_checkpoint / "checkpoint_info.json").write_text(
        json.dumps({"step": 0, "epoch": hyperparams.epochs, "created_at": datetime.now(timezone.utc).isoformat()}),
        encoding="utf-8",
    )

    return {
        "status": TrainingJobStatus.COMPLETED.value,
        "artifact_path": str(output_path),
        "progress_pct": 100.0,
    }


def _training_subprocess_main(job_dict: dict[str, Any]) -> None:
    """Wrapper that runs training and writes terminal status to progress file."""
    job_id = job_dict["job_id"]
    progress = WorkerProgress(job_id)
    try:
        result = _run_training_process(job_dict)
        progress.write(**result, status=TrainingJobStatus.COMPLETED.value)
    except Exception as exc:  # noqa: BLE001
        progress.write(
            status=TrainingJobStatus.FAILED.value,
            error_message=f"{exc}\n{traceback.format_exc()}",
        )
        sys.exit(1)


class TrainingWorker:
    """Manages the lifecycle of training subprocesses."""

    def __init__(self) -> None:
        self._processes: dict[str, multiprocessing.Process] = {}

    def start_job(self, job: TrainingJob) -> None:
        if job.job_id in self._processes and self._processes[job.job_id].is_alive():
            return
        process = multiprocessing.Process(
            target=_training_subprocess_main,
            args=(job.model_dump(mode="json"),),
            daemon=False,
        )
        process.start()
        self._processes[job.job_id] = process

    def cancel_job(self, job_id: str) -> bool:
        process = self._processes.get(job_id)
        if process is None or not process.is_alive():
            return False
        process.terminate()
        # Give the process a moment to shut down gracefully.
        process.join(timeout=5.0)
        if process.is_alive():
            os.kill(process.pid, signal.SIGKILL)
            process.join(timeout=2.0)
        progress = WorkerProgress(job_id)
        progress.write(status=TrainingJobStatus.CANCELLED.value)
        return True

    def is_running(self, job_id: str) -> bool:
        process = self._processes.get(job_id)
        return process is not None and process.is_alive()

    def reap_finished(self) -> None:
        for job_id, process in list(self._processes.items()):
            if not process.is_alive():
                process.join(timeout=0.1)
                del self._processes[job_id]


async def poll_progress_forever(interval: float = 2.0) -> None:
    """Coroutine that periodically reaps finished worker processes."""
    worker = TrainingWorker()
    while True:
        worker.reap_finished()
        await asyncio.sleep(interval)
