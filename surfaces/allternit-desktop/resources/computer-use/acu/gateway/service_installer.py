"""Render user-scoped service manifests without starting services implicitly."""

from __future__ import annotations

import platform
import shutil
import shlex
import sys
from pathlib import Path
from typing import Dict
from xml.sax.saxutils import escape


def service_install_plan(state_dir: str | Path) -> Dict[str, str]:
    executable = shutil.which("allternit-computer") or str(Path(sys.argv[0]).resolve())
    state = str(Path(state_dir).expanduser().resolve())
    system = platform.system()
    if system == "Darwin":
        destination = Path.home() / "Library/LaunchAgents/com.allternit.computer.plist"
        manager = "launchctl"
    elif system == "Windows":
        destination = Path.home() / "AppData/Local/Allternit/computer/allternit-computer-service.xml"
        manager = "winsw"
    else:
        destination = Path.home() / ".config/systemd/user/allternit-computer.service"
        manager = "systemctl --user"
    return {
        "os": system, "manager": manager, "executable": executable,
        "state_dir": state, "destination": str(destination),
        "activation_required": "true",
    }


def render_service_manifest(state_dir: str | Path) -> Path:
    plan = service_install_plan(state_dir)
    destination = Path(plan["destination"])
    destination.parent.mkdir(parents=True, exist_ok=True)
    executable = plan["executable"]
    state = plan["state_dir"]
    if plan["os"] == "Darwin":
        content = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>com.allternit.computer</string>
<key>ProgramArguments</key><array><string>{escape(executable)}</string><string>serve</string><string>--state-dir</string><string>{escape(state)}</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
<key>ProcessType</key><string>Interactive</string><key>ThrottleInterval</key><integer>10</integer></dict></plist>'''
    elif plan["os"] == "Windows":
        content = f'''<?xml version="1.0" encoding="UTF-8"?><service>
<id>allternit-computer</id><name>Allternit Computer Use</name>
<executable>{escape(executable)}</executable><arguments>serve --state-dir &quot;{escape(state)}&quot;</arguments>
<startmode>Automatic</startmode><onfailure action="restart" delay="10 sec"/><stoptimeout>30 sec</stoptimeout></service>'''
    else:
        content = f'''[Unit]\nDescription=Allternit Computer Use daemon\nAfter=graphical-session.target\n
[Service]\nType=simple\nExecStart={shlex.quote(executable)} serve --state-dir {shlex.quote(state)}\nRestart=on-failure\nRestartSec=10\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nProtectHome=read-only\nReadWritePaths={shlex.quote(state)}\n
[Install]\nWantedBy=default.target\n'''
    destination.write_text(content, encoding="utf-8")
    return destination
