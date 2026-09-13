"""Packaged allternit-computer daemon entrypoint."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="allternit-computer")
    parser.add_argument("command", nargs="?", default="serve", choices=("serve", "status", "providers", "native", "resources", "service-plan", "install-service"))
    parser.add_argument("--host", default=os.environ.get("ACU_GATEWAY_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ACU_GATEWAY_PORT", "8760")))
    parser.add_argument("--state-dir", default=os.environ.get("ALLTERNIT_COMPUTER_STATE_DIR"))
    parser.add_argument("--print-config", action="store_true")
    parser.add_argument("--session-id")
    return parser


def main() -> None:
    args = _parser().parse_args()
    if args.host not in {"127.0.0.1", "::1", "localhost"} and not os.environ.get("ACU_API_KEY"):
        raise SystemExit("Refusing non-loopback bind without ACU_API_KEY")
    if args.state_dir:
        os.environ["ALLTERNIT_COMPUTER_STATE_DIR"] = str(Path(args.state_dir).expanduser())
    config = {
        "host": args.host, "port": args.port,
        "state_dir": os.environ.get("ALLTERNIT_COMPUTER_STATE_DIR", "~/.allternit/computer-use"),
        "authentication": "bearer" if os.environ.get("ACU_API_KEY") else "loopback_only",
    }
    if args.print_config:
        print(json.dumps(config, sort_keys=True))
        return
    if args.command in {"service-plan", "install-service"}:
        from gateway.service_installer import render_service_manifest, service_install_plan
        state_dir = args.state_dir or "~/.allternit/computer-use"
        if args.command == "service-plan":
            print(json.dumps(service_install_plan(state_dir), indent=2, sort_keys=True))
        else:
            destination = render_service_manifest(state_dir)
            print(json.dumps({"rendered": str(destination), "activated": False}, sort_keys=True))
        return
    if args.command != "serve":
        paths = {
            "status": "/v1/computer-use/canonical/health",
            "providers": "/v1/computer-use/canonical/providers",
            "native": "/v1/computer-use/canonical/native-capabilities",
        }
        if args.command == "resources":
            if not args.session_id:
                raise SystemExit("resources requires --session-id")
            path = f"/v1/computer-use/canonical/sessions/{urllib.parse.quote(args.session_id, safe='')}/resources"
        else:
            path = paths[args.command]
        request = urllib.request.Request(f"http://{args.host}:{args.port}{path}")
        api_key = os.environ.get("ACU_API_KEY")
        if api_key:
            request.add_header("Authorization", f"Bearer {api_key}")
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                print(json.dumps(json.load(response), indent=2, sort_keys=True))
        except urllib.error.URLError as error:
            raise SystemExit(f"allternit-computer daemon unavailable: {error}") from error
        return

    # main.py retains compatibility with direct execution and top-level imports.
    gateway_dir = str(Path(__file__).resolve().parent)
    if gateway_dir not in sys.path:
        sys.path.insert(0, gateway_dir)
    import uvicorn
    from main import app

    uvicorn.run(app, host=args.host, port=args.port, access_log=True)


if __name__ == "__main__":
    main()
