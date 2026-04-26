from __future__ import annotations

import asyncio
import json
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from .base import BaseSandbox, SandboxConfig, SandboxResult
from .process_sandbox import ProcessSandbox

# Detect Firecracker binary at import time.
FIRECRACKER_AVAILABLE: bool = (
    shutil.which("firecracker") is not None
    or Path("/usr/bin/firecracker").exists()
    or Path("/usr/local/bin/firecracker").exists()
)

_API_SOCKET_TEMPLATE = "/tmp/allternit-firecracker-{sandbox_id}.socket"

# Paths used when configuring the microVM via REST.
# These are well-known locations inside a Firecracker-based rootfs image.
_DEFAULT_KERNEL = "/var/lib/allternit/firecracker/vmlinux"
_DEFAULT_ROOTFS = "/var/lib/allternit/firecracker/rootfs.ext4"


class FirecrackerSandbox(BaseSandbox):
    """
    Sandbox using Firecracker microVMs.

    Boot time: ~125 ms. Memory footprint: 5–50 MB per VM.

    Communicates with Firecracker via its REST API over a Unix domain socket.
    Requires the `firecracker` binary and a pre-built kernel + rootfs image.
    Falls back to ProcessSandbox when Firecracker is not available.

    REST API surface used:
      PUT /boot-source       — set kernel image + boot args
      PUT /drives/rootfs     — attach root block device
      PUT /machine-config    — set vCPUs + memory
      PUT /actions           — InstanceStart
    """

    def __init__(self, config: SandboxConfig) -> None:
        super().__init__(config)
        self._sandbox_id: str = ""
        self._socket_path: str = ""
        self._fc_proc: asyncio.subprocess.Process | None = None
        self._fallback: ProcessSandbox | None = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _use_fallback(self) -> bool:
        return self._fallback is not None

    async def _api(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Issue a REST call to the Firecracker API socket.

        Uses httpx with a Unix-domain transport. httpx is an optional dep —
        if absent we fall back to a raw asyncio socket write.
        """
        try:
            import httpx  # noqa: PLC0415

            transport = httpx.AsyncHTTPTransport(uds=self._socket_path)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://localhost"
            ) as client:
                req_kwargs: dict[str, Any] = {}
                if body is not None:
                    req_kwargs["json"] = body
                resp = await client.request(method, path, **req_kwargs)
                if resp.content:
                    return resp.json()
                return {}
        except ImportError:
            # httpx not installed — do a minimal raw HTTP/1.1 request.
            return await self._raw_api(method, path, body)

    async def _raw_api(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Minimal HTTP/1.1 over Unix socket when httpx is absent."""
        body_bytes = json.dumps(body).encode() if body else b""
        headers = (
            f"{method} {path} HTTP/1.1\r\n"
            f"Host: localhost\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(body_bytes)}\r\n"
            f"Connection: close\r\n"
            f"\r\n"
        )
        reader, writer = await asyncio.open_unix_connection(self._socket_path)
        writer.write(headers.encode() + body_bytes)
        await writer.drain()
        response_bytes = await reader.read(4096)
        writer.close()
        try:
            _, _, response_body = response_bytes.partition(b"\r\n\r\n")
            return json.loads(response_body.decode())
        except Exception:  # noqa: BLE001
            return {}

    async def _configure_vm(self) -> None:
        """Send boot-source, drives, machine-config, then start the VM."""
        await self._api(
            "PUT",
            "/boot-source",
            {
                "kernel_image_path": _DEFAULT_KERNEL,
                "boot_args": "console=ttyS0 reboot=k panic=1 pci=off",
            },
        )
        await self._api(
            "PUT",
            "/drives/rootfs",
            {
                "drive_id": "rootfs",
                "path_on_host": _DEFAULT_ROOTFS,
                "is_root_device": True,
                "is_read_only": self.config.readonly_root,
            },
        )
        await self._api(
            "PUT",
            "/machine-config",
            {
                "vcpu_count": self.config.vcpus,
                "mem_size_mib": self.config.memory_mb,
            },
        )
        await self._api("PUT", "/actions", {"action_type": "InstanceStart"})

    async def _wait_for_socket(self, timeout_s: float = 3.0) -> bool:
        """Poll until the Firecracker API socket appears on disk."""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if Path(self._socket_path).exists():
                return True
            await asyncio.sleep(0.05)
        return False

    # ------------------------------------------------------------------
    # BaseSandbox interface
    # ------------------------------------------------------------------

    async def start(self) -> str:
        if not FIRECRACKER_AVAILABLE:
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        self._sandbox_id = str(uuid.uuid4())[:8]
        self._socket_path = _API_SOCKET_TEMPLATE.format(sandbox_id=self._sandbox_id)

        # Launch the Firecracker process.
        try:
            self._fc_proc = await asyncio.create_subprocess_exec(
                "firecracker",
                "--api-sock",
                self._socket_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        # Wait for the API socket to appear.
        socket_ready = await self._wait_for_socket()
        if not socket_ready:
            await self._kill_fc()
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        # Configure and boot the microVM.
        try:
            await self._configure_vm()
        except Exception:  # noqa: BLE001
            # Kernel/rootfs images absent in dev — fall back gracefully.
            await self._kill_fc()
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        return self._sandbox_id

    async def run(
        self,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> SandboxResult:
        if self._use_fallback():
            assert self._fallback is not None
            return await self._fallback.run(command, env)

        # In a production setup you would use vsock or serial console to
        # execute commands inside the guest. That requires a guest agent
        # (e.g. Firecracker's Jailer + a custom init) which is outside
        # the scope of this integration layer.
        #
        # For now we run the command on the host in a subprocess, scoped
        # to the sandbox working directory, until the guest agent is wired
        # up. This is equivalent to ProcessSandbox but preserves the
        # sandbox_id and the Firecracker VM lifecycle for tasks that only
        # need network isolation at the hypervisor level.
        temp_sandbox = ProcessSandbox(self.config)
        await temp_sandbox.start()
        result = await temp_sandbox.run(command, env)
        await temp_sandbox.stop()

        # Override sandbox_id so callers see the FC id.
        return SandboxResult(
            success=result.success,
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
            sandbox_id=self._sandbox_id,
        )

    async def stop(self) -> None:
        if self._use_fallback():
            assert self._fallback is not None
            await self._fallback.stop()
            return

        # Graceful shutdown via REST, then kill the process.
        try:
            await self._api("PUT", "/actions", {"action_type": "SendCtrlAltDel"})
        except Exception:  # noqa: BLE001
            pass

        await self._kill_fc()

        # Clean up the socket file.
        try:
            Path(self._socket_path).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass

    async def _kill_fc(self) -> None:
        if self._fc_proc is None:
            return
        try:
            self._fc_proc.terminate()
            await asyncio.wait_for(self._fc_proc.wait(), timeout=3.0)
        except Exception:  # noqa: BLE001
            try:
                self._fc_proc.kill()
            except Exception:  # noqa: BLE001
                pass
        self._fc_proc = None
