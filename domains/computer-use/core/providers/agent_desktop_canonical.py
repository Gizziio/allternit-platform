"""Canonical provider backed by the agent-desktop Rust CLI."""

from __future__ import annotations

import base64
import hashlib
import platform
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
    OutcomeStatus,
    Rect,
    Root,
    StepOutcome,
)
from providers.agent_desktop_transport import AgentDesktopCallError, AgentDesktopTransport


def _app_name(resource_id: str) -> str:
    if resource_id.startswith("desktop-app:"):
        return resource_id.split(":", 1)[1]
    return resource_id


def _rect(value: Any) -> Optional[Rect]:
    if not isinstance(value, dict):
        return None
    width = value.get("width")
    height = value.get("height")
    if width is None or height is None:
        return None
    return Rect(
        float(value.get("x", 0)),
        float(value.get("y", 0)),
        float(width),
        float(height),
    )


def _walk_nodes(node: Any) -> Iterable[Dict[str, Any]]:
    if not isinstance(node, dict):
        return
    yield node
    for child in node.get("children", []):
        yield from _walk_nodes(child)


class AgentDesktopCanonicalProvider:
    provider_id = "desktop.agent-desktop.canonical"

    def __init__(
        self,
        transport: AgentDesktopTransport,
        artifact_dir: str | Path,
        *,
        version: str = "unknown",
        authority: Any = None,
        backend: Any = None,
    ) -> None:
        self._transport = transport
        self._artifact_dir = Path(artifact_dir)
        self._version = version
        self._authority = authority
        self._backend = backend
        self._environment_id: Optional[str] = None
        self._state_tokens: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._state_order: list[str] = []

    async def capabilities(self) -> CapabilityManifest:
        system = platform.system().lower()
        os_name = "macos" if system == "darwin" else system
        return CapabilityManifest(
            provider_id=self.provider_id,
            provider_version=self._version,
            operating_systems=(os_name,) if os_name == "macos" else (),
            actions=(
                "click",
                "doubleClick",
                "rightClick",
                "typeText",
                "setText",
                "keypress",
                "scroll",
                "focus",
                "launchApp",
                "closeApp",
                "clipboardRead",
                "clipboardWrite",
            ),
            observation_channels=("accessibility", "screenshot"),
            execution_modes=(ExecutionMode.FOREGROUND_ALLOWED.value,),
            strict_background=False,
            semantic_input=True,
            raw_input=True,
            clipboard=True,
            max_concurrency=1,
            limitations=(
                "installed_external_provider",
                "host_access_required",
                "macos_13_plus",
            ),
        )

    async def _ensure_host_environment(self) -> None:
        if self._authority is None or self._backend is None:
            return
        is_running = getattr(self._backend, "is_running", lambda _id: False)
        if self._environment_id and is_running(self._environment_id):
            return
        system = platform.system()
        os_name = "macos" if system == "Darwin" else system.lower()
        record = self._authority.create_environment(
            owner_id="allternit.agent-desktop",
            provider_id=self._backend.provider_id,
            os=os_name,
            isolation="host",
            image_digest=None,
            ttl_seconds=None,
            metadata={},
        )
        self._authority.transition(record.environment_id, "provisioning")
        await self._backend.provision(record)
        self._authority.transition(record.environment_id, "running")
        self._environment_id = record.environment_id

    def _remember(self, state_id: str, values: Dict[str, Dict[str, Any]]) -> None:
        self._state_tokens[state_id] = values
        self._state_order.append(state_id)
        while len(self._state_order) > 128:
            self._state_tokens.pop(self._state_order.pop(0), None)

    async def discover_roots(
        self,
        *,
        session_id: str,
        environment_id: str,
    ) -> Tuple[Root, ...]:
        await self._ensure_host_environment()
        envelope = await self._transport.call("list-apps", session_id=session_id)
        data = envelope.get("data", {})
        apps = data.get("apps", []) if isinstance(data, dict) else []
        if not isinstance(apps, list):
            apps = []
        roots = []
        for app in apps:
            if not isinstance(app, dict):
                continue
            name = app.get("name")
            if not name:
                continue
            resource_id = f"desktop-app:{name}"
            roots.append(
                Root(
                    root_id=f"root_{resource_id}",
                    resource_id=resource_id,
                    kind="application",
                    title=str(name),
                    application=str(name),
                    process_id=int(app["pid"]) if app.get("pid") is not None else None,
                    focused=False,
                )
            )
        return tuple(roots)

    async def _capture_screenshot(
        self,
        app: str,
        session_id: str,
    ) -> Optional[ImageEvidence]:
        try:
            envelope = await self._transport.call(
                "screenshot", "--app", app, session_id=session_id
            )
        except Exception:
            return None
        data = envelope.get("data", {})
        encoded = data.get("data")
        if not encoded:
            return None
        payload = base64.b64decode(encoded)
        if not payload:
            return None
        self._artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_id = f"artifact_{uuid4().hex}"
        path = self._artifact_dir / f"{artifact_id}.png"
        path.write_bytes(payload)
        width = int(data.get("width", 1))
        height = int(data.get("height", 1))
        return ImageEvidence(
            artifact_id=artifact_id,
            media_type=f"image/{data.get('format', 'png')}",
            width=max(1, width),
            height=max(1, height),
            sha256=hashlib.sha256(payload).hexdigest(),
            coordinate_space="screen",
        )

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation:
        await self._ensure_host_environment()
        app = _app_name(resource_id)
        envelope = await self._transport.call(
            "snapshot",
            "--app",
            app,
            "-i",
            "--include-bounds",
            session_id=session_id,
        )
        data = envelope.get("data", {})
        tree = data.get("tree", {})
        snapshot_id = data.get("snapshot_id")

        state_id = f"state_{uuid4().hex}"
        tokens: Dict[str, Dict[str, Any]] = {}
        elements = []
        truncated = bool(data.get("truncated", not data.get("complete", True)))

        for offset, node in enumerate(_walk_nodes(tree), start=1):
            if not isinstance(node, dict):
                continue
            ref = f"@e{offset}"
            agent_ref = node.get("ref_id")
            bounds = _rect(node.get("bounds"))
            available_actions = node.get("available_actions", [])
            if not isinstance(available_actions, list):
                available_actions = []
            tokens[ref] = {
                "agent_ref": agent_ref,
                "snapshot_id": snapshot_id,
                "role": node.get("role"),
            }
            if node.get("subtree_truncated"):
                truncated = True
            elements.append(
                ElementNode(
                    ref=ref,
                    role=str(node.get("role", "")),
                    name=str(node.get("name") or ""),
                    value=str(node.get("value") or ""),
                    description=str(node.get("description") or ""),
                    bounds=bounds,
                    states=tuple(str(value) for value in node.get("states", [])),
                    actions=tuple(str(value) for value in available_actions),
                    provider_metadata={
                        "agent_ref": agent_ref,
                        "snapshot_id": snapshot_id,
                    },
                )
            )

        image = await self._capture_screenshot(app, session_id)
        self._remember(state_id, tokens)

        return Observation(
            state_id=state_id,
            session_id=session_id,
            environment_id=environment_id,
            resource_id=resource_id,
            epoch=epoch,
            captured_at=datetime.now(timezone.utc).isoformat(),
            provider_id=self.provider_id,
            provider_version=self._version,
            roots=(
                Root(
                    root_id=f"root_{resource_id}",
                    resource_id=resource_id,
                    kind="application",
                    title=app,
                    application=app,
                    focused=False,
                ),
            ),
            elements=tuple(elements),
            image=image,
            truncated=truncated,
            metadata={
                "app": app,
                "snapshot_id": snapshot_id,
                "agent_executable": self._transport.executable,
            },
        )

    def _agent_ref(
        self,
        transaction: ActionTransaction,
        step: ActionStep,
    ) -> Optional[str]:
        if step.target is None or step.target.ref is None:
            return None
        mapping = self._state_tokens.get(transaction.base_state_id)
        if mapping is None:
            raise ValueError(
                f"Agent-desktop mapping for state {transaction.base_state_id!r} was evicted"
            )
        try:
            return mapping[step.target.ref]["agent_ref"]
        except KeyError as error:
            raise ValueError(f"Unknown ref {step.target.ref!r}") from error

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome:
        await self._ensure_host_environment()
        agent_ref = self._agent_ref(transaction, step)
        params = dict(step.arguments)
        app = _app_name(transaction.resource_id)

        tool: Optional[str] = None
        args: list[str] = []

        if step.action == "click":
            tool, args = "click", [agent_ref]
        elif step.action == "doubleClick":
            tool, args = "double-click", [agent_ref]
        elif step.action == "rightClick":
            tool, args = "right-click", [agent_ref]
        elif step.action == "typeText":
            tool, args = "type", [agent_ref, str(params.get("text", ""))]
        elif step.action == "setText":
            tool, args = "set-value", [agent_ref, str(params.get("value", ""))]
        elif step.action == "keypress":
            combo = str(params.get("combo", params.get("key", "")))
            tool, args = "press", [combo]
        elif step.action == "scroll":
            tool = "scroll"
            args = [
                agent_ref,
                "--direction",
                str(params.get("direction", "down")),
                "--amount",
                str(params.get("amount", 3)),
            ]
        elif step.action == "focus":
            tool, args = "focus", [agent_ref]
        elif step.action == "launchApp":
            tool, args = "launch", [app]
        elif step.action == "closeApp":
            tool, args = "close-app", [app]
        elif step.action == "clipboardRead":
            tool, args = "clipboard-get", []
        elif step.action == "clipboardWrite":
            tool, args = "clipboard-set", [str(params.get("text", ""))]
        else:
            raise ValueError(f"Action {step.action!r} is not supported by {self.provider_id}")

        try:
            envelope = await self._transport.call(
                tool, *args, session_id=transaction.session_id
            )
            data = envelope.get("data", {})
            ok = bool(envelope.get("ok", True))
            status = OutcomeStatus.UNKNOWN.value if ok else OutcomeStatus.DIDNT.value
            return StepOutcome(
                index=index,
                status=status,
                evidence=ActionEvidence(
                    grounding="agent_desktop_ref" if agent_ref else "agent_desktop_global",
                    delivery="agent-desktop-cli",
                    details={"tool": tool, "envelope": envelope},
                ),
                error_code=None if ok else "agent_desktop_error",
                message=str(data.get("message", "")) or None,
            )
        except AgentDesktopCallError as error:
            return StepOutcome(
                index=index,
                status=OutcomeStatus.DIDNT.value,
                evidence=ActionEvidence(
                    grounding="agent_desktop_ref" if agent_ref else "agent_desktop_global",
                    delivery="agent-desktop-cli",
                    details={"tool": tool, "exit_code": error.exit_code},
                ),
                error_code=(error.code or "agent_desktop_call_failed").lower(),
                message=str(error),
            )

    async def close(self) -> None:
        return None
