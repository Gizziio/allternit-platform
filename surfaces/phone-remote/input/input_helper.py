#!/usr/bin/env python3
"""
phone-remote input helper — line-JSON over stdio → macOS Quartz CGEvent input.

Reads one JSON object per line from stdin, executes it as synthetic input via
CGEventPost(kCGHIDEventTap), and writes one JSON response line per command.
Keycode table and CGEvent approach follow
domains/computer-use/core/adapters/desktop/accessibility_adapter.py (which is a
package-internal async class and not runnable standalone — this is the minimal
standalone equivalent; same HID event tap, same keycodes).

Protocol (stdin →):
  {"type":"ping"}
  {"type":"mousepos"}                              read-only probe
  {"type":"displaysize"}                           main display size in points
  {"type":"move",      "x":f, "y":f}
  {"type":"mousedown", "x":f, "y":f, "button":"left"|"right"}
  {"type":"mouseup",   "x":f, "y":f, "button":"left"|"right"}
  {"type":"click",     "x":f, "y":f, "button":"left"|"right", "clicks":1|2}
  {"type":"scroll",    "dx":i, "dy":i}             wheel units (lines)
  {"type":"text",      "text":"..."}               unicode-safe
  {"type":"key",       "key":"return", "mods":["cmd","shift"]}

Responses (stdout ←): {"ok":true,...} or {"ok":false,"error":"..."}.
On startup: {"type":"ready","accessibilityTrusted":bool,"dryRun":bool}.

--dry-run: parse and echo commands without posting any events (safe testing).

TCC: posting events at the HID tap requires Accessibility permission for the
process tree that launches this helper (grant the terminal app, restart it).
accessibilityTrusted in the ready line reports AXIsProcessTrusted().
"""

import ctypes
import json
import sys

import Quartz

# AXIsProcessTrusted is not exposed by this pyobjc build; call it directly.
_AX = ctypes.cdll.LoadLibrary(
    "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
_AX.AXIsProcessTrusted.restype = ctypes.c_bool

DRY_RUN = "--dry-run" in sys.argv

# Keycode table from accessibility_adapter.py (proven values).
KEY_CODES = {
    "return": 36, "enter": 76, "tab": 48, "space": 49, "delete": 51,
    "backspace": 51, "escape": 53, "esc": 53, "forwarddelete": 117,
    "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
    "left": 123, "right": 124, "down": 125, "up": 126,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
    "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
    "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4,
    "i": 34, "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31,
    "p": 35, "q": 12, "r": 15, "s": 1, "t": 17, "u": 32, "v": 9,
    "w": 13, "x": 7, "y": 16, "z": 6,
    "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23,
    "6": 22, "7": 26, "8": 28, "9": 25,
    "minus": 27, "equal": 24, "leftbracket": 33, "rightbracket": 30,
    "semicolon": 41, "quote": 39, "comma": 43, "period": 47, "slash": 44,
    "backslash": 42, "grave": 50,
}

MOD_FLAGS = {
    "cmd": 0x100000, "command": 0x100000,
    "ctrl": 0x040000, "control": 0x040000,
    "opt": 0x080000, "option": 0x080000, "alt": 0x080000,
    "shift": 0x020000,
    "fn": 0x800000,
}

MOUSE_TYPES = {
    ("left", "down"): Quartz.kCGEventLeftMouseDown,
    ("left", "up"): Quartz.kCGEventLeftMouseUp,
    ("left", "drag"): Quartz.kCGEventLeftMouseDragged,
    ("right", "down"): Quartz.kCGEventRightMouseDown,
    ("right", "up"): Quartz.kCGEventRightMouseUp,
    ("right", "drag"): Quartz.kCGEventRightMouseDragged,
}
MOUSE_BUTTONS = {"left": Quartz.kCGMouseButtonLeft, "right": Quartz.kCGMouseButtonRight}


def _source():
    return Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)


def _post(ev):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)


def _mouse_event(kind, button, x, y, clicks=1):
    ev = Quartz.CGEventCreateMouseEvent(_source(), MOUSE_TYPES[(button, kind)], (x, y), MOUSE_BUTTONS[button])
    if clicks > 1:
        Quartz.CGEventSetIntegerValueField(ev, Quartz.kCGMouseEventClickState, clicks)
    _post(ev)


