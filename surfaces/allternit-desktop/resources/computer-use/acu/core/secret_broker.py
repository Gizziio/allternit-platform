"""Reference-only secret resolution for environment operations."""

from __future__ import annotations

import os
import re
from typing import Dict


SAFE_REFERENCE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")


class SecretBroker:
    """Resolve references from the daemon environment without persistence."""

    def resolve(self, references: Dict[str, str]) -> Dict[str, str]:
        resolved: Dict[str, str] = {}
        for variable, reference in references.items():
            if not variable or not SAFE_REFERENCE.fullmatch(reference):
                raise ValueError("Secret references must use safe 1-128 character identifiers")
            key = "ALLTERNIT_SECRET_" + re.sub(r"[^A-Za-z0-9]", "_", reference).upper()
            value = os.environ.get(key)
            if value is None:
                raise KeyError(f"Secret reference {reference!r} is unavailable")
            resolved[variable] = value
        return resolved
