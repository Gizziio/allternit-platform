"""Canonical iOS mobile provider wrapping phone-harness.

Primary driver: the vendored phone-harness (macOS iPhone Mirroring + OCR).
Fallback chain: pymobiledevice3 -> idb CLI.  If no driver is available the
provider still imports and registers, but advertises itself as unavailable and
raises a clear runtime error when used.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import importlib.util
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from contracts.canonical import (
    ActionEvidence,
    ActionStep,
    ActionTransaction,
    CapabilityManifest,
    ElementNode,
    ExecutionMode,
    ImageEvidence,
    Observation,
    OutcomeStatus,
    Rect,
    Root,
    StepOutcome,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vendored phone-harness discovery
# ---------------------------------------------------------------------------

_VENDOR_ROOT = Path(__file__).resolve().parents[2] / "mobile-harness" / "phone-harness"
_PHONE_HARNESS_SRC = _VENDOR_ROOT / "src"

if str(_PHONE_HARNESS_SRC) not in sys.path:
    sys.path.insert(0, str(_PHONE_HARNESS_SRC))


def _load_phone_harness_helpers() -> Optional[Any]:
    """Lazily load vendored phone-harness helpers if native deps are present."""
    try:
        import Quartz  # noqa: F401
        import Vision  # noqa: F401
        from AppKit import NSRunningApplication  # noqa: F401
    except Exception as exc:
        logger.debug("phone-harness native deps unavailable: %s", exc)
        return None
    try:
        import phone_harness.helpers as helpers
        return helpers
    except Exception as exc:
        logger.debug("phone-harness import failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Driver abstraction
# ---------------------------------------------------------------------------

class IosDriver:
    """Low-level iOS control interface used by the canonical provider."""

    name: str = "base"
    available: bool = False

    async def screenshot(self) -> bytes:
        raise NotImplementedError

    async def tap(self, x: float, y: float) -> None:
        raise NotImplementedError

    async def swipe(self, x1: float, y1: float, x2: float, y2: float, duration_ms: int = 300) -> None:
        raise NotImplementedError

    async def type_text(self, text: str) -> None:
        raise NotImplementedError

    async def home(self) -> None:
        raise NotImplementedError

    async def app_launch(self, bundle_id_or_name: str) -> None:
        raise NotImplementedError

    async def accessibility_tree(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    async def health_check(self) -> bool:
        return False


class PhoneHarnessDriver(IosDriver):
    """Driver backed by the vendored phone-harness (macOS iPhone Mirroring)."""

    name = "phone-harness"

    def __init__(self) -> None:
        self._helpers: Optional[Any] = _load_phone_harness_helpers()
        self.available = self._helpers is not None

    def _require(self) -> Any:
        if self._helpers is None:
            raise RuntimeError(
                "phone-harness is unavailable: requires macOS + pyobjc frameworks + "
                "iPhone Mirroring. Run the provider on a Mac with a paired phone."
            )
        return self._helpers

    async def screenshot(self) -> bytes:
        helpers = self._require()
        loop = asyncio.get_running_loop()
        path = await loop.run_in_executor(None, helpers.screenshot)
        return await loop.run_in_executor(None, Path(path).read_bytes)

    async def tap(self, x: float, y: float) -> None:
        helpers = self._require()
        await asyncio.get_running_loop().run_in_executor(None, helpers.tap, x, y)

    async def swipe(self, x1: float, y1: float, x2: float, y2: float, duration_ms: int = 300) -> None:
        helpers = self._require()
        await asyncio.get_running_loop().run_in_executor(
            None, helpers.mirror.drag, x1, y1, x2, y2, duration_ms / 1000.0, 14
        )

    async def type_text(self, text: str) -> None:
        helpers = self._require()
        await asyncio.get_running_loop().run_in_executor(None, helpers.type_text, text)

    async def home(self) -> None:
        helpers = self._require()
        await asyncio.get_running_loop().run_in_executor(None, helpers.home)

    async def app_launch(self, bundle_id_or_name: str) -> None:
        helpers = self._require()
        await asyncio.get_running_loop().run_in_executor(None, helpers.open_app, bundle_id_or_name)

    async def accessibility_tree(self) -> List[Dict[str, Any]]:
        helpers = self._require()
        loop = asyncio.get_running_loop()
        boxes = await loop.run_in_executor(None, helpers.ocr)
        return [
            {
                "text": box.get("text", ""),
                "confidence": box.get("confidence", 0.0),
                "x": box.get("x", 0),
                "y": box.get("y", 0),
                "w": box.get("w", 0),
                "h": box.get("h", 0),
            }
            for box in boxes
        ]

    async def health_check(self) -> bool:
        if not self.available:
            return False
        try:
            helpers = self._require()
            state = helpers.connection_state()
            return state == "ready"
        except Exception as exc:
            logger.debug("phone-harness health check failed: %s", exc)
            return False


class Pymobiledevice3Driver(IosDriver):
    """Fallback driver using pymobiledevice3 (USB/Wi-Fi iOS device services)."""

    name = "pymobiledevice3"

    def __init__(self) -> None:
        self._lockdown: Optional[Any] = None
        self.available = importlib.util.find_spec("pymobiledevice3") is not None

    def _require(self) -> Any:
        if not self.available:
            raise RuntimeError("pymobiledevice3 is not installed")
        from pymobiledevice3.lockdown import create_using_usbmux  # type: ignore[import]
        from pymobiledevice3.services.house_arrest import HouseArrestService  # type: ignore[import]
        from pymobiledevice3.services.instruments import InstrumentsService  # type: ignore[import]
        from pymobiledevice3.services.screenshot import ScreenshotService  # type: ignore[import]
        return {
            "create_using_usbmux": create_using_usbmux,
            "HouseArrestService": HouseArrestService,
            "InstrumentsService": InstrumentsService,
            "ScreenshotService": ScreenshotService,
        }

    def _lockdown_client(self) -> Any:
        if self._lockdown is None:
            modules = self._require()
            self._lockdown = modules["create_using_usbmux"]()
        return self._lockdown

    async def screenshot(self) -> bytes:
        modules = self._require()
        loop = asyncio.get_running_loop()
        lockdown = self._lockdown_client()

        def _capture() -> bytes:
            with modules["ScreenshotService"](lockdown=lockdown) as svc:
                return svc.get_screenshot()

        return await loop.run_in_executor(None, _capture)

    async def tap(self, x: float, y: float) -> None:
        await self.swipe(x, y, x, y, duration_ms=50)

    async def swipe(self, x1: float, y1: float, x2: float, y2: float, duration_ms: int = 300) -> None:
        # pymobiledevice3 does not expose a direct HID swipe; use idb fallback
        # for gestures and surface a clear error if idb is also missing.
        raise RuntimeError(
            "pymobiledevice3 fallback does not implement gestures; install idb for gesture support"
        )

    async def type_text(self, text: str) -> None:
        modules = self._require()
        loop = asyncio.get_running_loop()
        lockdown = self._lockdown_client()

        def _type() -> None:
            with modules["InstrumentsService"](lockdown=lockdown) as svc:
                for ch in text:
                    svc.input_text(ch)

        await loop.run_in_executor(None, _type)

    async def home(self) -> None:
        modules = self._require()
        loop = asyncio.get_running_loop()
        lockdown = self._lockdown_client()

        def _home() -> None:
            with modules["InstrumentsService"](lockdown=lockdown) as svc:
                svc.press_home_button()

        await loop.run_in_executor(None, _home)

    async def app_launch(self, bundle_id_or_name: str) -> None:
        modules = self._require()
        loop = asyncio.get_running_loop()
        lockdown = self._lockdown_client()

        def _launch() -> None:
            with modules["InstrumentsService"](lockdown=lockdown) as svc:
                svc.launch_app(bundle_id_or_name)

        await loop.run_in_executor(None, _launch)

    async def accessibility_tree(self) -> List[Dict[str, Any]]:
        # pymobiledevice3 accessibility snapshot is best-effort; return a placeholder.
        return [{"note": "pymobiledevice3 accessibility tree not yet implemented"}]

    async def health_check(self) -> bool:
        if not self.available:
            return False
        try:
            self._lockdown_client()
            return True
        except Exception as exc:
            logger.debug("pymobiledevice3 health check failed: %s", exc)
            return False


class IdbDriver(IosDriver):
    """Final fallback using Facebook/Meta's idb CLI."""

    name = "idb"

    def __init__(self, idb_path: str = "idb", device_id: Optional[str] = None) -> None:
        self._idb_path = idb_path
        self._device_id = device_id
        self.available = shutil.which(idb_path) is not None

    def _args(self, *cmd: str) -> List[str]:
        base = [self._idb_path]
        if self._device_id:
            base += ["--udid", self._device_id]
        return base + list(cmd)

    async def _run(self, *cmd: str) -> subprocess.CompletedProcess:
        proc = await asyncio.create_subprocess_exec(
            *self._args(*cmd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"idb {' '.join(cmd)} failed: {stderr.decode(errors='replace')}")
        return subprocess.CompletedProcess(self._args(*cmd), proc.returncode, stdout, stderr)

    async def screenshot(self) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            await self._run("screenshot", "--output", tmp_path)
            return Path(tmp_path).read_bytes()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    async def tap(self, x: float, y: float) -> None:
        await self._run("ui", "tap", str(int(x)), str(int(y)))

    async def swipe(self, x1: float, y1: float, x2: float, y2: float, duration_ms: int = 300) -> None:
        await self._run(
            "ui", "swipe",
            str(int(x1)), str(int(y1)), str(int(x2)), str(int(y2)),
            "--duration", str(duration_ms / 1000.0),
        )

    async def type_text(self, text: str) -> None:
        await self._run("ui", "text", text)

    async def home(self) -> None:
        await self._run("ui", "key-send", "home")

    async def app_launch(self, bundle_id_or_name: str) -> None:
        await self._run("launch", bundle_id_or_name)

    async def accessibility_tree(self) -> List[Dict[str, Any]]:
        proc = await self._run("ui", "hierarchy")
        raw = proc.stdout.decode("utf-8", errors="replace")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return [{"raw": raw}]

    async def health_check(self) -> bool:
        if not self.available:
            return False
        try:
            proc = await self._run("list-targets")
            return bool(proc.stdout.strip())
        except Exception as exc:
            logger.debug("idb health check failed: %s", exc)
            return False


def _select_driver(
    preferred: Optional[str] = None,
    idb_path: str = "idb",
    device_id: Optional[str] = None,
) -> IosDriver:
    """Pick the first usable iOS driver from phone-harness -> pymobiledevice3 -> idb."""
    candidates: List[IosDriver] = [
        PhoneHarnessDriver(),
        Pymobiledevice3Driver(),
        IdbDriver(idb_path=idb_path, device_id=device_id),
    ]
    if preferred:
        candidates.sort(key=lambda d: 0 if d.name == preferred else 1)
    for driver in candidates:
        if driver.available:
            logger.info("Selected iOS driver: %s", driver.name)
            return driver
    # Return phone-harness driver as the canonical primary even if unavailable;
    # the provider will advertise limitations accordingly.
    return candidates[0]


# ---------------------------------------------------------------------------
# Canonical provider
# ---------------------------------------------------------------------------

class PhoneHarnessCanonicalProvider:
    provider_id = "mobile.phone.canonical"

    def __init__(
        self,
        artifact_dir: str | Path,
        preferred: Optional[str] = None,
        idb_path: str = "idb",
        device_id: Optional[str] = None,
    ) -> None:
        self._artifact_dir = Path(artifact_dir)
        self._driver = _select_driver(preferred=preferred, idb_path=idb_path, device_id=device_id)
        self._state_selectors: Dict[str, Dict[str, str]] = {}
        self._state_order: List[str] = []

    async def capabilities(self) -> CapabilityManifest:
        available = await self._driver.health_check()
        limitations: Tuple[str, ...] = ()
        if not available:
            limitations = (f"primary_driver_{self._driver.name}_not_ready",)
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="1.0.0-p1",
            operating_systems=("ios",),
            actions=(
                "observe", "tap", "swipe", "typeText", "keypress",
                "navigate", "home", "accessibility_tree",
            ),
            observation_channels=("screenshot", "ocr_text"),
            execution_modes=(ExecutionMode.FOREGROUND_ALLOWED.value,),
            strict_background=False,
            semantic_input=True,
            raw_input=True,
            mobile=True,
            max_concurrency=1,
            limitations=limitations,
        )

    async def discover_roots(self, *, session_id: str, environment_id: str) -> Tuple[Root, ...]:
        if not await self._driver.health_check():
            return ()
        return (
            Root(
                root_id=f"root_ios:{environment_id}",
                resource_id=f"ios-device:{environment_id}",
                kind="ios_device",
                title="iPhone",
                application="iPhone Mirroring" if self._driver.name == "phone-harness" else self._driver.name,
                bounds=Rect(0, 0, 390, 844),
                focused=True,
            ),
        )

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation:
        screenshot_bytes = await self._driver.screenshot()
        digest = hashlib.sha256(screenshot_bytes).hexdigest()
        self._artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_id = f"artifact_{uuid4().hex}"
        artifact_path = self._artifact_dir / f"{artifact_id}.png"
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, artifact_path.write_bytes, screenshot_bytes)

        boxes = await self._driver.accessibility_tree()
        state_id = f"state_{uuid4().hex}"
        selectors: Dict[str, str] = {}
        elements: List[ElementNode] = []
        for index, box in enumerate(boxes, start=1):
            ref = f"@e{index}"
            selectors[ref] = json.dumps(box, sort_keys=True)
            elements.append(
                ElementNode(
                    ref=ref,
                    role="text",
                    name=str(box.get("text", "")),
                    value="",
                    description="",
                    bounds=Rect(
                        float(box.get("x", 0)),
                        float(box.get("y", 0)),
                        float(box.get("w", 0)),
                        float(box.get("h", 0)),
                    ),
                    states=(),
                    actions=("tap",),
                    provider_metadata=box,
                )
            )
        self._remember_selectors(state_id, selectors)

        return Observation(
            state_id=state_id,
            session_id=session_id,
            environment_id=environment_id,
            resource_id=resource_id,
            epoch=epoch,
            captured_at=datetime.now(timezone.utc).isoformat(),
            provider_id=self.provider_id,
            provider_version="1.0.0-p1",
            roots=(
                Root(
                    root_id=f"root_ios:{environment_id}",
                    resource_id=resource_id,
                    kind="ios_device",
                    title="iPhone",
                    application="iPhone Mirroring" if self._driver.name == "phone-harness" else self._driver.name,
                    bounds=Rect(0, 0, 390, 844),
                    focused=True,
                ),
            ),
            elements=tuple(elements),
            image=ImageEvidence(
                artifact_id=artifact_id,
                media_type="image/png",
                width=390,
                height=844,
                sha256=digest,
                coordinate_space="screen_points",
            ),
            truncated=False,
            metadata={
                "driver": self._driver.name,
                "artifact_path": str(artifact_path),
            },
        )

    def _remember_selectors(self, state_id: str, selectors: Dict[str, str]) -> None:
        self._state_selectors[state_id] = selectors
        self._state_order.append(state_id)
        while len(self._state_order) > 128:
            evicted = self._state_order.pop(0)
            self._state_selectors.pop(evicted, None)

    def _selector(self, transaction: ActionTransaction, step: ActionStep) -> Optional[str]:
        if step.target is None or step.target.ref is None:
            return None
        selectors = self._state_selectors.get(transaction.base_state_id)
        if selectors is None:
            raise ValueError(f"Provider mapping for state {transaction.base_state_id!r} was evicted")
        try:
            return selectors[step.target.ref]
        except KeyError as error:
            raise ValueError(
                f"Ref {step.target.ref!r} is not known in state {transaction.base_state_id!r}"
            ) from error

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        try:
            if step.action == "tap" or (step.action == "click"):
                target = step.target
                if target is None or target.x is None or target.y is None:
                    raise ValueError("tap requires x,y coordinates")
                await self._driver.tap(target.x, target.y)
            elif step.action == "swipe" or step.action == "scroll":
                x1 = float(step.arguments.get("x1", step.arguments.get("start_x", 0)))
                y1 = float(step.arguments.get("y1", step.arguments.get("start_y", 0)))
                x2 = float(step.arguments.get("x2", step.arguments.get("end_x", 0)))
                y2 = float(step.arguments.get("y2", step.arguments.get("end_y", 0)))
                duration_ms = int(step.arguments.get("duration_ms", 300))
                await self._driver.swipe(x1, y1, x2, y2, duration_ms)
            elif step.action == "typeText" or step.action == "setText":
                text = str(step.arguments.get("text", ""))
                await self._driver.type_text(text)
            elif step.action == "keypress":
                key = str(step.arguments.get("key", "")).lower()
                if key in ("home", "cmd+1"):
                    await self._driver.home()
                else:
                    raise ValueError(f"Unsupported keypress {key!r}")
            elif step.action == "navigate":
                target = step.arguments.get("url") or step.arguments.get("app") or ""
                if not target:
                    raise ValueError("navigate requires url or app argument")
                await self._driver.app_launch(str(target))
            elif step.action == "home":
                await self._driver.home()
            elif step.action == "accessibility_tree":
                await self._driver.accessibility_tree()
            else:
                raise ValueError(f"Unsupported iOS action {step.action!r}")
        except Exception as error:
            return StepOutcome(
                index=index,
                status=OutcomeStatus.DIDNT.value,
                evidence=ActionEvidence(
                    grounding="ios_coordinate" if step.action in ("tap", "swipe") else "ios_command",
                    delivery=self._driver.name,
                    details={"action": step.action, "arguments": step.arguments},
                ),
                error_code=type(error).__name__,
                message=str(error),
            )

        return StepOutcome(
            index=index,
            status=OutcomeStatus.UNKNOWN.value,
            evidence=ActionEvidence(
                grounding="ios_coordinate" if step.action in ("tap", "swipe") else "ios_command",
                delivery=self._driver.name,
                details={"action": step.action, "delivered": True},
            ),
            message="Input delivered; semantic success requires a transaction postcondition",
        )

    async def mobile_action(self, action: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Direct mobile action API used by the canonical router's mobile endpoint.

        Supported actions: screenshot, tap, swipe, type, home, app_launch,
        accessibility_tree.
        """
        if action == "screenshot":
            data = await self._driver.screenshot()
            return {
                "image_b64": base64.b64encode(data).decode("ascii"),
                "media_type": "image/png",
                "size_bytes": len(data),
            }
        if action == "tap":
            await self._driver.tap(float(arguments["x"]), float(arguments["y"]))
            return {"delivered": True}
        if action == "swipe":
            await self._driver.swipe(
                float(arguments.get("x1", arguments.get("start_x", 0))),
                float(arguments.get("y1", arguments.get("start_y", 0))),
                float(arguments.get("x2", arguments.get("end_x", 0))),
                float(arguments.get("y2", arguments.get("end_y", 0))),
                int(arguments.get("duration_ms", 300)),
            )
            return {"delivered": True}
        if action == "type":
            await self._driver.type_text(str(arguments.get("text", "")))
            return {"delivered": True}
        if action == "home":
            await self._driver.home()
            return {"delivered": True}
        if action == "app_launch":
            await self._driver.app_launch(str(arguments.get("bundle_id_or_name", "")))
            return {"delivered": True}
        if action == "accessibility_tree":
            tree = await self._driver.accessibility_tree()
            return {"tree": tree}
        raise ValueError(f"Unsupported mobile action {action!r}")

    async def close(self) -> None:
        self._state_selectors.clear()
        self._state_order.clear()
