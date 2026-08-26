"""GGUF export helper.

Wraps Unsloth's llama.cpp-compatible export path. `unsloth` is imported lazily
inside the export function so the service can start without it.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


def export_gguf(
    adapter_path: Path,
    output_path: Path,
    quantization: Optional[str] = None,
    **kwargs: Any,
) -> Path:
    """Export a trained adapter to GGUF via Unsloth.

    Args:
        adapter_path: Directory containing the saved LoRA/full-finetune adapter.
        output_path: Destination directory for the GGUF file.
        quantization: GGUF quantization string, e.g. "q4_k_m".
    """
    from unsloth import FastLanguageModel

    output_path.mkdir(parents=True, exist_ok=True)
    quantization = quantization or "q4_k_m"

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(adapter_path),
        max_seq_length=kwargs.get("max_seq_length", 2048),
        dtype=None,
        load_in_4bit=False,
    )
    model.save_pretrained_gguf(
        str(output_path),
        tokenizer,
        quantization_method=quantization,
    )
    return output_path
