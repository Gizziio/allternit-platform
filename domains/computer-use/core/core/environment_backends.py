"""Canonical environment backend registry over existing Allternit sandboxes."""

from __future__ import annotations

import logging
import os
import platform
import shutil
import importlib.util
import shlex
import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Protocol

from core.cloud_provisioning import strategy_for
from core.environment_authority import EnvironmentAuthority, EnvironmentRecord
from sandbox.base import BaseSandbox, SandboxBackend, SandboxConfig
from sandbox.factory import create_sandbox

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EnvironmentBackendManifest:
    provider_id: str
    operating_systems: tuple[str, ...]
    isolations: tuple[str, ...]
    available: bool
    reason: Optional[str] = None
    capabilities: tuple[str, ...] = ()


class EnvironmentBackend(Protocol):
    provider_id: str
    def manifest(self) -> EnvironmentBackendManifest: ...
    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]: ...
    async def stop(self, environment_id: str) -> None: ...
    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]: ...


class AllternitSandboxBackend:
    """Owns only sandbox instances it explicitly starts."""

    provider_id = "allternit.local-sandbox"

    def __init__(self) -> None:
        self._instances: Dict[str, BaseSandbox] = {}

    def manifest(self) -> EnvironmentBackendManifest:
        system = platform.system()
        if system == "Darwin":
            from sandbox.apple_virt_sandbox import APPLE_VIRT_AVAILABLE, _HELPER_PATH
            available = APPLE_VIRT_AVAILABLE and _HELPER_PATH.exists()
            return EnvironmentBackendManifest(
                self.provider_id, ("linux",), ("vm",), available,
                reason=None if available else "apple_virtualization_helper_unavailable",
                capabilities=("shell", "files", "network_policy", "artifact_export"),
            )
        if system == "Linux" and shutil.which("firecracker"):
            from sandbox.firecracker_sandbox import _DEFAULT_KERNEL, _DEFAULT_ROOTFS
            available = Path(_DEFAULT_KERNEL).is_file() and Path(_DEFAULT_ROOTFS).is_file()
            return EnvironmentBackendManifest(
                self.provider_id, ("linux",), ("vm",), available,
                reason=None if available else "firecracker_kernel_or_rootfs_unavailable",
                capabilities=("shell", "files", "network_policy", "artifact_export"),
            )
        return EnvironmentBackendManifest(
            self.provider_id, ("linux",), ("vm",), False,
            reason="supported_vm_backend_unavailable",
        )

    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]:
        manifest = self.manifest()
        if not manifest.available or record.isolation != "vm":
            raise RuntimeError(manifest.reason or "Local sandbox requires VM isolation")
        backend = SandboxBackend.APPLE_VIRT if platform.system() == "Darwin" else SandboxBackend.FIRECRACKER
        config = SandboxConfig(
            backend=backend,
            memory_mb=int(record.metadata.get("memory_mb", 2048)),
            vcpus=int(record.metadata.get("vcpus", 2)),
            network=record.metadata.get("network_policy", "denied") != "denied",
            readonly_root=bool(record.metadata.get("readonly_root", True)),
            extra={**record.metadata, "allow_process_fallback": False},
        )
        sandbox = create_sandbox(config)
        sandbox_id = await sandbox.start()
        self._instances[record.environment_id] = sandbox
        return {"sandbox_id": sandbox_id, "backend": backend.value}

    def _instance(self, environment_id: str) -> BaseSandbox:
        try:
            return self._instances[environment_id]
        except KeyError as error:
            raise KeyError(f"Environment {environment_id!r} is not owned by this process") from error

    async def stop(self, environment_id: str) -> None:
        sandbox = self._instance(environment_id)
        await sandbox.stop()
        self._instances.pop(environment_id, None)

    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]:
        if not command or any(not isinstance(part, str) or not part for part in command):
            raise ValueError("Command must be a non-empty argv array")
        result = await self._instance(environment_id).run(command, env)
        return asdict(result)


