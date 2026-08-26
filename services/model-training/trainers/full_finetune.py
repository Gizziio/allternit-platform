"""Full fine-tune trainer backed by Unsloth.

This uses Unsloth's FastLanguageModel in full-finetune mode (no LoRA).
Because full fine-tuning requires substantially more memory, it is best
suited to small models or high-RAM machines.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

from schemas import Hyperparameters


def train_full(
    base_model_id: str,
    dataset_path: Path,
    hyperparameters: Hyperparameters,
    output_path: Path,
    checkpoint_dir: Path,
    progress_callback: Optional[Callable[[int, int, float, float], None]] = None,
) -> None:
    """Fully fine-tune a base model using Unsloth."""
    from datasets import load_dataset
    from transformers import TrainingArguments
    from trl import SFTTrainer
    from unsloth import FastLanguageModel

    max_seq_length = hyperparameters.max_seq_length
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model_id,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=False,
    )
    # For full fine-tune we do not apply PEFT.

    def _format_example(example: dict) -> str:
        text = example.get("text", "")
        if not text and "instruction" in example:
            instruction = example.get("instruction", "")
            input_text = example.get("input", "")
            response = example.get("output", "")
            text = f"### Instruction:\n{instruction}\n"
            if input_text:
                text += f"### Input:\n{input_text}\n"
            text += f"### Response:\n{response}"
        return text

    if dataset_path.suffix == ".csv":
        dataset = load_dataset("csv", data_files=str(dataset_path), split="train")
    else:
        dataset = load_dataset("json", data_files=str(dataset_path), split="train")
    dataset = dataset.map(lambda example: {"text": _format_example(example)})

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
        fp16=not model.config.is_bf16 or not model.config.is_fp16,
        bf16=model.config.is_bf16,
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

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        args=args,
        callbacks=[_ProgressCallback()],
    )
    trainer.train()

    model.save_pretrained(str(output_path))
    tokenizer.save_pretrained(str(output_path))
