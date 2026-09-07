#!/usr/bin/env python3
"""Start the ACU computer-use gateway for Allternit Desktop."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GATEWAY = ROOT / "gateway"
sys.path.insert(0, str(GATEWAY))
sys.path.insert(0, str(ROOT))
os.chdir(str(GATEWAY))

import uvicorn

if __name__ == "__main__":
    host = os.environ.get("ALLTERNIT_ACU_HOST", "127.0.0.1")
    port = int(os.environ.get("ALLTERNIT_ACU_PORT", "8760"))
    uvicorn.run("main:app", host=host, port=port, log_level="info")
