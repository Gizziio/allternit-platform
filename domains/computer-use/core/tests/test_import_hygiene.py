import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

import computer_use_router as router_module  # noqa: E402
from core.action_recorder import ActionRecorder  # noqa: E402
import core.action_recorder as ar_mod  # noqa: E402


def test_module_identity():
    import core.action_recorder as fresh
    assert fresh is ar_mod, "core.action_recorder replaced between import and test run"
    assert router_module.ActionRecorder is ActionRecorder, (
        f"router bound to {router_module.ActionRecorder.__module__} id={id(router_module.ActionRecorder)}, "
        f"test file has id={id(ActionRecorder)}"
    )
    assert ActionRecorder.__module__ in sys.modules, "ActionRecorder module not in sys.modules"
    assert sys.modules.get(ActionRecorder.__module__) is fresh, (
        "ActionRecorder class globals belong to a different module instance than sys.modules"
    )
