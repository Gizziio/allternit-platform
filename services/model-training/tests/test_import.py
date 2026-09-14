"""Smoke import test for the Model Lab service.

This test does NOT require Unsloth, torch, transformers, or datasets to be
installed. It verifies that the service modules can be imported and that
trainers/exporters only import heavy dependencies lazily inside functions.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

import config
import schemas
import store
import worker


def _module_has_top_level_unsloth(path: Path) -> bool:
    """Return True if a Python file imports unsloth at module top level."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                if alias.name == "unsloth" or alias.name.startswith("unsloth."):
                    return True
            if isinstance(node, ast.ImportFrom) and node.module and "unsloth" in node.module:
                return True
    return False


def test_service_modules_import() -> None:
    assert hasattr(config, "ensure_dirs")
    assert hasattr(schemas, "TrainingJob")
    assert hasattr(store, "JobStore")
    assert hasattr(worker, "TrainingWorker")


def test_trainers_import_unsloth_lazily() -> None:
    trainers_dir = Path(__file__).parent.parent / "trainers"
    exporters_dir = Path(__file__).parent.parent / "exporters"
    for path in (*trainers_dir.glob("*.py"), *exporters_dir.glob("*.py")):
        assert not _module_has_top_level_unsloth(path), f"{path} imports unsloth at top level"


def test_config_paths() -> None:
    assert config.DATA_DIR.name == "model-training"
    assert config.DEFAULT_PORT == 9020


if __name__ == "__main__":
    test_service_modules_import()
    test_trainers_import_unsloth_lazily()
    test_config_paths()
    print("model-training import smoke tests passed")
