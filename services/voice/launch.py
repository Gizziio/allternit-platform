#!/usr/bin/env python3
"""
Native Voice Service Launcher
Starts the voice service without Docker
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def check_venv():
    """Check if we're in a virtual environment"""
    return hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)

def setup_venv(venv_path: Path):
    """Create and setup virtual environment"""
    if not venv_path.exists():
        print(f"Creating virtual environment at {venv_path}...")
        subprocess.run([sys.executable, "-m", "venv", str(venv_path)], check=True)
    
    # Get pip path
    if sys.platform == "win32":
        pip_path = venv_path / "Scripts" / "pip"
        python_path = venv_path / "Scripts" / "python"
    else:
        pip_path = venv_path / "bin" / "pip"
        python_path = venv_path / "bin" / "python"
    
    return python_path, pip_path

def install_deps(pip_path: Path, api_dir: Path):
    """Install dependencies"""
    req_file = api_dir / "requirements.txt"
    if req_file.exists():
        print("Installing dependencies...")
        subprocess.run([str(pip_path), "install", "-r", str(req_file)], check=True)

def download_models(python_path: Path, api_dir: Path):
    """Download voice models on first run"""
    print("Checking voice models...")
    # Models are downloaded on-demand by TTS library
    pass

def main():
    parser = argparse.ArgumentParser(description="Launch Voice Service")
    parser.add_argument("--port", default="8001", help="Port to run on")
    parser.add_argument("--preload", action="store_true", help="Preload models on startup")
    parser.add_argument("--setup", action="store_true", help="Setup environment and exit")
    args = parser.parse_args()
    
    # Paths
    service_dir = Path(__file__).parent.absolute()
    venv_path = service_dir / ".venv"
    api_dir = service_dir / "api"
    
    # Setup environment
    python_path, pip_path = setup_venv(venv_path)
    
    if args.setup:
        install_deps(pip_path, api_dir)
        print("Setup complete!")
        return
    
    # Check if already in venv
    if not check_venv():
        # Re-run with venv python
        print(f"Activating virtual environment...")
        os.execv(str(python_path), [str(python_path), __file__] + sys.argv[1:])
    
    # Install deps if needed
    try:
        import fastapi
    except ImportError:
        install_deps(pip_path, api_dir)
    
    # Set environment
    os.environ["PORT"] = args.port
    os.environ["AUDIO_OUTPUT_DIR"] = "/tmp/voice-service"
    os.environ["PRELOAD_MODEL"] = "true" if args.preload else "false"
    
    # Create output directory
    os.makedirs("/tmp/voice-service", exist_ok=True)
    
    # Start service
    print(f"🎙️  Starting Voice Service on port {args.port}...")
    print(f"   API Directory: {api_dir}")
    print(f"   Preload models: {args.preload}")
    print()
    
    os.chdir(api_dir)
    cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", "0.0.0.0",
        "--port", args.port,
    ]
    if os.environ.get("DEV"):
        cmd.append("--reload")
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
