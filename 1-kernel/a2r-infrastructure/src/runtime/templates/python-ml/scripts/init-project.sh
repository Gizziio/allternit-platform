#!/bin/bash
# Python ML & Data Science Environment Initialization Script
# This script runs when the devcontainer is created or updated

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 A2R Python ML & Data Science Environment"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# -----------------------------------------------------------------------------
# 1. Check Environment
# -----------------------------------------------------------------------------
echo "📋 Environment Check"
echo "───────────────────────────────────────────────────────────────"

print_status "Python version: $(python --version 2>&1)"
print_status "Pip version: $(pip --version | cut -d' ' -f1-2)"
print_status "Poetry version: $(poetry --version 2>/dev/null || echo 'Not installed')"

# -----------------------------------------------------------------------------
# 2. Check GPU Availability
# -----------------------------------------------------------------------------
echo ""
echo "🎮 GPU Check"
echo "───────────────────────────────────────────────────────────────"

python -c "
import torch
if torch.cuda.is_available():
    print(f'✅ CUDA available: {torch.version.cuda}')
    print(f'✅ GPU count: {torch.cuda.device_count()}')
    for i in range(torch.cuda.device_count()):
        print(f'   GPU {i}: {torch.cuda.get_device_name(i)}')
else:
    print('⚠️  CUDA not available - running on CPU')
" 2>/dev/null || print_warning "PyTorch not installed or CUDA not available"

# -----------------------------------------------------------------------------
# 3. Create Directory Structure
# -----------------------------------------------------------------------------
echo ""
echo "📁 Creating Directory Structure"
echo "───────────────────────────────────────────────────────────────"