class CuaSandboxBackend:
    """Optional, local-only Cua Sandbox SDK integration."""

    provider_id = "cua.sandbox.local"

    def __init__(self) -> None:
        self._instances: Dict[str, Any] = {}

    def _cells(self) -> set[tuple[str, str]]:
        cells: set[tuple[str, str]] = set()
        if shutil.which("docker"):
            cells.add(("linux", "container"))
        if shutil.which("lume"):
            cells.add(("macos", "vm"))
        if shutil.which("qemu-system-aarch64") or shutil.which("qemu-system-x86_64"):
            cells.update({("linux", "vm"), ("windows", "vm"), ("android", "vm")})
        if platform.system() == "Windows":
            cells.add(("windows", "vm"))
        return cells

    def manifest(self) -> EnvironmentBackendManifest:
        installed = importlib.util.find_spec("cua_sandbox") is not None
        cells = self._cells()
        available = installed and bool(cells)
        return EnvironmentBackendManifest(
            self.provider_id, tuple(sorted({cell[0] for cell in cells})),
            tuple(sorted({cell[1] for cell in cells})), available,
            reason=None if available else "cua_sandbox_sdk_or_local_runtime_unavailable",
            capabilities=(
                "screen", "shell", "files", "clipboard", "mobile", "snapshots",
                *(f"cell:{os_name}:{isolation}" for os_name, isolation in sorted(cells)),
            ),
        )

    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]:
        if not self.manifest().available:
            raise RuntimeError("Cua Sandbox SDK or a supported local runtime is unavailable")
        if (record.os, record.isolation) not in self._cells():
            raise RuntimeError(
                f"No local Cua runtime proves support for {record.os}/{record.isolation}"
            )
        if record.metadata.get("network_policy", "denied") != "unrestricted":
            raise RuntimeError(
                "Cua local sandbox network enforcement is not yet verifiable; only an explicit unrestricted policy is supported"
            )
        from cua_sandbox import Image, Sandbox

        clone_reference = record.metadata.get("clone_backend_reference")
        if clone_reference:
            try:
                image = Image.from_dict(json.loads(str(clone_reference)))
            except (json.JSONDecodeError, TypeError, KeyError) as error:
                raise ValueError("Clone snapshot reference is invalid") from error
        else:
            image_factory = getattr(Image, record.os, None)
            if image_factory is None:
                raise ValueError(f"Cua Sandbox does not support OS {record.os!r}")
            distro = str(record.metadata.get("distro", "ubuntu"))
            version = str(record.metadata.get("version", "24.04"))
            if record.os == "linux":
                image = image_factory(distro, version, kind=record.isolation)
            else:
                image = image_factory(version, kind=record.isolation)
        sandbox = await Sandbox.create(
            image, name=record.environment_id, local=True,
            cpu=int(record.metadata.get("vcpus", 2)),
            memory_mb=int(record.metadata.get("memory_mb", 4096)),
            disk_gb=int(record.metadata.get("disk_gb", 32)),
            telemetry_enabled=False,
        )
        self._instances[record.environment_id] = sandbox
        return {"sandbox_name": sandbox.name, "local": True, "telemetry_enabled": False}

    def _instance(self, environment_id: str) -> Any:
        try:
            return self._instances[environment_id]
        except KeyError as error:
            raise KeyError(f"Cua sandbox {environment_id!r} is not owned by this process") from error

    async def stop(self, environment_id: str) -> None:
        sandbox = self._instance(environment_id)
        await sandbox.destroy()
        self._instances.pop(environment_id, None)

    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]:
        if env:
            assignments = " ".join(f"{key}={shlex.quote(value)}" for key, value in sorted(env.items()))
            command_text = f"env {assignments} {shlex.join(command)}"
        else:
            command_text = shlex.join(command)
        result = await self._instance(environment_id).shell.run(command_text)
        return {
            "success": result.success, "exit_code": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
            "sandbox_id": environment_id,
        }

    async def read_text(self, environment_id: str, path: str) -> str:
        return await self._instance(environment_id).files.read_text(path)

    async def write_text(self, environment_id: str, path: str, content: str) -> None:
        await self._instance(environment_id).files.write_text(path, content)

    async def list_files(self, environment_id: str, path: str) -> list[Dict[str, Any]]:
        return [asdict(item) for item in await self._instance(environment_id).files.list(path)]

    async def clipboard_get(self, environment_id: str) -> str:
        return await self._instance(environment_id).clipboard.get()

    async def clipboard_set(self, environment_id: str, text: str) -> None:
        await self._instance(environment_id).clipboard.set(text)

    async def export_artifact(
        self, environment_id: str, remote_path: str, output_path: Path, max_bytes: int,
    ) -> Dict[str, Any]:
        sandbox = self._instance(environment_id)
        size = await sandbox.files.size(remote_path)
        if size > max_bytes:
            raise ValueError(f"Artifact exceeds {max_bytes} byte export limit")
        data = await sandbox.files.read_bytes(remote_path, length=max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError(f"Artifact exceeds {max_bytes} byte export limit")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(data)
        return {"path": str(output_path), "size_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    async def mobile_action(self, environment_id: str, action: str, arguments: Dict[str, Any]) -> None:
        allowed = {
            "tap", "long_press", "double_tap", "type_text", "swipe", "scroll_up",
            "scroll_down", "scroll_left", "scroll_right", "fling", "pinch_in", "pinch_out",
            "key", "home", "back", "recents", "power", "volume_up", "volume_down",
            "enter", "backspace", "wake", "notifications", "close_notifications",
        }
        if action not in allowed:
            raise ValueError(f"Unsupported Android action {action!r}")
        handler = getattr(self._instance(environment_id).mobile, action)
        await handler(**arguments)

    async def create_snapshot(
        self, environment_id: str, name: Optional[str], stateful: bool,
    ) -> Dict[str, Any]:
        image = await self._instance(environment_id).snapshot(name=name, stateful=stateful)
        return image.to_dict()


class HostEnvironmentBackend:
    """Registers direct host control as an explicit, tracked environment type.

    Per ADR-0003 ("host control becomes one explicit environment type rather than
    the implicit default"): adapters that must drive the real on-screen session
    (Accessibility APIs, pyautogui) cannot be placed inside AllternitSandboxBackend
    or CuaSandboxBackend -- those only carry argv/stdout, no screen or input-event
    channel, and a VM/container cannot see the host's actual GUI session. This
    backend does not add hardware isolation; it makes host execution a provisioned,
    leased, audited environment like the VM-backed ones, instead of an adapter being
    called with no environment indirection at all.
    """

    provider_id = "allternit.host"

    def __init__(self) -> None:
        self._provisioned: set[str] = set()

    def manifest(self) -> EnvironmentBackendManifest:
        system = platform.system()
        os_name = "macos" if system == "Darwin" else system.lower()
        return EnvironmentBackendManifest(
            self.provider_id, (os_name,), ("host",), True,
            capabilities=("gui_action",),
        )

    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]:
        if record.isolation != "host":
            raise RuntimeError("HostEnvironmentBackend requires isolation='host'")
        self._provisioned.add(record.environment_id)
        return {"backend": self.provider_id}

    async def stop(self, environment_id: str) -> None:
        self._provisioned.discard(environment_id)

    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]:
        raise RuntimeError("HostEnvironmentBackend has no shell; host actions go through gui_action")

    def is_running(self, environment_id: str) -> bool:
        return environment_id in self._provisioned


