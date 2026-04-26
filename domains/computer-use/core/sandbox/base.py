from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SandboxBackend(str, Enum):
    APPLE_VIRT = "apple_virt"
    FIRECRACKER = "firecracker"
    PROCESS = "process"
    AUTO = "auto"


@dataclass
class SandboxConfig:
    backend: SandboxBackend = SandboxBackend.AUTO
    memory_mb: int = 512
    vcpus: int = 1
    timeout_ms: int = 120_000
    network: bool = True
    readonly_root: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class SandboxResult:
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    sandbox_id: str


class BaseSandbox(ABC):
    def __init__(self, config: SandboxConfig) -> None:
        self.config = config

    @abstractmethod
    async def start(self) -> str:
        """Start the sandbox and return its sandbox_id."""
        ...

    @abstractmethod
    async def run(
        self,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> SandboxResult:
        """Run a command inside the sandbox."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Stop and clean up the sandbox."""
        ...

    async def __aenter__(self) -> "BaseSandbox":
        await self.start()
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.stop()
