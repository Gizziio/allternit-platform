"""
Allternit Computer Use — Browser Use Adapter
Wraps the existing browser-use agent path from Allternit Operator.

Falls back to a venv subprocess when browser-use is not installed in the
active Python environment (common when the host uses system Python but
browser-use was installed inside ~/browser-use/venv/).
"""

import os
import sys
import json
import asyncio
import subprocess
from core import BaseAdapter, ActionRequest, ResultEnvelope, Receipt, Artifact
from datetime import datetime
from typing import Optional, Dict, Any


# ── Venv discovery ────────────────────────────────────────────────────────────

BROWSER_USE_VENV_PATHS = [
    os.path.expanduser("~/browser-use/venv"),
    os.path.expanduser("~/.venv/browser-use"),
    "/opt/browser-use/venv",
]


def _find_browser_use_python() -> Optional[str]:
    """
    Scan the known venv paths for a Python interpreter that can import
    browser_use. Returns the first working interpreter path, or None.
    """
    for venv in BROWSER_USE_VENV_PATHS:
        python = os.path.join(venv, "bin", "python3")
        if os.path.exists(python):
            try:
                r = subprocess.run(
                    [python, "-c", "import browser_use; print('ok')"],
                    capture_output=True, text=True, timeout=5,
                )
                if r.stdout.strip() == "ok":
                    return python
            except Exception:
                pass
    return None


# Try to import browser_use directly; fall back to venv discovery.
_BROWSER_USE_NATIVE = False
_BROWSER_USE_PYTHON: Optional[str] = None

try:
    import browser_use as _bu_check  # noqa: F401
    _BROWSER_USE_NATIVE = True
except ImportError:
    _BROWSER_USE_PYTHON = _find_browser_use_python()
    if _BROWSER_USE_PYTHON is None:
        import logging as _log
        _log.getLogger(__name__).warning(
            "browser-use not found in system Python or known venvs. "
            "Adapter will raise RuntimeError on use. "
            "Install: pip install browser-use langchain-openai  "
            "OR place venv at ~/browser-use/venv/"
        )


# ── Subprocess runner ─────────────────────────────────────────────────────────

_SUBPROCESS_RUNNER = r"""
import sys, json, asyncio, os

payload = json.loads(sys.stdin.read())
goal = payload["goal"]
url  = payload.get("url")

from browser_use import Agent as BrowserAgent, Browser, BrowserConfig
from langchain_openai import ChatOpenAI

async def run():
    config = BrowserConfig(
        headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
        extra_chromium_args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    browser = Browser(config=config)
    llm = ChatOpenAI(
        model=os.getenv("Allternit_BROWSER_MODEL", "gpt-4o"),
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0.1,
    )
    try:
        agent = BrowserAgent(task=goal, llm=llm, browser=browser)
        if url:
            await browser.navigate_to(url)
        result = await agent.run()
        out = {
            "success": result.success(),
            "actions": result.actions(),
            "extracted_content": result.extracted_content(),
            "final_url": result.final_url(),
        }
    except Exception as exc:
        out = {"success": False, "error": str(exc)}
    finally:
        await browser.close()
    print(json.dumps(out))

asyncio.run(run())
"""


async def _run_via_venv(goal: str, url: Optional[str], timeout_ms: int) -> Dict[str, Any]:
    """Run browser-use agent in the detected venv Python via subprocess."""
    if _BROWSER_USE_PYTHON is None:
        raise RuntimeError(
            "browser-use is not available. "
            "Install: pip install browser-use langchain-openai  "
            "OR set up venv at ~/browser-use/venv/ "
            "(also checked ~/.venv/browser-use/ and /opt/browser-use/venv/)."
        )

    payload = json.dumps({"goal": goal, "url": url})
    timeout_secs = max(60, timeout_ms / 1000.0)

    proc = await asyncio.create_subprocess_exec(
        _BROWSER_USE_PYTHON, "-c", _SUBPROCESS_RUNNER,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ},
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=payload.encode()),
            timeout=timeout_secs,
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"browser-use subprocess timed out after {timeout_secs:.0f}s")

    if proc.returncode != 0:
        raise RuntimeError(
            f"browser-use subprocess failed (exit {proc.returncode}): "
            f"{stderr.decode()[:500]}"
        )

    try:
        return json.loads(stdout.decode())
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"browser-use subprocess returned non-JSON output: {stdout.decode()[:200]}"
        ) from exc


# ── Adapter ───────────────────────────────────────────────────────────────────

class BrowserUseAdapter(BaseAdapter):
    """LLM-powered adaptive browser automation via browser-use library.

    Execution path priority:
      1. Native import (browser_use installed in current Python env)
      2. Venv subprocess (browser_use found in ~/browser-use/venv/ or peers)
      3. RuntimeError with installation instructions
    """

    def __init__(self):
        self._browser = None
        self._llm = None

    @property
    def adapter_id(self) -> str:
        return "browser.browser-use"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        """Initialize browser-use agent (native path only)."""
        if not _BROWSER_USE_NATIVE:
            # Venv path does not pre-initialize; everything happens inside the subprocess.
            return

        from browser_use import Browser, BrowserConfig
        from langchain_openai import ChatOpenAI

        config = BrowserConfig(
            headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
            extra_chromium_args=["--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=9222"],
        )
        self._browser = Browser(config=config)
        self._llm = ChatOpenAI(
            model=os.getenv("Allternit_BROWSER_MODEL", "gpt-4o"),
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.1,
        )

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            goal = action.parameters.get("goal", action.target)
            url = action.parameters.get("url", action.target if action.action_type == "goto" else None)

            if _BROWSER_USE_NATIVE:
                # ── Native path ───────────────────────────────────────────
                if not self._browser:
                    await self.initialize()

                from browser_use import Agent as BrowserAgent

                agent = BrowserAgent(task=goal, llm=self._llm, browser=self._browser)
                if url:
                    await self._browser.navigate_to(url)
                result = await agent.run()

                result_data = {
                    "success": result.success(),
                    "actions": result.actions(),
                    "extracted_content": result.extracted_content(),
                    "final_url": result.final_url(),
                }

            elif _BROWSER_USE_PYTHON is not None:
                # ── Venv subprocess path ──────────────────────────────────
                result_data = await _run_via_venv(goal, url, action.timeout_ms)

            else:
                raise RuntimeError(
                    "browser-use is not available. "
                    "Install: pip install browser-use langchain-openai  "
                    "OR set up venv at ~/browser-use/venv/ "
                    "(also checked ~/.venv/browser-use/ and /opt/browser-use/venv/)."
                )

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()

            self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {"code": "BROWSER_USE_ERROR", "message": str(e), "adapter_id": self.adapter_id}
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
