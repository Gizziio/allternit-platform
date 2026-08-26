"""Allternit Computer Use — DroidRun Mobile Canonical Provider

Wraps the DroidRun mobile harness (``mobilerun_core``) and exposes Android
actions through both the canonical computer-use provider contract and the
environment-backend mobile-action contract.

The provider is intentionally defensive: ``mobilerun_core`` is an optional
runtime dependency. If it is not installed or no Android device is reachable,
the provider advertises itself as unavailable and operations fail with a clear,
actionable message rather than an import traceback.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple
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
    OperatingSystem,
    OutcomeStatus,
    Rect,
    Root,
    StepOutcome,
)
from core.environment_authority import EnvironmentRecord
from core.environment_backends import EnvironmentBackendManifest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional runtime dependency
# ---------------------------------------------------------------------------

_MOBILERUN_AVAILABLE = False
try:
    from mobilerun_core import Mobilerun

    _MOBILERUN_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    Mobilerun = None  # type: ignore[misc, assignment]


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class DroidRunConfig:
    """Connection configuration for a DroidRun Android environment."""

    backend: str = "local-android-adb"  # local-android-adb | local-android-http | cloud
    serial: Optional[str] = None
    portal_url: Optional[str] = None
    portal_token: Optional[str] = None
    cloud_device_id: Optional[str] = None
    adb_path: str = "adb"
    # Number of observe-act cycles for the built-in planning loop.
    plan_max_steps: int = 10


# ---------------------------------------------------------------------------
# DroidRun canonical provider + environment backend
# ---------------------------------------------------------------------------

class DroidRunCanonicalProvider:
    """
    Canonical provider and environment backend for Android via DroidRun.

    The class satisfies both the canonical ``ComputerProvider`` protocol and
    the ``EnvironmentBackend`` protocol used by ``EnvironmentBackendService``.
    This lets the same instance be registered with:

    * ``CanonicalComputerService`` for canonical observe/transaction workflows.
    * ``EnvironmentBackendService`` so the existing
      ``/{environment_id}/mobile/actions`` gateway route dispatches here.
    """

    provider_id = "mobile.droidrun.canonical"

    def __init__(self) -> None:
        self._instances: Dict[str, Dict[str, Any]] = {}
        self._mobilerun: Optional[Any] = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_mobilerun(self) -> Any:
        if not _MOBILERUN_AVAILABLE:
            raise RuntimeError(
                "mobilerun_core is not installed. "
                "Install it with: pip install 'mobilerun-core[local]'"
            )
        if self._mobilerun is None:
            self._mobilerun = Mobilerun()
        return self._mobilerun

    def _instance(self, environment_id: str) -> Dict[str, Any]:
        try:
            return self._instances[environment_id]
        except KeyError as error:
            raise KeyError(
                f"DroidRun environment {environment_id!r} is not provisioned"
            ) from error

    def _device(self, environment_id: str) -> Any:
        return self._instance(environment_id)["device"]

    def _config(self, environment_id: str) -> DroidRunConfig:
        return self._instance(environment_id)["config"]

    @staticmethod
    def _adb_args(config: DroidRunConfig, *args: str) -> list[str]:
        base = [config.adb_path]
        if config.serial:
            base += ["-s", config.serial]
        return base + list(args)

    def _adb_run(self, config: DroidRunConfig, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            self._adb_args(config, *args),
            capture_output=True,
            text=True,
            check=False,
        )

    # ------------------------------------------------------------------
    # Canonical provider contract
    # ------------------------------------------------------------------

    async def capabilities(self) -> CapabilityManifest:
        available = _MOBILERUN_AVAILABLE and shutil.which("adb") is not None
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="0.1.0-p1",
            contract_version="1.0.0-alpha.1",
            operating_systems=(OperatingSystem.ANDROID.value,),
            actions=(
                "tap", "swipe", "typeText", "keypress", "launchApp",
                "getUiTree", "shell", "pushFile", "pullFile", "plan",
            ),
            observation_channels=("screenshot", "accessibility"),
            execution_modes=(ExecutionMode.FOREGROUND_ALLOWED.value,),
            strict_background=False,
            semantic_input=True,
            raw_input=True,
            streaming=False,
            clipboard=False,
            shell=True,
            files=True,
            mobile=True,
            max_concurrency=1,
            limitations=(
                "optional_mobilerun_core_dependency",
                "requires_reachable_android_device",
                "file_and_shell_operations_require_adb_backend",
                "plan_loop_is_a_thin_observe_act_stub",
            )
            if available
            else (
                "mobilerun_core_or_adb_unavailable",
                "provider_registered_but_not_operational",
            ),
        )

    async def discover_roots(
        self,
        *,
        session_id: str,
        environment_id: str,
    ) -> Tuple[Root, ...]:
        if environment_id not in self._instances:
            return ()
        config = self._config(environment_id)
        return (
            Root(
                root_id=f"root_{environment_id}",
                resource_id=f"android:{config.serial or 'default'}",
                kind="android_device",
                title="DroidRun Android Device",
                application="",
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
        device = self._device(environment_id)
        config = self._config(environment_id)

        # Screenshot
        screenshot_bytes = await self._asyncify(device.screenshot)
        image = self._image_evidence(screenshot_bytes)

        # UI tree
        ui_tree = await self._asyncify(device.ui)
        elements = tuple(self._convert_ui_tree(ui_tree))

        # Foreground app when available
        foreground = ""
        try:
            if hasattr(device, "foreground_app"):
                foreground = str(await self._asyncify(device.foreground_app) or "")
        except Exception as exc:  # noqa: BLE001
            logger.debug("Could not read foreground app: %s", exc)

        roots = await self.discover_roots(
            session_id=session_id, environment_id=environment_id
        )
        return Observation(
            state_id=f"state_{uuid4().hex}",
            session_id=session_id,
            environment_id=environment_id,
            resource_id=resource_id,
            epoch=epoch,
            captured_at=datetime.now(timezone.utc).isoformat(),
            provider_id=self.provider_id,
            provider_version="0.1.0-p1",
            roots=roots,
            elements=elements,
            image=image,
            metadata={
                "backend": config.backend,
                "serial": config.serial,
                "foreground_app": foreground,
                "ui_tree_raw": self._serialize_tree(ui_tree),
            },
        )

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        action = step.action
        arguments = dict(step.arguments)
        if step.target and step.target.x is not None and step.target.y is not None:
            arguments.setdefault("x", step.target.x)
            arguments.setdefault("y", step.target.y)
        if step.target and step.target.ref:
            arguments.setdefault("ref", step.target.ref)

        try:
            result = await self._execute_mobile_action(
                transaction.environment_id, action, arguments
            )
            status = OutcomeStatus.WORKED.value if result.get("success") else OutcomeStatus.UNKNOWN.value
            return StepOutcome(
                index=index,
                status=status,
                evidence=ActionEvidence(
                    grounding="droidrun_device",
                    delivery="mobilerun-core",
                    details=result,
                ),
            )
        except Exception as exc:  # noqa: BLE001
            return StepOutcome(
                index=index,
                status=OutcomeStatus.DIDNT.value,
                evidence=ActionEvidence(
                    grounding="droidrun_device",
                    delivery="mobilerun-core",
                    details={"action": action, "arguments": arguments},
                ),
                error_code="droidrun_action_failed",
                message=str(exc),
            )

    async def close(self) -> None:
        for environment_id in list(self._instances):
            try:
                await self.stop(environment_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error stopping DroidRun environment %s: %s", environment_id, exc)
        self._instances.clear()
        self._mobilerun = None

    # ------------------------------------------------------------------
    # Environment backend contract
    # ------------------------------------------------------------------

    def manifest(self) -> EnvironmentBackendManifest:
        """Return the environment-backend manifest for the canonical registry."""
        available = _MOBILERUN_AVAILABLE and shutil.which("adb") is not None
        return EnvironmentBackendManifest(
            provider_id=self.provider_id,
            operating_systems=("android",),
            isolations=("host",),
            available=available,
            reason=None if available else "mobilerun_core_or_adb_unavailable",
            capabilities=("mobile", "screen", "shell", "files"),
        )

    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]:
        if not _MOBILERUN_AVAILABLE:
            raise RuntimeError(
                "mobilerun_core is not installed. "
                "Install it with: pip install 'mobilerun-core[local]'"
            )
        if record.os != "android":
            raise ValueError("DroidRun provider only supports Android environments")

        config = self._config_from_record(record)
        mobilerun = self._ensure_mobilerun()

        if config.backend == "cloud":
            if not config.cloud_device_id:
                raise ValueError("cloud backend requires metadata['cloud_device_id']")
            device = mobilerun.connect(config.cloud_device_id, backend="cloud")
        elif config.backend == "local-android-http":
            if not config.portal_url:
                raise ValueError("local-android-http backend requires metadata['portal_url']")
            connect_kwargs: Dict[str, Any] = {"backend": "local-android-http", "url": config.portal_url}
            if config.portal_token:
                connect_kwargs["token"] = config.portal_token
            device = mobilerun.connect(**connect_kwargs)
        else:
            connect_kwargs = {"backend": "local-android-adb"}
            if config.serial:
                connect_kwargs["config.serial"] = config.serial
            device = mobilerun.connect(config.serial, **connect_kwargs)

        self._instances[record.environment_id] = {
            "device": device,
            "config": config,
            "record": record,
        }
        return {
            "backend": config.backend,
            "serial": config.serial,
            "cloud_device_id": config.cloud_device_id,
        }

    async def stop(self, environment_id: str) -> None:
        instance = self._instances.pop(environment_id, None)
        if instance is None:
            return
        device = instance.get("device")
        if device is not None and hasattr(device, "close"):
            try:
                await self._asyncify(device.close)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error closing DroidRun device: %s", exc)

    async def execute(
        self,
        environment_id: str,
        command: list[str],
        env: Dict[str, str],
    ) -> Dict[str, Any]:
        """Run a shell command on the Android device via ADB."""
        config = self._config(environment_id)
        if config.backend != "local-android-adb":
            raise RuntimeError("Shell execution requires local-android-adb backend")
        proc = self._adb_run(config, "shell", *command)
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }

    async def mobile_action(
        self,
        environment_id: str,
        action: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        return await self._execute_mobile_action(environment_id, action, arguments)

    async def screenshot(self, environment_id: str) -> Dict[str, Any]:
        device = self._device(environment_id)
        screenshot_bytes = await self._asyncify(device.screenshot)
        return {
            "image_b64": base64.b64encode(screenshot_bytes).decode("ascii"),
            "media_type": "image/png",
        }

    async def push_file(
        self,
        environment_id: str,
        local_path: str,
        remote_path: str,
    ) -> Dict[str, Any]:
        config = self._config(environment_id)
        if config.backend != "local-android-adb":
            raise RuntimeError("File push requires local-android-adb backend")
        proc = self._adb_run(config, "push", local_path, remote_path)
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }

    async def pull_file(
        self,
        environment_id: str,
        remote_path: str,
        local_path: str,
    ) -> Dict[str, Any]:
        config = self._config(environment_id)
        if config.backend != "local-android-adb":
            raise RuntimeError("File pull requires local-android-adb backend")
        proc = self._adb_run(config, "pull", remote_path, local_path)
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }

    # ------------------------------------------------------------------
    # Mobile action dispatch
    # ------------------------------------------------------------------

    async def _execute_mobile_action(
        self,
        environment_id: str,
        action: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        device = self._device(environment_id)
        config = self._config(environment_id)

        if action == "screenshot":
            return await self.screenshot(environment_id)

        if action == "tap":
            text = arguments.get("text")
            if text:
                await self._asyncify(device.tap_text, str(text))
                return {"success": True}
            x = int(arguments.get("x", 0))
            y = int(arguments.get("y", 0))
            # Portal / some backends support tap(x, y); fall back to adb shell.
            if hasattr(device, "tap"):
                await self._asyncify(device.tap, x, y)
            else:
                proc = self._adb_run(config, "shell", "input", "tap", str(x), str(y))
                if proc.returncode != 0:
                    raise RuntimeError(f"adb tap failed: {proc.stderr}")
            return {"success": True, "x": x, "y": y}

        if action == "swipe":
            x1 = int(arguments.get("x1", 0))
            y1 = int(arguments.get("y1", 0))
            x2 = int(arguments.get("x2", 0))
            y2 = int(arguments.get("y2", 0))
            duration_ms = int(arguments.get("duration_ms", 300))
            # Prefer device.scroll if given a direction/distance; otherwise adb.
            if hasattr(device, "swipe"):
                await self._asyncify(device.swipe, x1, y1, x2, y2, duration_ms)
            else:
                proc = self._adb_run(
                    config, "shell", "input", "swipe",
                    str(x1), str(y1), str(x2), str(y2), str(duration_ms),
                )
                if proc.returncode != 0:
                    raise RuntimeError(f"adb swipe failed: {proc.stderr}")
            return {"success": True}

        if action == "type":
            text = str(arguments.get("text", ""))
            if hasattr(device, "type"):
                await self._asyncify(device.type, text, clear=bool(arguments.get("clear", True)))
            else:
                escaped = text.replace(" ", "%s")
                proc = self._adb_run(config, "shell", "input", "text", escaped)
                if proc.returncode != 0:
                    raise RuntimeError(f"adb type failed: {proc.stderr}")
            return {"success": True}

        if action == "key":
            keycode = arguments.get("key", 4)
            if hasattr(device, "press_key"):
                await self._asyncify(device.press_key, str(keycode))
            else:
                proc = self._adb_run(config, "shell", "input", "keyevent", str(keycode))
                if proc.returncode != 0:
                    raise RuntimeError(f"adb keyevent failed: {proc.stderr}")
            return {"success": True}

        if action == "launch_app":
            package = str(arguments.get("package", ""))
            if not package:
                raise ValueError("launch_app requires 'package'")
            await self._asyncify(device.start_app, package)
            return {"success": True, "package": package}

        if action == "shell":
            command = arguments.get("command", [])
            if isinstance(command, str):
                command = [command]
            return await self.execute(environment_id, list(command), {})

        if action == "push_file":
            return await self.push_file(
                environment_id,
                str(arguments.get("local_path", "")),
                str(arguments.get("remote_path", "")),
            )

        if action == "pull_file":
            return await self.pull_file(
                environment_id,
                str(arguments.get("remote_path", "")),
                str(arguments.get("local_path", "")),
            )

        if action == "ui_tree":
            ui_tree = await self._asyncify(device.ui)
            return {
                "success": True,
                "ui_tree": self._serialize_tree(ui_tree),
                "element_count": len(list(self._convert_ui_tree(ui_tree))),
            }

        if action == "plan":
            goal = str(arguments.get("goal", ""))
            return await self._plan_loop(environment_id, goal, config.plan_max_steps)

        raise ValueError(f"Unsupported DroidRun mobile action: {action!r}")

    async def _plan_loop(
        self,
        environment_id: str,
        goal: str,
        max_steps: int,
    ) -> Dict[str, Any]:
        """Thin observe-act stub compatible with droidrun's observe-act-verify loop."""
        steps: list[Dict[str, Any]] = []
        for step in range(max_steps):
            try:
                observation = await self.observe(
                    session_id=f"plan_{uuid4().hex}",
                    environment_id=environment_id,
                    resource_id=f"android:{environment_id}",
                    epoch=step,
                )
                steps.append({
                    "step": step,
                    "state_id": observation.state_id,
                    "foreground_app": observation.metadata.get("foreground_app"),
                })
                # A real planner would choose an action here. We stop after one
                # observation so the integration does not perform unbounded work.
                break
            except Exception as exc:  # noqa: BLE001
                steps.append({"step": step, "error": str(exc)})
                break
        return {"success": True, "goal": goal, "steps": steps, "completed": True}

    # ------------------------------------------------------------------
    # Serialization / conversion helpers
    # ------------------------------------------------------------------

    def _config_from_record(self, record: EnvironmentRecord) -> DroidRunConfig:
        metadata = dict(record.metadata or {})
        return DroidRunConfig(
            backend=str(metadata.get("backend", "local-android-adb")),
            serial=metadata.get("serial") or metadata.get("adb_serial"),
            portal_url=metadata.get("portal_url"),
            portal_token=metadata.get("portal_token"),
            cloud_device_id=metadata.get("cloud_device_id"),
            adb_path=str(metadata.get("adb_path", "adb")),
            plan_max_steps=int(metadata.get("plan_max_steps", 10)),
        )

    def _image_evidence(self, screenshot_bytes: bytes) -> Optional[ImageEvidence]:
        if not screenshot_bytes:
            return None
        width, height = 1, 1
        try:
            from PIL import Image

            image = Image.open(io.BytesIO(screenshot_bytes))
            width, height = image.size
        except Exception:  # noqa: BLE001
            pass
        artifact_id = f"artifact_{uuid4().hex}"
        return ImageEvidence(
            artifact_id=artifact_id,
            media_type="image/png",
            width=width,
            height=height,
            sha256=hashlib.sha256(screenshot_bytes).hexdigest(),
            coordinate_space="screen",
        )

    def _serialize_tree(self, tree: Any) -> Any:
        if tree is None:
            return None
        if isinstance(tree, (str, bytes)):
            return tree if isinstance(tree, str) else tree.decode("utf-8", errors="replace")
        try:
            return json.loads(json.dumps(tree, default=str))
        except Exception:  # noqa: BLE001
            return str(tree)

    def _convert_ui_tree(self, tree: Any) -> Iterable[ElementNode]:
        """Best-effort conversion of a mobilerun UI tree to canonical ElementNodes."""
        if tree is None:
            return
        if isinstance(tree, dict):
            # Some backends return a list of nodes under a 'nodes' key.
            nodes = tree.get("nodes") or tree.get("elements") or tree.get("children")
            if isinstance(nodes, list):
                yield from self._convert_ui_tree(nodes)
            else:
                yield from self._convert_node(tree, ref="@e1")
        elif isinstance(tree, list):
            for index, node in enumerate(tree, start=1):
                yield from self._convert_node(node, ref=f"@e{index}")

    def _convert_node(self, node: Any, ref: str) -> Iterable[ElementNode]:
        if not isinstance(node, dict):
            return
        bounds = node.get("bounds") or node.get("frame") or node.get("rect")
        rect = self._rect(bounds)
        yield ElementNode(
            ref=ref,
            role=str(node.get("role", node.get("type", node.get("class", "")))),
            name=str(node.get("text", node.get("name", node.get("label", "")))),
            value=str(node.get("value", "")),
            description=str(node.get("content_desc", node.get("description", ""))),
            bounds=rect,
            states=tuple(),
            actions=tuple(),
            provider_metadata={
                "resource_id": node.get("resource_id") or node.get("resource-id"),
                "package": node.get("package"),
                "bounds_raw": bounds,
            },
        )
        children = node.get("children")
        if isinstance(children, list):
            for index, child in enumerate(children, start=1):
                yield from self._convert_node(child, ref=f"{ref}.{index}")

    @staticmethod
    def _rect(value: Any) -> Optional[Rect]:
        if not isinstance(value, dict):
            return None
        x = value.get("x", value.get("left", 0))
        y = value.get("y", value.get("top", 0))
        width = value.get("width", value.get("w"))
        height = value.get("height", value.get("h"))
        if width is None or height is None:
            return None
        return Rect(float(x), float(y), float(width), float(height))

    @staticmethod
    async def _asyncify(sync_callable: Any, *args: Any, **kwargs: Any) -> Any:
        """Run a synchronous mobilerun call in a thread pool."""
        import asyncio

        return await asyncio.to_thread(sync_callable, *args, **kwargs)


def create_droidrun_provider() -> DroidRunCanonicalProvider:
    """Factory used by the canonical router registration."""
    return DroidRunCanonicalProvider()