directories=(
    "/workspace/notebooks"
    "/workspace/src"
    "/workspace/data"
    "/workspace/data/raw"
    "/workspace/data/processed"
    "/workspace/models"
    "/workspace/models/checkpoints"
    "/workspace/models/exports"
    "/workspace/logs"
    "/workspace/tests"
    "/workspace/docs"
    "/workspace/config"
    "/workspace/mlruns"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created: $dir"
    else
        print_status "Exists: $dir"
    fi
done

# Set permissions
chmod -R 777 /workspace 2>/dev/null || true

# -----------------------------------------------------------------------------
# 4. Initialize Git (if not already initialized)
# -----------------------------------------------------------------------------
echo ""
echo "📦 Git Configuration"
echo "───────────────────────────────────────────────────────────────"

if [ ! -d "/workspace/.git" ]; then
    print_status "Initializing Git repository..."
    cd /workspace
    git init
    
    # Create .gitignore
    cat > /workspace/.gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
venv/
ENV/
env/
.venv

# Jupyter
.ipynb_checkpoints
*.ipynb_checkpoints
.jupyter/

# Data
*.csv
*.parquet
*.h5
*.hdf5
*.pkl
*.pickle
*.joblib
data/raw/*
data/processed/*
!data/raw/.gitkeep
!data/processed/.gitkeep

# Models
models/checkpoints/*
models/exports/*
!models/checkpoints/.gitkeep
!models/exports/.gitkeep
*.pt
*.pth
*.onnx
*.pb
*.h5
saved_model/

# Logs
logs/
*.log
tensorboard_logs/
wandb/
mlruns/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local
secrets.yaml
secrets.json

# Poetry
poetry.lock

# MLflow
mlartifacts/
EOF
    
    # Create .gitkeep files
    touch /workspace/data/raw/.gitkeep
    touch /workspace/data/processed/.gitkeep
    touch /workspace/models/checkpoints/.gitkeep
    touch /workspace/models/exports/.gitkeep
    
    print_success "Git repository initialized"
else
    print_status "Git repository already exists"
fi

# Configure git if not already configured
if ! git config user.email > /dev/null 2>&1; then
    git config --global user.email "developer@a2r.local"
    git config --global user.name "A2R Developer"
    print_status "Git user configured"
fi

# -----------------------------------------------------------------------------
# 5. Setup Python Environment
# -----------------------------------------------------------------------------
echo ""
echo "🐍 Python Environment Setup"
echo "───────────────────────────────────────────────────────────────"

# Set PYTHONPATH
export PYTHONPATH="/workspace/src:${PYTHONPATH}"
print_status "PYTHONPATH set to: $PYTHONPATH"

# Create __init__.py files for src package
if [ -d "/workspace/src" ] && [ ! -f "/workspace/src/__init__.py" ]; then
    touch /workspace/src/__init__.py
    print_success "Created src/__init__.py"
fi

# -----------------------------------------------------------------------------
# 6. Check ML Services
# -----------------------------------------------------------------------------
echo ""
echo "🔌 Checking ML Services"
echo "───────────────────────────────────────────────────────────────"

# Check MLflow
if curl -s http://mlflow:5000/health > /dev/null 2>&1; then
    print_success "MLflow: Connected (http://mlflow:5000)"
else
    print_warning "MLflow: Not reachable (will be available when mlflow service starts)"
fi

# Check PostgreSQL
if pg_isready -h postgres -p 5432 -U mlflow > /dev/null 2>&1; then
    print_success "PostgreSQL: Connected"
else
    print_warning "PostgreSQL: Not reachable (will be available when postgres service starts)"
fi

# Check Redis
if redis-cli -h redis ping > /dev/null 2>&1; then
    print_success "Redis: Connected"
else
    print_warning "Redis: Not reachable (will be available when redis service starts)"
fi

# -----------------------------------------------------------------------------
# 7. Create Sample Files
# -----------------------------------------------------------------------------
echo ""
echo "📝 Creating Sample Files"
echo "───────────────────────────────────────────────────────────────"

# Create sample Python module
if [ ! -f "/workspace/src/utils.py" ]; then
    cat > /workspace/src/utils.py << 'EOF'
"""
Utility functions for ML projects.
"""
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import torch


def setup_logging(log_dir: str = "/workspace/logs", level: int = logging.INFO) -> logging.Logger:
    """Setup logging configuration."""
    Path(log_dir).mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(f"{log_dir}/app.log"),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


def get_device() -> torch.device:
    """Get the best available device (CUDA if available, else CPU)."""
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"🎮 Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("⚠️  Using CPU")
    return device


def save_config(config: Dict[str, Any], path: str) -> None:
    """Save configuration to YAML file."""
    import yaml
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)


def load_config(path: str) -> Dict[str, Any]:
    """Load configuration from YAML file."""
    import yaml
    with open(path, "r") as f:
        return yaml.safe_load(f)
EOF
    print_success "Created: src/utils.py"
fi

# Create sample test
if [ ! -f "/workspace/tests/test_utils.py" ]; then
    cat > /workspace/tests/test_utils.py << 'EOF'
"""
Tests for utility functions.
"""
import pytest
import torch

from src.utils import get_device


def test_get_device():
    """Test device detection."""
    device = get_device()
    assert isinstance(device, torch.device)
    assert device.type in ["cpu", "cuda"]


def test_device_is_cuda_if_available():
    """Test that CUDA is returned if available."""
    if torch.cuda.is_available():
        device = get_device()
        assert device.type == "cuda"
EOF
    print_success "Created: tests/test_utils.py"
fi

# Create README if not exists
if [ ! -f "/workspace/README.md" ]; then
    cat > /workspace/README.md << 'EOF'
# ML Project

This is a Machine Learning project using the A2R Python ML & Data Science Environment.

## Quick Start

1. Open `notebooks/welcome.ipynb` to explore the environment
2. Create your notebooks in the `notebooks/` directory
3. Add your Python modules to the `src/` directory
4. Store datasets in `data/raw/` and processed data in `data/processed/`
5. Save trained models to `models/checkpoints/`

## Project Structure

```
.
├── notebooks/          # Jupyter notebooks
├── src/               # Python source code
├── data/              # Data files
│   ├── raw/          # Raw data
│   └── processed/    # Processed data
├── models/            # Saved models
│   ├── checkpoints/  # Model checkpoints
│   └── exports/      # Exported models
├── tests/             # Unit tests
├── logs/              # Log files
├── docs/              # Documentation
└── config/            # Configuration files
```

## Available Services

- **JupyterLab**: http://localhost:8888
- **MLflow**: http://localhost:5000
- **TensorBoard**: http://localhost:6006
- **MinIO**: http://localhost:9001

## Dependencies

This project uses Poetry for dependency management. See `pyproject.toml.template` for details.

## Running Tests

```bash
pytest tests/
```

## Experiment Tracking

Experiments are automatically logged to MLflow at http://localhost:5000
EOF
    print_success "Created: README.md"
fi

# -----------------------------------------------------------------------------
# 8. Final Summary
# -----------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Environment Ready!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📚 Quick Links:"
echo "   • JupyterLab:    http://localhost:8888"
echo "   • MLflow UI:     http://localhost:5000"
echo "   • TensorBoard:   http://localhost:6006"
echo ""
echo "💡 Tips:"
echo "   • Start with notebooks/welcome.ipynb"
echo "   • Use Poetry: poetry init && poetry add <package>"
echo "   • Track experiments with MLflow"
echo "   • Run tests: pytest tests/"
echo ""
echo "🚀 Happy Coding!"
echo "═══════════════════════════════════════════════════════════════"
