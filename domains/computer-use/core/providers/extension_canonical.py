"""Canonical provider over the existing Allternit browser extension relay."""

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
    Root,
    StepOutcome,
)
from core.base_adapter import ActionRequest
from core.tree_normalizer import normalize_tree


class ExtensionCanonicalProvider:
    provider_id = "browser.extension.canonical"

    def __init__(self, adapter: Any, artifact_dir: str | Path) -> None:
        self._adapter = adapter
        self._artifact_dir = Path(artifact_dir)
        self._state_selectors: Dict[str, Dict[str, str]] = {}
        self._state_order: list[str] = []

    async def capabilities(self) -> CapabilityManifest:
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version="1.0.0-alpha.1",
            operating_systems=("macos", "windows", "linux"),
            actions=("navigate", "click", "setText", "typeText", "keypress", "scroll", "wait"),
            observation_channels=("dom", "accessibility", "screenshot", "extension"),
            execution_modes=(ExecutionMode.BACKGROUND_STRICT.value, ExecutionMode.FOREGROUND_ALLOWED.value),
            strict_background=True,
            semantic_input=True,
            raw_input=False,
            max_concurrency=1,
            limitations=("active_extension_tab", "requires_desktop_native_messaging_relay"),
        )

    async def discover_roots(self, *, session_id: str, environment_id: str) -> tuple[Root, ...]:
        context = await self._adapter.execute(
            ActionRequest(action_type="tabs"), session_id, f"discover-{uuid4().hex}"
        )
        if context.status != "completed":
            return ()
        data = context.extracted_content if isinstance(context.extracted_content, dict) else {}
        tabs = data.get("tabs")
        if not isinstance(tabs, list):
            tabs = [data]
        roots = []
        for index, tab in enumerate(tabs):
            if not isinstance(tab, dict):
                continue
            tab_id = tab.get("tabId", tab.get("tab_id", index))
            roots.append(
                Root(
                    root_id=f"root_extension-tab:{tab_id}",
                    resource_id=f"extension-tab:{tab_id}",
                    kind="browser_page",
                    title=str(tab.get("title", "")),
                    application="browser-extension",
                    focused=bool(tab.get("active", index == 0)),
                )
            )
        return tuple(roots) or (
            Root(
                root_id="root_extension-tab:active",
                resource_id="extension-tab:active",
                kind="browser_page",
                application="browser-extension",
                focused=True,
            ),
        )

    def _remember(self, state_id: str, selectors: Dict[str, str]) -> None:
        self._state_selectors[state_id] = selectors
        self._state_order.append(state_id)
        while len(self._state_order) > 128:
            self._state_selectors.pop(self._state_order.pop(0), None)

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation:
        context_result = await self._adapter.execute(
            ActionRequest(
                action_type="get_context",
                parameters={"include_dom": True, "include_a11y": True},
            ),
            session_id,
            f"observe-{uuid4().hex}",
        )
        if context_result.status != "completed":
            raise RuntimeError(str(context_result.error or "Extension context capture failed"))
        context = context_result.extracted_content if isinstance(context_result.extracted_content, dict) else {}
        forest = normalize_tree(context.get("tree", context.get("dom", context.get("elements", context))))
        selectors = forest.provider_targets
        elements = list(forest.roots)
        if not elements:
            elements.append(
                ElementNode(
                    ref="@e1",
                    role="document",
                    name=str(context.get("title", "")),
                    provider_metadata={},
                )
            )

        screenshot_result = await self._adapter.execute(
            ActionRequest(action_type="screenshot"),
            session_id,
            f"screenshot-{uuid4().hex}",
        )
        image = None
        metadata: Dict[str, Any] = {
            "url": context.get("url"),
            "title": context.get("title"),
        }
        screenshot_data = screenshot_result.extracted_content if isinstance(screenshot_result.extracted_content, dict) else {}
        data_url = screenshot_data.get("data_url") if screenshot_result.status == "completed" else None
        if isinstance(data_url, str) and data_url:
            header, encoded = data_url.split(",", 1) if "," in data_url else ("", data_url)
            try:
                payload = base64.b64decode(encoded, validate=True)
            except (ValueError, base64.binascii.Error) as error:
                metadata["screenshot_error"] = f"invalid_base64:{type(error).__name__}"
                payload = b""
            media_type = header[5:].split(";", 1)[0] if header.startswith("data:") else "image/png"
        else:
            payload = b""
            media_type = "image/png"
            if screenshot_result.status != "completed":
                metadata["screenshot_error"] = str(screenshot_result.error or screenshot_result.status)

        if payload:
            self._artifact_dir.mkdir(parents=True, exist_ok=True)
            artifact_id = f"artifact_{uuid4().hex}"
            suffix = ".jpeg" if media_type == "image/jpeg" else ".png"
            path = self._artifact_dir / f"{artifact_id}{suffix}"
            path.write_bytes(payload)
            image = ImageEvidence(
                artifact_id=artifact_id,
                media_type=media_type,
                width=max(1, int(context.get("viewportWidth", context.get("width", 1)))),
                height=max(1, int(context.get("viewportHeight", context.get("height", 1)))),
                sha256=hashlib.sha256(payload).hexdigest(),
                coordinate_space="extension_viewport_pixels",
            )
            metadata["artifact_path"] = str(path)

        state_id = f"state_{uuid4().hex}"
        self._remember(state_id, selectors)
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
                    kind="browser_page",
                    title=str(context.get("title", "")),
                    application="browser-extension",
                    focused=True,
                ),
            ),
            elements=tuple(elements),
            image=image,
            truncated=forest.truncated or bool(context.get("truncated", False)),
            metadata=metadata,
        )

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        action_map = {
            "navigate": "navigate", "click": "left_click", "setText": "fill",
            "typeText": "type", "keypress": "key", "scroll": "scroll", "wait": "wait",
        }
        parameters = dict(step.arguments)
        target = ""
        if step.target and step.target.ref:
            selectors = self._state_selectors.get(transaction.base_state_id, {})
            target = selectors.get(step.target.ref, "")
            if not target:
                return StepOutcome(
                    index=index,
                    status=OutcomeStatus.DIDNT.value,
                    evidence=ActionEvidence(grounding="extension_dom", delivery="extension_relay"),
                    error_code="selector_unavailable",
                    message=f"No extension selector is available for {step.target.ref}",
                )
        elif step.target and step.target.x is not None and step.target.y is not None:
            parameters.update({"x": step.target.x, "y": step.target.y})
        request = ActionRequest(
            action_type=action_map[step.action],
            target=target or str(parameters.get("url", "")),
            parameters=parameters,
        )
        envelope = await self._adapter.execute(
            request,
            transaction.session_id,
            transaction.transaction_id,
        )
        if envelope.status == "failed":
            status = OutcomeStatus.DIDNT.value
        elif envelope.status == "unsupported":
            status = OutcomeStatus.BLOCKED.value
        else:
            status = OutcomeStatus.UNKNOWN.value
        return StepOutcome(
            index=index,
            status=status,
            evidence=ActionEvidence(
                grounding="extension_dom" if target else "extension_command",
                delivery="native_messaging_extension_relay",
                details={"legacy_status": envelope.status, "trace_id": envelope.trace_id},
            ),
            error_code=(envelope.error or {}).get("code") if envelope.error else None,
            message=(envelope.error or {}).get("message") if envelope.error else None,
        )

    async def close(self) -> None:
        await self._adapter.close()
