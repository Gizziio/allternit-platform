"""Pydantic request/response schemas for the Model Lab service."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class TrainingMethod(str, Enum):
    LORA = "lora"
    QLORA = "qlora"
    FULL = "full"
    DPO = "dpo"


class ExportTarget(str, Enum):
    GGUF = "gguf"
    MLX = "mlx"


class Hyperparameters(BaseModel):
    method: TrainingMethod = TrainingMethod.LORA
    r: int = Field(default=16, ge=1, le=512)
    alpha: int = Field(default=16, ge=1, le=1024)
    target_modules: list[str] = Field(
        default=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ]
    )
    learning_rate: float = Field(default=2e-4, gt=0)
    epochs: int = Field(default=1, ge=1)
    max_steps: int = Field(default=-1, ge=-1)
    per_device_batch_size: int = Field(default=2, ge=1)
    gradient_accumulation_steps: int = Field(default=4, ge=1)
    warmup_steps: int = Field(default=5, ge=0)
    weight_decay: float = Field(default=0.01, ge=0)
    max_seq_length: int = Field(default=2048, ge=64)
    seed: int = Field(default=42, ge=0)


class BaseModelInfo(BaseModel):
    id: str
    name: str
    size: str


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    path: str
    rows: int
    format: Literal["jsonl", "csv"]


class TrainingJobCreate(BaseModel):
    base_model_id: str
    dataset_id: str
    name: Optional[str] = None
    hyperparameters: Hyperparameters = Field(default_factory=Hyperparameters)

    @field_validator("name")
    @classmethod
    def _default_name(cls, value: Optional[str]) -> str:
        if not value:
            return f"job-{datetime.utcnow().isoformat(timespec='seconds')}"
        return value


class TrainingJobStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LossPoint(BaseModel):
    step: int
    loss: float
    epoch: float
    timestamp: datetime


class CheckpointInfo(BaseModel):
    checkpoint_id: str
    path: str
    step: int
    epoch: float
    created_at: datetime


class TrainingJob(BaseModel):
    job_id: str
    name: str
    base_model_id: str
    dataset_id: str
    hyperparameters: Hyperparameters
    status: TrainingJobStatus
    created_at: datetime
    updated_at: datetime
    progress_pct: float = 0.0
    current_step: int = 0
    total_steps: int = 0
    current_loss: Optional[float] = None
    loss_history: list[LossPoint] = Field(default_factory=list)
    error_message: Optional[str] = None
    artifact_path: Optional[str] = None
    checkpoints: list[CheckpointInfo] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExportRequest(BaseModel):
    target: ExportTarget
    quantization: Optional[str] = Field(
        default=None,
        description="GGUF quantization, e.g. q4_k_m. Ignored for MLX.",
    )


class ExportInfo(BaseModel):
    export_id: str
    job_id: str
    target: ExportTarget
    status: TrainingJobStatus
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
