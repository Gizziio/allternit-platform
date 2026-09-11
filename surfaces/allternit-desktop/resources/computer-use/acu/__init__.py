# Root-level re-exports so `from core import X` resolves for tests
from .core.base_adapter import (  # noqa: F401
    BaseAdapter,
    ActionRequest,
    Artifact,
    PolicyDecision,
    ResultEnvelope,
    Receipt,
    AdapterCapabilities,
)
from .core.computer_use_executor import (  # noqa: F401
    ComputerUseExecutor,
    get_executor,
    NATIVE_CLAUDE_ACTIONS,
    BROWSER_EXTENSION_ACTIONS,
    ALL_SUPPORTED_ACTIONS,
    ADAPTER_WATERFALL,
)
