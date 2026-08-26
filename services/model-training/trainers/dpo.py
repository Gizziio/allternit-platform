"""DPO (Direct Preference Optimization) trainer backed by Unsloth.

Expects a dataset with `prompt`, `chosen`, and `rejected` fields.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

from schemas import Hyperparameters


def train_dpo(
    base_model_id: str,
    dataset_path: Path,
    hyperparameters: Hyperparameters,
    output_path: Path,
    checkpoint_dir: Path,
    progress_callback: Optional[Callable[[int, int, float, float], None]] = None,
) -> None:
    """Train a model with DPO using Unsloth."""
    from datasets import load_dataset
    from transformers import TrainingArguments
    from trl import DPOTrainer
    from unsloth import FastLanguageModel

    max_seq_length = hyperparameters.max_seq_length
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model_id,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=hyperparameters.r,
        target_modules=hyperparameters.target_modules,
        lora_alpha=hyperparameters.alpha,
        lora_dropout=0.0,
        use_rslora=False,
        use_gradient_checkpointing="unsloth",
        random_state=hyperparameters.seed,
    )

    if dataset_path.suffix == ".csv":
        dataset = load_dataset("csv", data_files=str(dataset_path), split="train")
    else:
        dataset = load_dataset("json", data_files=str(dataset_path), split="train")

    # Validate required columns.
    columns = set(dataset.column_names)
    for required in ("prompt", "chosen", "rejected"):
        if required not in columns:
            raise ValueError(f"DPO dataset must contain a '{required}' column. Got: {columns}")

    total_steps = hyperparameters.max_steps
    if total_steps <= 0:
        total_steps = len(dataset) * hyperparameters.epochs // (
            hyperparameters.per_device_batch_size * hyperparameters.gradient_accumulation_steps
        )
        total_steps = max(total_steps, 1)

    class _ProgressCallback:
        def __init__(self) -> None:
            self.epoch = 0.0

        def on_train_begin(self, args, state, control, **kwargs):  # noqa: ANN001, ARG002
            self.epoch = 0.0

        def on_step_end(self, args, state, control, **kwargs):  # noqa: ANN001
            if state.global_step and progress_callback:
                progress_callback(
                    state.global_step,
                    state.max_steps,
                    float(state.log_history[-1].get("loss", 0.0)) if state.log_history else 0.0,
                    self.epoch,
                )

        def on_epoch_end(self, args, state, control, **kwargs):  # noqa: ANN001, ARG002
            self.epoch += 1.0

    args = TrainingArguments(
        per_device_train_batch_size=hyperparameters.per_device_batch_size,
        gradient_accumulation_steps=hyperparameters.gradient_accumulation_steps,
        warmup_steps=hyperparameters.warmup_steps,
        max_steps=total_steps,
        learning_rate=hyperparameters.learning_rate,
        fp16=False,
        bf16=False,
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=hyperparameters.weight_decay,
        lr_scheduler_type="linear",
        seed=hyperparameters.seed,
        output_dir=str(checkpoint_dir),
        save_strategy="steps",
        save_steps=max(total_steps // 4, 1),
        report_to="none",
    )

    trainer = DPOTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=args,
        callbacks=[_ProgressCallback()],
    )
    trainer.train()

    model.save_pretrained(str(output_path))
    tokenizer.save_pretrained(str(output_path))
