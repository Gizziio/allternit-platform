"""Canonical compatibility provider for Allternit's existing accessibility adapter."""

from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
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


class AccessibilityCanonicalProvider:
    provider_id = "desktop.accessibility.canonical"

    def __init__(self, adapter: Any, artifact_dir: str | Path) -> None:
        self._adapter = adapter
        self._artifact_dir = Path(artifact_dir)
        self._state_elements: Dict[str, Dict[str, Any]] = {}
        self._state_order: list[str] = []

    async def capabilities(self) -> CapabilityManifest:
        legacy = await self._adapter.capabilities()
        platform = str(legacy.get("platform", "")).lower()
        os_name = "macos" if platform == "darwin" else platform
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            operating_systems=(os_name,) if os_name in ("macos", "windows", "linux") else (),
            actions=(
                "click", "doubleClick", "rightClick", "typeText", "setText",
                "keypress", "scroll", "drag", "focus", "launchApp", "closeApp",
                "moveWindow", "resizeWindow", "minimizeWindow", "maximizeWindow",
                "clipboardRead", "clipboardWrite",
            ),
            observation_channels=("accessibility", "screenshot"),
            execution_modes=(ExecutionMode.FOREGROUND_ALLOWED.value,),
            strict_background=False,
            semantic_input=True,
            raw_input=True,
            clipboard=True,
            max_concurrency=1,
            limitations=(
                "compatibility_provider",
                "may_fallback_to_global_input",
                "must_not_be_selected_for_background_strict",
            ),
        )

    async def _application(self, resource_id: str) -> str:
        if resource_id.startswith("desktop-app:"):
            return resource_id.split(":", 1)[1]
        apps = await self._adapter.get_running_apps()
        if not apps:
            raise RuntimeError("No running desktop application is available")
        return str(apps[0])

    async def discover_roots(self, *, session_id: str, environment_id: str) -> tuple[Root, ...]:
        apps = await self._adapter.get_running_apps()
        return tuple(
            Root(
                root_id=f"root_desktop-app:{application}",
                resource_id=f"desktop-app:{application}",
                kind="application",
                title=str(application),
                application=str(application),
                focused=index == 0,
            )
            for index, application in enumerate(apps)
        )

    def _remember(self, state_id: str, values: Dict[str, Any]) -> None:
        self._state_elements[state_id] = values
        self._state_order.append(state_id)
        while len(self._state_order) > 128:
            self._state_elements.pop(self._state_order.pop(0), None)

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation:
        application = await self._application(resource_id)
        snapshot = await self._adapter.get_app_snapshot(application)
        state_id = f"state_{uuid4().hex}"
        state_elements: Dict[str, Any] = {}
        elements = []
        for index, legacy in enumerate(snapshot.elements, start=1):
            ref = f"@e{index}"
            state_elements[ref] = legacy
            frame = legacy.frame
            bounds = None
            if frame is not None:
                bounds = Rect(float(frame[0]), float(frame[1]), float(frame[2]), float(frame[3]))
            actions = ["click"] if bounds is not None else []
            if str(legacy.role) in ("AXTextField", "AXTextArea", "AXSearchField", "text", "entry"):
                actions.extend(("setText", "typeText"))
            elements.append(
                ElementNode(
                    ref=ref,
                    role=str(legacy.role),
                    name=str(legacy.title or ""),
                    value=str(legacy.value or ""),
                    description=str(legacy.description or ""),
                    bounds=bounds,
                    states=(),
                    actions=tuple(actions),
                    provider_metadata={"legacy_ref": legacy.ref_id},
                )
            )

        image = None
        metadata: Dict[str, Any] = {"application": application}
        screenshot_result = await self._adapter.execute("take_screenshot", {})
        encoded = screenshot_result.get("image_b64") if screenshot_result.get("success") else None
        if encoded:
            screenshot = base64.b64decode(encoded)
            self._artifact_dir.mkdir(parents=True, exist_ok=True)
            artifact_id = f"artifact_{uuid4().hex}"
            path = self._artifact_dir / f"{artifact_id}.png"
            path.write_bytes(screenshot)
            try:
                from PIL import Image
                with Image.open(path) as opened:
                    width, height = opened.size
            except Exception:
                width, height = 1, 1
            image = ImageEvidence(
                artifact_id=artifact_id,
                media_type="image/png",
                width=width,
                height=height,
                sha256=hashlib.sha256(screenshot).hexdigest(),
                coordinate_space="global_screen_pixels",
            )
            metadata["artifact_path"] = str(path)

        self._remember(state_id, state_elements)
        return Observation(
            state_id=state_id,
            session_id=session_id,
            environment_id=environment_id,
            resource_id=resource_id,
            epoch=epoch,
            captured_at=datetime.now(timezone.utc).isoformat(),
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            roots=(
                Root(
                    root_id=f"root_{resource_id}",
                    resource_id=resource_id,
                    kind="window",
                    title=application,
                    application=application,
                    focused=False,
                ),
            ),
            elements=tuple(elements),
            image=image,
            metadata=metadata,
        )

    def _legacy_element(self, transaction: ActionTransaction, step: ActionStep) -> Optional[Any]:
        if step.target is None or step.target.ref is None:
            return None
        mapping = self._state_elements.get(transaction.base_state_id)
        if mapping is None:
            raise ValueError(f"Provider mapping for state {transaction.base_state_id!r} was evicted")
        try:
            return mapping[step.target.ref]
        except KeyError as error:
            raise ValueError(f"Unknown ref {step.target.ref!r}") from error

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        legacy_element = self._legacy_element(transaction, step)
        params = dict(step.arguments)
        if legacy_element is not None:
            if legacy_element.ref_id:
                params["ref"] = legacy_element.ref_id
            center = legacy_element.center()
            if center:
                params.setdefault("x", center[0])
                params.setdefault("y", center[1])
        elif step.target and step.target.x is not None and step.target.y is not None:
            params["x"], params["y"] = step.target.x, step.target.y

        action_map = {
            "click": "click", "doubleClick": "double_click", "rightClick": "right_click",
            "typeText": "type_text", "setText": "set_value", "keypress": "press_key",
            "scroll": "scroll", "drag": "drag", "focus": "focus",
            "launchApp": "launch_app", "closeApp": "close_app", "moveWindow": "move_window",
            "resizeWindow": "resize_window", "minimizeWindow": "minimize_window",
            "maximizeWindow": "maximize_window", "clipboardRead": "get_clipboard",
            "clipboardWrite": "set_clipboard",
        }
        result = await self._adapter.execute(action_map[step.action], params)
        delivered = bool(result.get("success"))
        return StepOutcome(
            index=index,
            status=OutcomeStatus.UNKNOWN.value if delivered else OutcomeStatus.DIDNT.value,
            evidence=ActionEvidence(
                grounding="accessibility_ref" if legacy_element is not None else "screen_coordinate",
                delivery="legacy_accessibility_adapter",
                details={
                    "event_delivered": delivered,
                    "legacy_result": {key: value for key, value in result.items() if key != "image_b64"},
                    "may_use_global_input": True,
                },
            ),
            error_code=None if delivered else "legacy_action_failed",
            message=(
                "Input was delivered; semantic success requires a transaction postcondition"
                if delivered else str(result.get("error", "Legacy action failed"))
            ),
        )

    async def close(self) -> None:
        return None
