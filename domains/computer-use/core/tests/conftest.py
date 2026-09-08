"""
Pytest bootstrap for the core/tests suite.

This repo has an outer package at domains/computer-use/core/__init__.py
(re-exports) and the real inner package at domains/computer-use/core/core/.
When pytest imports test modules as ``core.tests.<name>``, the OUTER package
lands in sys.modules as ``core``; each test file's import-dance then purges
and re-imports, so different test files end up bound to different
``core.action_recorder`` module instances and monkeypatches silently miss.

Pinning ``core`` to the INNER package here — before any test module is
collected — makes every test file share one module instance set. See
tests/test_import_hygiene.py for the regression guard.
"""

import sys
from pathlib import Path

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]

_existing = sys.modules.get("core")
_existing_file = Path(getattr(_existing, "__file__", "") or "") if _existing else None
if _existing_file is None or _existing_file.parent != DOMAIN_CORE_ROOT / "core":
    for _name in [
        m for m in list(sys.modules)
        if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
    ]:
        del sys.modules[_name]
# pytest's prepend import mode puts the OUTER parent dir at sys.path[0] while
# importing this conftest; force the inner core root ahead of it.
while str(DOMAIN_CORE_ROOT) in sys.path:
    sys.path.remove(str(DOMAIN_CORE_ROOT))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

import core  # noqa: E402,F401  — bind the INNER core package as `core`
