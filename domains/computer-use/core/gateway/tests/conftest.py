"""
Pytest bootstrap for the gateway/tests suite.

This repo has an outer package at domains/computer-use/core/__init__.py
(re-exports) and the real inner package at domains/computer-use/core/core/.
Under pytest, the OUTER package can land in sys.modules as ``core`` (see
core/tests/conftest.py for the full explanation). The gateway modules expect
``core`` to be the INNER package — ``from core.action_recorder import ...``
must resolve to core/core/action_recorder.py — so we pin the inner core here,
before any gateway module is imported.
"""

import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[2]  # domains/computer-use/core
INNER_CORE_INIT = DOMAIN_CORE_ROOT / "core" / "__init__.py"

_existing = sys.modules.get("core")
_existing_file = Path(getattr(_existing, "__file__", "") or "") if _existing else None
if _existing_file is None or _existing_file != INNER_CORE_INIT:
    for _name in [
        m for m in list(sys.modules)
        if (m == "core" or m.startswith("core.")) and not m.startswith("core.gateway")
    ]:
        del sys.modules[_name]
# Drop the outer package's parent dir so `import core` cannot rebind to the
# outer re-export package, then force the inner core root ahead of everything.
_outer_parent = str(DOMAIN_CORE_ROOT.parent)
while _outer_parent in sys.path:
    sys.path.remove(_outer_parent)
while str(DOMAIN_CORE_ROOT) in sys.path:
    sys.path.remove(str(DOMAIN_CORE_ROOT))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

import core  # noqa: E402,F401  — bind the INNER core package as `core`