class HostAdapterGate:
    """Wraps a host-driving adapter so every action requires a live host environment.

    Lazily provisions (and reuses) a single `isolation="host"` environment record
    the first time an action runs, then requires it to still be running on every
    subsequent call -- closing the "implicit default" gap without pretending to add
    isolation the adapter itself can't have.
    """

    def __init__(
        self,
        adapter: Any,
        *,
        authority: EnvironmentAuthority,
        backend: HostEnvironmentBackend,
        owner_id: str = "allternit.host-adapters",
    ) -> None:
        self._adapter = adapter
        self._authority = authority
        self._backend = backend
        self._owner_id = owner_id
        self._environment_id: Optional[str] = None

    def __getattr__(self, name: str) -> Any:
        # Read-only introspection (capabilities, get_running_apps, get_app_snapshot,
        # ...) passes straight through; only `execute` needs gating.
        return getattr(self._adapter, name)

    async def _ensure_environment(self) -> str:
        if self._environment_id and self._backend.is_running(self._environment_id):
            return self._environment_id
        system = platform.system()
        os_name = "macos" if system == "Darwin" else system.lower()
        record = self._authority.create_environment(
            owner_id=self._owner_id,
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
        return self._environment_id

    async def execute(self, action: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        await self._ensure_environment()
        return await self._adapter.execute(action, parameters)


class CustomerCloudBackend:
    """BYOC (Bring Your Own Cloud): provisions into a customer-supplied
    AWS/GCP/Azure account instead of allternit's infrastructure, for
    enterprise customers who need Tier-3 isolation without allternit
    operating its own always-on Firecracker/bare-metal fleet -- matches how
    E2B/Daytona offer BYOC to their enterprise tier.

    Provisioning is real: CloudProvisioningStrategy (cloud_provisioning.py)
    actually calls boto3/google-cloud-compute/azure-mgmt-compute to launch a
    standard VM in the customer's account and bootstrap the same
    Docker+Xvfb+xdotool sandbox ContainerGuiBackend runs locally
    (sandbox/container/Dockerfile) via cloud-init. This is VM-level isolation
    in the customer's cloud, not a Firecracker microVM -- a real, deliberate
    scope choice (see cloud_provisioning.py's module docstring), not a
    downgrade snuck in silently. What's verified in this environment:
    Protocol conformance, the full HTTP round trip (credential-resolve +
    usage-event POST) against a locally-running allternit-api, and every SDK
    call path exercised against mocked boto3/google-auth/azure-identity
    clients (no real cloud test account exists here to launch a real VM
    against).
    """

    provider_id = "allternit.customer-cloud"

    def __init__(self) -> None:
        self._environments: Dict[str, Dict[str, Any]] = {}
        self._api_base = os.environ.get("ALLTERNIT_API_URL", "http://localhost:8013")
        self._internal_token = os.environ.get("ALLTERNIT_INTERNAL_SERVICE_TOKEN")

    def manifest(self) -> EnvironmentBackendManifest:
        available = bool(self._internal_token)
        return EnvironmentBackendManifest(
            self.provider_id, ("linux",), ("vm", "container"), available,
            reason=None if available else "ALLTERNIT_INTERNAL_SERVICE_TOKEN not configured",
            capabilities=("shell", "files", "byoc"),
        )

    async def provision(self, record: EnvironmentRecord) -> Dict[str, Any]:
        if not self.manifest().available:
            raise RuntimeError(self.manifest().reason)

        cloud_account = record.metadata.get("cloud_account") or {}
        missing = {"organization_id", "credential_id"} - cloud_account.keys()
        if missing:
            raise ValueError(f"metadata['cloud_account'] missing required keys: {sorted(missing)}")

        credential = await self._resolve_credential(
            cloud_account["organization_id"], cloud_account["credential_id"]
        )
        strategy = strategy_for(credential["provider"])
        started_at = _iso_now()
        details = await strategy.provision(record, credential)

        self._environments[record.environment_id] = {
            "organization_id": cloud_account["organization_id"],
            "provider": credential["provider"],
            "started_at": started_at,
            # stop() needs to re-authenticate against the same cloud account
            # to tear down what provision() created -- keep both the
            # credential used and whatever provision() returned (instance
            # id / resource group / etc, provider-specific).
            "credential": credential,
            "provision_details": details,
        }
        return details

    async def stop(self, environment_id: str) -> None:
        state = self._environments.pop(environment_id, None)
        if state is None:
            return
        try:
            await strategy_for(state["provider"]).stop(environment_id, state)
        finally:
            # Best-effort, no offline retry queue in this pass: a network
            # blip here means this usage interval is never billed. A durable
            # local retry queue (a small sqlite outbox, same shape as
            # EnvironmentAuthority's own store) is a reasonable fast-follow,
            # explicitly flagged rather than silently accepted as "good enough."
            await self._post_usage_event(environment_id, state)

    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]:
        raise RuntimeError(
            "CustomerCloudBackend has no shell yet -- pending real provider strategy implementation"
        )

    async def _resolve_credential(self, organization_id: str, credential_id: str) -> Dict[str, Any]:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{self._api_base}/internal/cloud-credentials/{credential_id}/resolve",
                json={"organization_id": organization_id},
                headers={"x-allternit-internal-token": self._internal_token},
            )
        response.raise_for_status()
        return response.json()

    async def _post_usage_event(self, environment_id: str, state: Dict[str, Any]) -> None:
        import httpx

        payload = {
            "organization_id": state["organization_id"],
            "environment_id": environment_id,
            "resource_type": "sandbox_runtime",
            "quantity": _elapsed_seconds(state["started_at"]),
            "unit": "seconds",
            "provider": state["provider"],
            "started_at": state["started_at"],
            "ended_at": _iso_now(),
            "idempotency_key": f"{environment_id}:{state['started_at']}",
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{self._api_base}/internal/usage-events",
                    json=payload,
                    headers={"x-allternit-internal-token": self._internal_token},
                )
        except Exception:  # noqa: BLE001
            log.warning("usage-event POST failed for %s -- not retried, billing telemetry lost", environment_id)


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _elapsed_seconds(started_at_iso: str) -> float:
    from datetime import datetime

    started = datetime.fromisoformat(started_at_iso)
    now = datetime.fromisoformat(_iso_now())
    return max(0.0, (now - started).total_seconds())


