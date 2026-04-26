"""
Allternit Computer Use Operator — Runtime Entrypoint
Re-housed from 4-services/allternit-operator/
Launches as package to support relative imports.
"""
import uvicorn
import os
import sys
import importlib

# Ensure operator dir is on path so 'src' is importable as a package
operator_dir = os.path.dirname(os.path.abspath(__file__))
if operator_dir not in sys.path:
    sys.path.insert(0, operator_dir)

# Import as package module (supports relative imports in src/)
mod = importlib.import_module("src.main")
app = mod.app
SERVICE_HOST = getattr(mod, "SERVICE_HOST", "0.0.0.0")
SERVICE_PORT = getattr(mod, "SERVICE_PORT", 3010)

if __name__ == "__main__":
    port = int(os.environ.get("Allternit_OPERATOR_PORT", SERVICE_PORT))
    host = os.environ.get("Allternit_OPERATOR_HOST", SERVICE_HOST)
    uvicorn.run(app, host=host, port=port)