def do_move(x, y):
    ev = Quartz.CGEventCreateMouseEvent(_source(), Quartz.kCGEventMouseMoved, (x, y), 0)
    _post(ev)


def do_click(x, y, button, clicks):
    for n in range(1, clicks + 1):
        _mouse_event("down", button, x, y, clicks=n if clicks > 1 else 1)
        _mouse_event("up", button, x, y, clicks=n if clicks > 1 else 1)


def do_scroll(dx, dy):
    ev = Quartz.CGEventCreateScrollWheelEvent(
        _source(), Quartz.kCGScrollEventUnitLine, 2, int(-dy), int(-dx))
    _post(ev)


def do_text(text):
    for ch in text:
        ev = Quartz.CGEventCreateKeyboardEvent(_source(), 0, True)
        Quartz.CGEventKeyboardSetUnicodeString(ev, len(ch), ch)
        _post(ev)
        up = Quartz.CGEventCreateKeyboardEvent(_source(), 0, False)
        Quartz.CGEventKeyboardSetUnicodeString(up, len(ch), ch)
        _post(up)


def do_key(key, mods):
    code = KEY_CODES.get(key.lower())
    if code is None:
        return {"ok": False, "error": f"unknown key: {key}"}
    flags = 0
    for m in mods or []:
        f = MOD_FLAGS.get(m.lower())
        if f is None:
            return {"ok": False, "error": f"unknown modifier: {m}"}
        flags |= f
    down = Quartz.CGEventCreateKeyboardEvent(_source(), code, True)
    up = Quartz.CGEventCreateKeyboardEvent(_source(), code, False)
    if flags:
        Quartz.CGEventSetFlags(down, flags)
        Quartz.CGEventSetFlags(up, flags)
    _post(down)
    _post(up)
    return None


def mousepos():
    ev = Quartz.CGEventCreate(None)
    x, y = Quartz.CGEventGetLocation(ev)
    return {"ok": True, "x": x, "y": y}


def displaysize():
    bounds = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())
    return {"ok": True, "width": bounds.size.width, "height": bounds.size.height}


KNOWN_TYPES = {"ping", "mousepos", "displaysize", "move", "mousedown", "mouseup", "click", "scroll", "text", "key"}


def handle(cmd):
    t = cmd.get("type")
    if t not in KNOWN_TYPES:
        return {"ok": False, "error": f"unknown command type: {t}"}
    if t == "ping":
        return {"ok": True, "pong": True}
    if t == "mousepos":
        return mousepos()  # read-only; no permission needed
    if t == "displaysize":
        return displaysize()  # read-only; no permission needed
    if DRY_RUN:
        return {"ok": True, "dry": True, "cmd": cmd}

    x, y = cmd.get("x"), cmd.get("y")
    button = cmd.get("button", "left")
    if button not in MOUSE_BUTTONS:
        return {"ok": False, "error": f"unknown button: {button}"}

    if t == "move":
        do_move(x, y)
    elif t == "mousedown":
        _mouse_event("down", button, x, y)
    elif t == "mouseup":
        _mouse_event("up", button, x, y)
    elif t == "click":
        do_click(x, y, button, int(cmd.get("clicks", 1)))
    elif t == "scroll":
        do_scroll(int(cmd.get("dx", 0)), int(cmd.get("dy", 0)))
    elif t == "text":
        do_text(str(cmd.get("text", "")))
    elif t == "key":
        err = do_key(str(cmd.get("key", "")), cmd.get("mods"))
        if err:
            return err
    return {"ok": True}


def main():
    trusted = bool(_AX.AXIsProcessTrusted())
    print(json.dumps({"type": "ready", "accessibilityTrusted": trusted, "dryRun": DRY_RUN}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
            resp = handle(cmd)
        except Exception as e:  # keep serving after a bad command
            resp = {"ok": False, "error": f"{type(e).__name__}: {e}"}
        print(json.dumps(resp), flush=True)


if __name__ == "__main__":
    main()
