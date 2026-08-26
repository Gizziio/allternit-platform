"""Model Lab service configuration.

All training jobs and artifacts are stored under the user's Allternit data
directory so the service stays stateless and portable.
"""

from __future__ import annotations

import os
from pathlib import Path


def _default_data_dir() -> Path:
    """Return ~/.allternit/model-training/ as the default workspace."""
    home = Path.home()
    return home / ".allternit" / "model-training"


DATA_DIR = Path(
    os.environ.get("ALLTERNIT_MODEL_TRAINING_DIR", _default_data_dir())
)
JOBS_DIR = DATA_DIR / "jobs"
DATASETS_DIR = DATA_DIR / "datasets"
ARTIFACTS_DIR = DATA_DIR / "artifacts"

DEFAULT_HOST = os.environ.get("ALLTERNIT_MODEL_TRAINING_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("ALLTERNIT_MODEL_TRAINING_PORT", "9020"))

# Default training hyperparameters. These mirror Unsloth's documented
# starting points for 7B-class models on consumer GPUs.
DEFAULT_HYPERPARAMETERS = {
    "method": "lora",
    "r": 16,
    "alpha": 16,
    "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj",
                       "gate_proj", "up_proj", "down_proj"],
    "learning_rate": 2e-4,
    "epochs": 1,
    "max_steps": -1,  # -1 means derive from epochs
    "per_device_batch_size": 2,
    "gradient_accumulation_steps": 4,
    "warmup_steps": 5,
    "weight_decay": 0.01,
    "max_seq_length": 2048,
    "seed": 42,
}

# Curated list of base models known to work with Unsloth. The user can also
# supply any Hugging Face model id that Unsloth supports.
BASE_MODEL_CATALOG = [
    {"id": "unsloth/Llama-3.2-3B-Instruct", "name": "Llama 3.2 3B Instruct", "size": "3B"},
    {"id": "unsloth/Llama-3.1-8B-Instruct", "name": "Llama 3.1 8B Instruct", "size": "8B"},
    {"id": "unsloth/Mistral-7B-Instruct-v0.3", "name": "Mistral 7B Instruct v0.3", "size": "7B"},
    {"id": "unsloth/Phi-4", "name": "Phi-4", "size": "14B"},
    {"id": "unsloth/Qwen2.5-7B-Instruct", "name": "Qwen2.5 7B Instruct", "size": "7B"},
    {"id": "unsloth/gemma-2-9b-it", "name": "Gemma 2 9B IT", "size": "9B"},
]


def ensure_dirs() -> None:
    """Create the training workspace directories."""
    for directory in (DATA_DIR, JOBS_DIR, DATASETS_DIR, ARTIFACTS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