class EnvironmentBackendService:
    def __init__(self, authority: EnvironmentAuthority) -> None:
        self._authority = authority
        self._backends: Dict[str, EnvironmentBackend] = {}

    def register(self, backend: EnvironmentBackend) -> None:
        if backend.provider_id in self._backends:
            raise ValueError(f"Environment backend {backend.provider_id!r} already registered")
        self._backends[backend.provider_id] = backend

    def manifests(self) -> tuple[EnvironmentBackendManifest, ...]:
        return tuple(self._backends[key].manifest() for key in sorted(self._backends))

    def backend(self, provider_id: str) -> EnvironmentBackend:
        """Public accessor for a registered backend instance (e.g. to build a HostAdapterGate)."""
        return self._backend(provider_id)

    def _backend(self, provider_id: str) -> EnvironmentBackend:
        try:
            return self._backends[provider_id]
        except KeyError as error:
            raise KeyError(f"Unknown environment provider {provider_id!r}") from error

    async def provision(self, environment_id: str) -> EnvironmentRecord:
        record = self._authority.get_environment(environment_id)
        self._authority.transition(environment_id, "provisioning")
        try:
            details = await self._backend(record.provider_id).provision(record)
        except Exception:
            self._authority.transition(environment_id, "failed")
            raise
        running = self._authority.transition(environment_id, "running")
        return EnvironmentRecord(**{**asdict(running), "metadata": {**running.metadata, "runtime": details}})

    async def stop(self, environment_id: str) -> EnvironmentRecord:
        record = self._authority.get_environment(environment_id)
        self._authority.transition(environment_id, "stopping")
        try:
            await self._backend(record.provider_id).stop(environment_id)
        except Exception:
            self._authority.transition(environment_id, "failed")
            raise
        return self._authority.transition(environment_id, "stopped")

    async def execute(self, environment_id: str, command: list[str], env: Dict[str, str]) -> Dict[str, Any]:
        record = self._authority.get_environment(environment_id)
        if record.state != "running":
            raise RuntimeError("Environment must be running")
        return await self._backend(record.provider_id).execute(environment_id, command, env)

    async def provider_operation(self, environment_id: str, operation: str, *args: Any) -> Any:
        record = self._authority.get_environment(environment_id)
        if record.state != "running":
            raise RuntimeError("Environment must be running")
        handler = getattr(self._backend(record.provider_id), operation, None)
        if handler is None:
            raise RuntimeError(f"Environment provider does not support {operation}")
        return await handler(environment_id, *args)


_default_authority: Optional[EnvironmentAuthority] = None
_default_service: Optional[EnvironmentBackendService] = None


def default_environment_authority() -> EnvironmentAuthority:
    """Single durable authority instance, shared by the gateway router and adapters."""
    global _default_authority
    if _default_authority is None:
        state_dir = Path(os.environ.get("ALLTERNIT_COMPUTER_STATE_DIR", "~/.allternit/computer-use")).expanduser()
        state_dir.mkdir(parents=True, exist_ok=True)
        _default_authority = EnvironmentAuthority(state_dir / "environments.sqlite3")
    return _default_authority


def default_environment_backend_service() -> EnvironmentBackendService:
    """Single composition root for environment backends (VM sandboxes + host).

    The gateway router and any in-process adapter (e.g. the code interpreter) share
    this instance so a provisioned sandbox/host environment is reachable from
    wherever `execute`/`provider_operation` is called, instead of each caller
    building its own disconnected registry.
    """
    global _default_service
    if _default_service is None:
        service = EnvironmentBackendService(default_environment_authority())
        service.register(AllternitSandboxBackend())
        service.register(CuaSandboxBackend())
        service.register(HostEnvironmentBackend())
        service.register(CustomerCloudBackend())
        _default_service = service
    return _default_service
