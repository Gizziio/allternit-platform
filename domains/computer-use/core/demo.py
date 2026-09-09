#!/usr/bin/env python3
"""One-command demo for the Allternit Computer Use gateway.

Docker-free: starts the gateway on a free localhost port with the mock
vision provider (unless one is already configured), mounts the self-
contained demo UI at /demo, prints the URL, and opens it in a browser.

Usage:
    python demo.py                # free port, opens browser
    python demo.py --port 8991    # fixed port
    python demo.py --no-open      # print URL only

Environment honored:
    ALLTERNIT_VISION_PROVIDER     # set to use a real provider instead of mock
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GATEWAY = ROOT / "gateway"


def _find_free_port(host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Allternit Computer Use — one-command demo")
    parser.add_argument("--host", default=os.environ.get("ALLTERNIT_ACU_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=0, help="0 = pick a free port (default)")
    parser.add_argument("--no-open", action="store_true", help="print the URL without opening a browser")
    args = parser.parse_args()

    # Demo environment: mock vision unless the operator configured one.
    os.environ.setdefault("ALLTERNIT_VISION_PROVIDER", "mock")
    os.environ["ALLTERNIT_ACU_DEMO"] = "1"

    port = args.port or _find_free_port(args.host)
    os.environ["ALLTERNIT_ACU_PORT"] = str(port)

    sys.path.insert(0, str(GATEWAY))
    sys.path.insert(0, str(ROOT))
    os.chdir(str(GATEWAY))

    url = f"http://{args.host}:{port}/demo"
    print(f"Allternit Computer Use demo")
    print(f"  vision provider : {os.environ.get('ALLTERNIT_VISION_PROVIDER')}")
    print(f"  demo UI         : {url}")
    print(f"  gateway API     : http://{args.host}:{port}/v1/computer-use/health")
    print("Press Ctrl+C to stop.")

    if not args.no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    import uvicorn

    uvicorn.run(
        "main:app",
        host=args.host,
        port=port,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
