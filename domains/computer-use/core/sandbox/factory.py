from __future__ import annotations

import platform
import shutil

from .base import BaseSandbox, SandboxBackend, SandboxConfig


def create_sandbox(config: SandboxConfig | None = None) -> BaseSandbox:
    """
    Create the most appropriate sandbox for the current platform.

    AUTO selection logic:
      macOS  → AppleVirtSandbox  (falls back to ProcessSandbox internally)
      Linux with firecracker → FirecrackerSandbox (falls back internally)
      else   → ProcessSandbox
    """
    cfg = config or SandboxConfig()

    if cfg.backend == SandboxBackend.AUTO:
        if platform.system() == "Darwin":
            cfg.backend = SandboxBackend.APPLE_VIRT
        elif shutil.which("firecracker") is not None:
            cfg.backend = SandboxBackend.FIRECRACKER
        else:
            cfg.backend = SandboxBackend.PROCESS

    if cfg.backend == SandboxBackend.APPLE_VIRT:
        from .apple_virt_sandbox import AppleVirtSandbox  # noqa: PLC0415

        return AppleVirtSandbox(cfg)

    if cfg.backend == SandboxBackend.FIRECRACKER:
        from .firecracker_sandbox import FirecrackerSandbox  # noqa: PLC0415

        return FirecrackerSandbox(cfg)

    from .process_sandbox import ProcessSandbox  # noqa: PLC0415

    return ProcessSandbox(cfg)
