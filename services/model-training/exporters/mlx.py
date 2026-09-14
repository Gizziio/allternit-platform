"""MLX export helper.

Converts a Unsloth-trained adapter into Apple MLX format. `mlx-lm` is imported
lazily so the service can start without the heavy dependency stack installed.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


def export_mlx(
    adapter_path: Path,
    output_path: Path,
    **kwargs: Any,
) -> Path:
    """Export a trained adapter to Apple MLX format.

    Uses mlx-lm's fuse helper to merge LoRA weights back into the base model
    and save an MLX-compatible directory.
    """
    from mlx_lm import fuse, load

    output_path.mkdir(parents=True, exist_ok=True)
    model, tokenizer = load(str(adapter_path))
    fuse(
        model=model,
        tokenizer=tokenizer,
        save_path=str(output_path),
        **{k: v for k, v in kwargs.items() if k in {"de_quantize"}},
    )
    return output_path
