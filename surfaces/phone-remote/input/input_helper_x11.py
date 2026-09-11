#!/usr/bin/env python3
"""
phone-remote X11 input helper — line-JSON over stdio → xdotool.

Same protocol as input_helper.py (Quartz). For headless VPS boxes that have
Xvfb/xfce (or any X display) instead of macOS Accessibility.
"""

import json
import os
import shutil
import subprocess
import sys

DRY_RUN = "--dry-run" in sys.argv
DISPLAY = os.environ.get("DISPLAY", ":0")


def run(args):
    if DRY_RUN:
        return True, " ".join(args)
    try:
        subprocess.run(
            args,
            check=True,
            env={**os.environ, "DISPLAY": DISPLAY},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=5,
        )
        return True, None
    except Exception as exc:
        return False, str(exc)


def display_size():
    try:
        out = subprocess.check_output(
            ["xdotool", "getdisplaygeometry"],
            env={**os.environ, "DISPLAY": DISPLAY},
            timeout=5,
        )
        w, h = out.decode().split()
        return int(w), int(h)
    except Exception:
        return 1280, 720


def handle(cmd):
    t = cmd.get("type")
    if t == "ping":
        return {"ok": True}
    if t == "mousepos":
        ok, err = run(["xdotool", "getmouselocation", "--shell"])
        return {"ok": ok, "error": err} if not ok else {"ok": True}
    if t == "displaysize":
        w, h = display_size()
        return {"ok": True, "width": w, "height": h}
    if t in ("move", "mousedown", "mouseup", "click"):
        x, y = int(cmd.get("x", 0)), int(cmd.get("y", 0))
        button = "3" if cmd.get("button") == "right" else "1"
        clicks = int(cmd.get("clicks") or 1)
        if t == "move":
            ok, err = run(["xdotool", "mousemove", str(x), str(y)])
        elif t == "mousedown":
            run(["xdotool", "mousemove", str(x), str(y)])
            ok, err = run(["xdotool", "mousedown", button])
        elif t == "mouseup":
            run(["xdotool", "mousemove", str(x), str(y)])
            ok, err = run(["xdotool", "mouseup", button])
        else:
            run(["xdotool", "mousemove", str(x), str(y)])
            ok, err = run(["xdotool", "click", "--repeat", str(clicks), button])
        return {"ok": ok, **({"error": err} if err else {})}
    if t == "scroll":
        dy = int(cmd.get("dy") or 0)
        dx = int(cmd.get("dx") or 0)
        btn = "4" if dy < 0 else "5" if dy > 0 else ("6" if dx < 0 else "7" if dx > 0 else None)
        n = abs(dy or dx)
        if not btn or n == 0:
            return {"ok": True}
        ok, err = run(["xdotool", "click", "--repeat", str(min(n, 20)), btn])
        return {"ok": ok, **({"error": err} if err else {})}
    if t == "text":
        text = cmd.get("text") or ""
        ok, err = run(["xdotool", "type", "--clearmodifiers", "--", text])
        return {"ok": ok, **({"error": err} if err else {})}
    if t == "key":
        key = str(cmd.get("key") or "")
        named = {
            "return": "Return", "enter": "Return", "esc": "Escape", "escape": "Escape",
            "tab": "Tab", "space": "space", "delete": "BackSpace", "backspace": "BackSpace",
            "left": "Left", "right": "Right", "up": "Up", "down": "Down",
        }
        chord = named.get(key.lower(), key)
        mods = cmd.get("mods") or []
        prefix = []
        if "cmd" in mods or "ctrl" in mods or "control" in mods:
            prefix.append("ctrl")
        if "shift" in mods:
            prefix.append("shift")
        if "alt" in mods or "opt" in mods:
            prefix.append("alt")
        spec = "+".join(prefix + [chord]) if prefix else chord
        ok, err = run(["xdotool", "key", spec])
        return {"ok": ok, **({"error": err} if err else {})}
    return {"ok": False, "error": f"unknown type {t}"}


def main():
    if not DRY_RUN and not shutil.which("xdotool"):
        sys.stdout.write(json.dumps({"type": "ready", "accessibilityTrusted": False, "dryRun": False, "error": "xdotool missing"}) + "\n")
        sys.stdout.flush()
        sys.exit(1)
    sys.stdout.write(json.dumps({
        "type": "ready",
        "accessibilityTrusted": True,
        "dryRun": DRY_RUN,
        "display": DISPLAY,
    }) + "\n")
    sys.stdout.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as exc:
            sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}) + "\n")
            sys.stdout.flush()
            continue
        sys.stdout.write(json.dumps(handle(cmd)) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
