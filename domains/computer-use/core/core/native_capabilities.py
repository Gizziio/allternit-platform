"""Read-only native capability and permission discovery. Never prompts users."""

from __future__ import annotations

import ctypes
import os
import platform
import shutil
from dataclasses import asdict, dataclass
from typing import Optional


@dataclass(frozen=True)
class PermissionState:
    name: str
    state: str
    remediation: Optional[str] = None


@dataclass(frozen=True)
class NativeCapabilityReport:
    os: str
    display_server: Optional[str]
    semantic_tree: bool
    semantic_actions: bool
    screenshot: bool
    raw_input: bool
    strict_background: bool
    permissions: tuple[PermissionState, ...]
    limitations: tuple[str, ...]


def _macos_report() -> NativeCapabilityReport:
    trusted = False
    screen = "unknown"
    try:
        application_services = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices"
        )
        application_services.AXIsProcessTrusted.restype = ctypes.c_bool
        trusted = bool(application_services.AXIsProcessTrusted())
    except Exception:
        pass
    try:
        core_graphics = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
        )
        preflight = core_graphics.CGPreflightScreenCaptureAccess
        preflight.restype = ctypes.c_bool
        screen = "granted" if preflight() else "denied"
    except Exception:
        pass
    return NativeCapabilityReport(
        "macos", "Quartz", trusted, trusted, screen == "granted", True, trusted,
        (
            PermissionState("accessibility", "granted" if trusted else "denied", "System Settings > Privacy & Security > Accessibility"),
            PermissionState("screen_recording", screen, "System Settings > Privacy & Security > Screen & System Audio Recording"),
        ),
        ("raw_input_is_global", "strict_background_requires_accessibility_semantic_delivery"),
    )


def _windows_report() -> NativeCapabilityReport:
    uia = platform.system() == "Windows"
    return NativeCapabilityReport(
        "windows", "Win32", uia, uia, uia, uia, uia,
        (PermissionState("uia_integrity_level", "context_dependent", "Run at the same integrity level as the target application"),),
        ("secure_desktop_unavailable", "elevated_targets_require_matching_integrity"),
    )


def _linux_report() -> NativeCapabilityReport:
    wayland = bool(os.environ.get("WAYLAND_DISPLAY"))
    x11 = bool(os.environ.get("DISPLAY")) and not wayland
    atspi = import_available("pyatspi") or bool(shutil.which("gdbus"))
    if wayland:
        permissions = (
            PermissionState("portal_screenshot", "session_consent_required"),
            PermissionState("portal_remote_desktop", "session_consent_required"),
        )
        limitations = ("wayland_compositor_consent", "no_unattended_global_input", "no_strict_background")
    else:
        permissions = (PermissionState("x11_display", "granted" if x11 else "unavailable"),)
        limitations = ("x11_input_is_global", "strict_background_requires_at_spi_semantic_delivery")
    return NativeCapabilityReport(
        "linux", "Wayland" if wayland else "X11" if x11 else None,
        atspi, atspi, wayland or x11, x11, atspi and x11, permissions, limitations,
    )


def import_available(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False


def native_capability_report() -> NativeCapabilityReport:
    system = platform.system()
    if system == "Darwin":
        return _macos_report()
    if system == "Windows":
        return _windows_report()
    return _linux_report()


def native_capability_payload() -> dict:
    return asdict(native_capability_report())


def native_permission_request_plan(permission: str) -> dict:
    """Return explicit UX instructions; never triggers an OS prompt itself."""
    system = platform.system()
    plans = {
        "Darwin": {
            "accessibility": {
                "settings_url": "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
                "requires_signed_app_identity": True,
                "recheck": "native-capabilities",
            },
            "screen_recording": {
                "settings_url": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
                "requires_signed_app_identity": True,
                "recheck": "native-capabilities",
            },
        },
        "Windows": {
            "uia_integrity_level": {
                "instruction": "Run Allternit at the same integrity level as the target; secure desktop is never automated.",
                "requires_restart": True,
                "recheck": "native-capabilities",
            },
        },
        "Linux": {
            "portal_screenshot": {
                "portal": "org.freedesktop.portal.Screenshot",
                "requires_user_consent_each_session": True,
                "recheck": "native-capabilities",
            },
            "portal_remote_desktop": {
                "portal": "org.freedesktop.portal.RemoteDesktop",
                "requires_user_consent_each_session": True,
                "recheck": "native-capabilities",
            },
            "x11_display": {
                "instruction": "Start Allternit inside the intended graphical session; global input remains foreground-only.",
                "recheck": "native-capabilities",
            },
        },
    }
    plan = plans.get(system, {}).get(permission)
    if plan is None:
        raise ValueError(f"Permission {permission!r} is not applicable on {system}")
    return {"os": system, "permission": permission, "prompt_triggered": False, **plan}
